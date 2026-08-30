"""HTTP layer over `Src.inference.Scorer`, with a SQLite record of every call.

Deliberately thin: `Scorer.score` already returns JSON-ready dicts and
`App/Schemas.py` already describes that payload, so the handlers below only
translate transport concerns - which model to use, how many tips to return,
which exception becomes which status code, and whether the answer is worth
persisting. Product logic stays in `Src/`, where the CLI (`python main.py
score`) exercises the same code path. Database access is likewise delegated, to
`App/crud.py`, so a handler is a call and a serialisation.

**Run it as a package from the repo root**, never as a script:

    .venv/Scripts/python -m uvicorn App.Api:app --reload

`python App/Api.py` puts `App/` on `sys.path` instead of the repo root, so the
absolute `App.` and `Src.` imports below both fail with `ModuleNotFoundError`.

Routing: everything canonical lives under `/api`, which is what the React
frontend calls and what Vite proxies in development. The three paths this
service exposed before the frontend existed - `/health`, `/models`, `/predict` -
remain as unprefixed aliases so anything already calling them keeps working;
they are hidden from the OpenAPI schema so `/docs` shows one route per endpoint
rather than two.

Error mapping, and why each one:

* `ValueError` -> **422**. `Src/Preprocessed.validate_raw` owns the two checks
  the wire format cannot make - `Gender` must be a class the stored
  `LabelEncoder` saw, `School_Grade` must carry a year number. Both are
  properties of `models/preprocessor.pkl`, so they are caller errors, not
  server faults.
* `FileNotFoundError` / `ImportError` -> **503**. A missing pickle or an absent
  `xgboost` is a deployment problem; the default `gb` model may still be
  serving, so the process should not die on a request for `xgb`.
* A failed *write* is *not* mapped to an error at all. History is a
  convenience; if SQLite is unavailable the prediction is still correct and is
  still returned, with an empty `history_ids`. See `predict`.
* A failed history *read* -> **503**, via `_storage_unavailable`. A read has no
  useful degraded answer - an empty list would claim the history is empty when
  it is really unreachable - so it says so instead. This is the same class of
  fault as a missing pickle, and gets the same status.

A deployment on a read-only filesystem (a serverless function, say) therefore
serves `/api/health`, `/api/models`, `/api/rules` and `/api/predict` normally,
and answers 503 on `/api/history` until `DATABASE_URL` points somewhere
writable. That path is exercised by the read-only test in the scratchpad notes.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from App import crud
from App.database import get_db, init_db
from App.dependencies import get_scorer, warm
from App.Schemas import (
    DeleteResponse,
    ErrorResponse,
    HealthResponse,
    HistoryListResponse,
    HistoryRecord,
    PredictionResult,
    PredictRequest,
    PredictResponse,
)
from Src.config import Project_Root
from Src.inference import BAND_LABELS, DEFAULT_MODEL, MAX_TIPS, RULES, load_thresholds

log = logging.getLogger("app.api")

# Built frontend, if `npm run build` has been run. Absent in development, where
# Vite serves the UI itself and proxies /api here.
FRONTEND_DIST = Project_Root / "frontend" / "dist"

# Vite's dev server. Only consulted in development - in production the API
# serves the built bundle from the same origin, so no CORS is involved.
DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load the default scorer and create any missing tables before serving.

    Failing on the scorer is intentional - see `App.dependencies.warm`. An empty
    `models/` should stop the deployment, not surface as a 500 to a user.
    A failing *database* is not fatal for the same reason a failed write is not:
    scoring works without it, so it is logged and the service starts degraded.
    """
    warm()
    try:
        init_db()
    except SQLAlchemyError:
        log.exception("could not initialise the history database; history disabled")
    yield


