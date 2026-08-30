"""ORM tables for the API's SQLite database.

One table: every `/api/predict` call is appended to `prediction_history`, so the
frontend can list past runs, reload the inputs that produced one back into the
form, and delete rows it no longer wants.

**Column names deliberately break PEP 8.** They are the raw feature names the
pipeline uses - `Daily_Usage_Hours`, not `daily_usage_hours` - because that is
what makes the round trip free: a stored row's inputs are already a valid
`RawRecord` payload, so "reload this past run into the form" is a dict copy
rather than a mapping table that has to be kept in step with
`Src.Preprocessed.REQUIRED_RAW_COLUMNS`. The assertion at the bottom of this
file enforces exactly that, the same way `App/Schemas.py` guards its own fields.

The outputs are stored flattened (`prediction_score`, `band`, `percentile`,
`n_flagged`) because they are what a history list filters and sorts on, while
`recommendations` - a variable-length list of rule hits - is stored as JSON.
SQLite has no array type, and the column is only ever read back whole.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from App.database import Base
from Src.Preprocessed import REQUIRED_RAW_COLUMNS


def _utcnow() -> datetime:
    """Timezone-aware UTC. `datetime.utcnow` is deprecated and returns naive."""
    return datetime.now(timezone.utc)


class PredictionHistory(Base):
    """One scored record: what was asked, and what the model answered."""

    __tablename__ = "prediction_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
        index=True,  # the history list is ordered by this
    )

    # ---------------------------------------------------------------- inputs #
    # The 20 columns of `REQUIRED_RAW_COLUMNS`, in that order.
    Age: Mapped[int] = mapped_column(Integer, nullable=False)
    Gender: Mapped[str] = mapped_column(String(32), nullable=False)
    School_Grade: Mapped[str] = mapped_column(String(16), nullable=False)
    Daily_Usage_Hours: Mapped[float] = mapped_column(Float, nullable=False)
    Sleep_Hours: Mapped[float] = mapped_column(Float, nullable=False)
    Academic_Performance: Mapped[float] = mapped_column(Float, nullable=False)
    Social_Interactions: Mapped[float] = mapped_column(Float, nullable=False)
    Exercise_Hours: Mapped[float] = mapped_column(Float, nullable=False)
    Anxiety_Level: Mapped[float] = mapped_column(Float, nullable=False)
    Depression_Level: Mapped[float] = mapped_column(Float, nullable=False)
    Self_Esteem: Mapped[float] = mapped_column(Float, nullable=False)
    Parental_Control: Mapped[int] = mapped_column(Integer, nullable=False)
    Screen_Time_Before_Bed: Mapped[float] = mapped_column(Float, nullable=False)
    Phone_Checks_Per_Day: Mapped[int] = mapped_column(Integer, nullable=False)
    Apps_Used_Daily: Mapped[int] = mapped_column(Integer, nullable=False)
    Time_on_Social_Media: Mapped[float] = mapped_column(Float, nullable=False)
    Time_on_Gaming: Mapped[float] = mapped_column(Float, nullable=False)
    Time_on_Education: Mapped[float] = mapped_column(Float, nullable=False)
    Family_Communication: Mapped[float] = mapped_column(Float, nullable=False)
    Weekend_Usage_Hours: Mapped[float] = mapped_column(Float, nullable=False)

    # --------------------------------------------------------------- request #
    model_name: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    tips: Mapped[int] = mapped_column(Integer, nullable=False)

    # --------------------------------------------------------------- outputs #
    prediction_score: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    band: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    band_description: Mapped[str] = mapped_column(String, nullable=False)
    percentile: Mapped[float] = mapped_column(Float, nullable=False)
    n_flagged: Mapped[int] = mapped_column(Integer, nullable=False)
    # Ranked rule hits, exactly as `Src.inference.recommend` emitted them.
    # `JSON` serialises to TEXT on SQLite and to a real JSON column elsewhere.
    recommendations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )

    def raw_record(self) -> dict[str, Any]:
        """The stored inputs as a `RawRecord`-shaped dict.

        This is what "load these parameters back into the form" posts straight
        back to `/api/predict` - no renaming, because the columns are the raw
        feature names.
        """
        return {name: getattr(self, name) for name in REQUIRED_RAW_COLUMNS}

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<PredictionHistory id={self.id} score={self.prediction_score:.3f} "
            f"band={self.band!r} model={self.model_name!r}>"
        )


# The round trip `raw_record()` promises only holds while every required raw
# column is an actual column here. Checked at import, so adding a feature to the
# pipeline fails at startup instead of raising `AttributeError` per request.
_MISSING = [c for c in REQUIRED_RAW_COLUMNS if c not in PredictionHistory.__table__.columns]
if _MISSING:
    raise RuntimeError(
        f"PredictionHistory is missing raw feature columns: {_MISSING}. "
        "Add them, then recreate app.db - `create_all` will not alter a table."
    )


__all__ = ["PredictionHistory"]
