"""Every database read and write the API performs.

Kept out of `App/Api.py` for the same reason product logic is kept out of it:
the handlers should read as transport. These functions take a `Session` and
return ORM rows; they never touch FastAPI types, so they are callable from a
script or a test without a request.

They also never *score* anything - a result dict produced by
`Src.inference.Scorer.score` goes in, and persistence comes out. The scoring
path stays exactly where `python main.py score` exercises it.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from App.models import PredictionHistory
from Src.Preprocessed import REQUIRED_RAW_COLUMNS


def _row(
    record: Mapping[str, Any],
    result: Mapping[str, Any],
    model_name: str,
    tips: int,
) -> PredictionHistory:
    """Build one unsaved row from a request record and its scored result.

    Only `REQUIRED_RAW_COLUMNS` are copied across, so the extra keys `RawRecord`
    tolerates (`ID`, `Name`, `Location`, `Phone_Usage_Purpose`) are dropped here
    rather than becoming stray columns.
    """
    return PredictionHistory(
        **{name: record[name] for name in REQUIRED_RAW_COLUMNS},
        model_name=model_name,
        tips=tips,
        prediction_score=result["score"],
        band=result["band"],
        band_description=result["band_description"],
        percentile=result["percentile"],
        n_flagged=result["n_flagged"],
        recommendations=result["recommendations"],
    )


def log_predictions(
    db: Session,
    records: Sequence[Mapping[str, Any]],
    results: Sequence[Mapping[str, Any]],
    model_name: str,
    tips: int,
) -> list[PredictionHistory]:
    """Persist a whole scored batch in one transaction.

    `results` is positional with `records` - that is the contract
    `Scorer.score` already guarantees - so the two are zipped rather than
    matched on a key.
    """
    rows = [
        _row(record, result, model_name, tips)
        for record, result in zip(records, results)
    ]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def list_predictions(
    db: Session,
    limit: int = 50,
    offset: int = 0,
    band: str | None = None,
    model_name: str | None = None,
) -> tuple[list[PredictionHistory], int]:
    """Newest first, with the unpaginated total so a UI can show "x of y".

    The count is a separate query against the same filters; on a SQLite table
    of this size that is cheaper than fetching every row to measure it.
    """
    filters = []
    if band is not None:
        filters.append(PredictionHistory.band == band)
    if model_name is not None:
        filters.append(PredictionHistory.model_name == model_name)

    total = db.scalar(
        select(func.count()).select_from(PredictionHistory).where(*filters)
    )

    rows = db.scalars(
        select(PredictionHistory)
        .where(*filters)
        .order_by(PredictionHistory.timestamp.desc(), PredictionHistory.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return list(rows), int(total or 0)


def get_prediction(db: Session, record_id: int) -> PredictionHistory | None:
    """One row by primary key, or `None` - the caller decides that is a 404."""
    return db.get(PredictionHistory, record_id)


def delete_prediction(db: Session, record_id: int) -> bool:
    """Delete one row. `False` means it was not there, which is a 404."""
    row = db.get(PredictionHistory, record_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def clear_predictions(db: Session) -> int:
    """Delete every row, returning how many went. Used by `DELETE /api/history`."""
    deleted = db.execute(delete(PredictionHistory)).rowcount or 0
    db.commit()
    return int(deleted)


__all__ = [
    "clear_predictions",
    "delete_prediction",
    "get_prediction",
    "list_predictions",
    "log_predictions",
]
