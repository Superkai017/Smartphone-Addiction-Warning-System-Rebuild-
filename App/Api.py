"""HTTP layer over `Src.inference.Scorer`.

Deliberately thin: `Scorer.score` already returns JSON-ready dicts and
`App/Schemas.py` already describes that payload, so the handlers below only
translate transport concerns - which model to use, how many tips to return, and
which exception becomes which status code. Product logic stays in `Src/`, where
the CLI (`python main.py score`) exercises the same code path.

**Run it as a package from the repo root**, never as a script:

    .venv/Scripts/python -m uvicorn App.Api:app --reload

`python App/Api.py` puts `App/` on `sys.path` instead of the repo root, so the
absolute `App.` and `Src.` imports below both fail with `ModuleNotFoundError`.

Error mapping, and why each one:

* `ValueError` -> **422**. `Src/Preprocessed.validate_raw` owns the two checks
  the wire format cannot make - `Gender` must be a class the stored
  `LabelEncoder` saw, `School_Grade` must carry a year number. Both are
  properties of `models/preprocessor.pkl`, so they are caller errors, not
  server faults.
* `FileNotFoundError` / `ImportError` -> **503**. A missing pickle or an absent
  `xgboost` is a deployment problem; the default `gb` model may still be
  serving, so the process should not die on a request for `xgb`.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from App.dependencies import get_scorer, warm
from App.Schemas import (
    ErrorResponse,
    HealthResponse,
    PredictRequest,
    PredictResponse,
)
from Src.inference import DEFAULT_MODEL


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the default scorer before the first request.

    Failing here is intentional - see `App.dependencies.warm`. An empty
    `models/` should stop the deployment, not surface as a 500 to a user.
    """
    warm()
    yield


app = FastAPI(
    title="Smartphone Addiction Warning API",
    version="1.0",
    description=(
        "Scores a raw teen record and returns a severity band, its cohort "
        "percentile and ranked advice. The band alone under-reports: the "
        "target is ceiling-censored, so read `percentile` alongside it."
    ),
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
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


@app.post(
    "/predict",
    response_model=PredictResponse,
    responses={422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def predict(payload: PredictRequest) -> PredictResponse:
    """Score every record in the request with one loaded model.

    The whole batch goes through `Scorer.score` in a single call - it accepts a
    list of dicts and `preprocess_new` engineers them as one frame, so this is
    both faster and identical to scoring them one by one.
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

    return PredictResponse(
        results=results,
        count=len(results),
        model_used=payload.model,
        tips=payload.tips,
    )


@app.get("/models")
def models() -> dict[str, object]:
    """Which regressors this deployment can actually serve.

    `xgb` is listed as available only where xgboost is importable, so a caller
    discovers the gap here rather than through a 503 on `/predict`.
    """
    available = []
    for name in ("rf", "gb", "xgb"):
        try:
            get_scorer(name)
        except (FileNotFoundError, ImportError):
            continue
        available.append(name)
    return {"available": available, "default": DEFAULT_MODEL}


@app.get("/")
def root() -> dict[str, str]:
    """Signpost only - the interactive schema at `/docs` is the real entry point."""
    return {
        "message": "Smartphone Addiction Warning System API is running",
        "docs": "/docs",
    }