app = FastAPI(
    title="Smartphone Addiction Warning API",
    version="1.1",
    description=(
        "Scores a raw teen record and returns a severity band, its cohort "
        "percentile and ranked advice. The band alone under-reports: the "
        "target is ceiling-censored, so read `percentile` alongside it. "
        "Every scored request is logged to SQLite and readable at /api/history."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", ",".join(DEV_ORIGINS)).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Service
# --------------------------------------------------------------------------- #
@app.get("/api/health", response_model=HealthResponse, tags=["service"])
def health() -> HealthResponse:
    """Liveness plus whether the default artifacts actually loaded.

    Never raises: a health check that 500s tells a load balancer nothing it can
    act on, so a failed load is reported as `model_loaded=false` instead.
    """
    try:
        get_scorer()
        loaded = True
    except (FileNotFoundError, ImportError):
        loaded = False
    return HealthResponse(status="ok" if loaded else "degraded", model_loaded=loaded)


@app.get("/api/models", tags=["service"])
def models() -> dict[str, object]:
    """Which regressors this deployment can actually serve.

    `xgb` is listed as available only where xgboost is importable, so a caller
    discovers the gap here rather than through a 503 on `/api/predict`.
    """
    available = []
    for name in ("rf", "gb", "xgb"):
        try:
            get_scorer(name)
        except (FileNotFoundError, ImportError):
            continue
        available.append(name)
    return {"available": available, "default": DEFAULT_MODEL}


@app.get("/api/rules", tags=["service"])
def rules() -> dict[str, object]:
    """The calibrated warning layer, as the UI needs to display it.

    The thresholds come from `models/thresholds.json` rather than from any
    constant here - the frontend previously carried its own hardcoded copy of
    these numbers, which is exactly the drift `Src/inference.py`'s docstring
    warns about. Serving them means a `python main.py calibrate --save` reaches
    the UI without a frontend edit.
    """
    calibration = load_thresholds()
    # `rule_thresholds[feature]` is `{"quantile": .., "value": ..}` - flattened
    # here so a caller gets a number to compare against, and the quantile it
    # came from as separate provenance rather than as part of the cut.
    cuts = calibration["rule_thresholds"]
    return {
        "rules": [
            {
                "feature": feature,
                "direction": direction,
                "message": message,
                "threshold": cuts.get(feature, {}).get("value"),
                "quantile": cuts.get(feature, {}).get("quantile"),
            }
            for feature, direction, message in RULES
        ],
        "band_labels": list(BAND_LABELS),
        "band_cuts": calibration["band_cuts"],
        "score_range": calibration["score_range"],
        "cohort_rows": calibration["n_rows"],
        "ceiling_share": calibration["ceiling_share"],
        "max_tips": MAX_TIPS,
    }


# --------------------------------------------------------------------------- #
# Prediction
# --------------------------------------------------------------------------- #
@app.post(
    "/api/predict",
    response_model=PredictResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    tags=["prediction"],
)
def predict(
    payload: PredictRequest,
    persist: bool = Query(
        default=True,
        description=(
            "Write the results to the history table. Set false for throwaway "
            "scoring - the what-if simulator does, so dragging a slider does "
            "not fill the history with intermediate states."
        ),
    ),
    db: Session = Depends(get_db),
) -> PredictResponse:
    """Score every record in the request with one loaded model, then log it.

    The whole batch goes through `Scorer.score` in a single call - it accepts a
    list of dicts and `preprocess_new` engineers them as one frame, so this is
    both faster and identical to scoring them one by one.

    Persistence is best-effort *on purpose*: the prediction is the product, the
    history is a convenience. A database that is locked, missing or read-only
    logs a warning and returns the scores with an empty `history_ids` rather
    than turning a correct answer into a 500.
    """
    try:
        scorer = get_scorer(payload.model)
    except (FileNotFoundError, ImportError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    records = [record.model_dump() for record in payload.records]
    try:
        results = scorer.score(records, limit=payload.tips)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    history_ids: list[int] = []
    if persist:
        try:
            rows = crud.log_predictions(
                db, records, results, payload.model, payload.tips
            )
            history_ids = [row.id for row in rows]
        except SQLAlchemyError:
            db.rollback()
            log.exception("failed to write %d prediction(s) to history", len(results))

    return PredictResponse(
        # `Scorer.score` returns plain dicts and `crud.log_predictions` above
        # wants them that way, so they are validated into models here rather
        # than earlier. Pydantic would coerce them either way; doing it
        # explicitly is what makes the annotation honest.
        results=[PredictionResult.model_validate(result) for result in results],
        count=len(results),
        model_used=payload.model,
        tips=payload.tips,
        history_ids=history_ids,
    )


# --------------------------------------------------------------------------- #
# History
# --------------------------------------------------------------------------- #
def _storage_unavailable(exc: SQLAlchemyError) -> HTTPException:
    """Turn a database failure on a read path into a 503 with a usable message.

    Unlike a write, a read has no sensible degraded answer: returning an empty
    list would tell the caller the history *is* empty rather than unreachable,
    and a UI would render "no saved predictions" over a database that is merely
    misconfigured. 503 is the same status a missing artifact gets, for the same
    reason - it is a deployment fault, not a caller error.
    """
    log.exception("history storage unavailable")
    return HTTPException(
        status_code=503,
        detail=(
            "History storage is unavailable. On a read-only filesystem set "
            f"DATABASE_URL to a writable database. ({type(exc).__name__})"
        ),
    )


@app.get(
    "/api/history",
    response_model=HistoryListResponse,
    responses={503: {"model": ErrorResponse}},
    tags=["history"],
)
def list_history(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    band: str | None = Query(default=None, description=f"One of {list(BAND_LABELS)}."),
    model_name: str | None = Query(default=None, description="rf, gb or xgb."),
    db: Session = Depends(get_db),
) -> HistoryListResponse:
    """Past runs, newest first. `total` ignores paging so a UI can show 'x of y'."""
    try:
        rows, total = crud.list_predictions(
            db, limit=limit, offset=offset, band=band, model_name=model_name
        )
    except SQLAlchemyError as exc:
        raise _storage_unavailable(exc) from exc
    return HistoryListResponse(
        items=[HistoryRecord.from_row(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get(
    "/api/history/{record_id}",
    response_model=HistoryRecord,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    tags=["history"],
)
def get_history(record_id: int, db: Session = Depends(get_db)) -> HistoryRecord:
    """One past run.

    Its `record` field is a valid `/api/predict` payload - that is what the
    frontend's "load into form" button posts back.
    """
    try:
        row = crud.get_prediction(db, record_id)
    except SQLAlchemyError as exc:
        raise _storage_unavailable(exc) from exc
    if row is None:
        raise HTTPException(status_code=404, detail=f"no history record {record_id}")
    return HistoryRecord.from_row(row)


@app.delete(
    "/api/history/{record_id}",
    response_model=DeleteResponse,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    tags=["history"],
)
def delete_history(record_id: int, db: Session = Depends(get_db)) -> DeleteResponse:
    """Delete one past run.

    A missing id is a 404 rather than a silent success, so a UI that deletes the
    same row twice learns the second one was already gone.
    """
    try:
        deleted = crud.delete_prediction(db, record_id)
    except SQLAlchemyError as exc:
        raise _storage_unavailable(exc) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail=f"no history record {record_id}")
    return DeleteResponse(deleted=1, id=record_id)


@app.delete(
    "/api/history",
    response_model=DeleteResponse,
    responses={503: {"model": ErrorResponse}},
    tags=["history"],
)
def clear_history(
    confirm: bool = Query(
        default=False,
        description="Must be true. Guards against an accidental unfiltered DELETE.",
    ),
    db: Session = Depends(get_db),
) -> DeleteResponse:
    """Empty the history table. Requires `?confirm=true`."""
    if not confirm:
        raise HTTPException(
            status_code=400, detail="pass ?confirm=true to clear history"
        )
    try:
        return DeleteResponse(deleted=crud.clear_predictions(db))
    except SQLAlchemyError as exc:
        raise _storage_unavailable(exc) from exc


# --------------------------------------------------------------------------- #
# Back-compatible aliases
# --------------------------------------------------------------------------- #
# The paths this service exposed before the frontend existed. Hidden from the
# schema so /docs lists each endpoint once; they call the same functions, so
# they cannot drift from the canonical routes above.
app.add_api_route("/health", health, methods=["GET"], include_in_schema=False)
app.add_api_route("/models", models, methods=["GET"], include_in_schema=False)
app.add_api_route(
    "/predict",
    predict,
    methods=["POST"],
    response_model=PredictResponse,
    include_in_schema=False,
)


# --------------------------------------------------------------------------- #
# Frontend
# --------------------------------------------------------------------------- #
if FRONTEND_DIST.is_dir():
    # Production: one process serves the API and the built SPA from one origin.
    # Mounted last so it never shadows an /api route, and `html=True` makes the
    # mount fall back to index.html for client-side routes.
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        """Signpost for a backend running without a built frontend."""
        return {
            "message": "Smartphone Addiction Warning System API is running",
            "docs": "/docs",
            "frontend": (
                "not built - run `npm run build` in frontend/, or `npm run dev` "
                "and use http://localhost:3000"
            ),
        }
