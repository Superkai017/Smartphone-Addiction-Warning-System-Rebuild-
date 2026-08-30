"""The wire format for `App/Api.py`.

Mirrors `Src.inference.Scorer.score` rather than restating it: `BAND_LABELS`,
`DEFAULT_MODEL`, `MAX_TIPS` and `RULES` are imported, so a new band, a new rule
or a change of default model reaches the OpenAPI schema without an edit here.
The request side does the same with `Src.Preprocessed.REQUIRED_RAW_COLUMNS` -
that list is what `validate_raw` checks, and it is asserted against the fields
below at import time so the two cannot drift silently.

Two validations are deliberately *not* expressed here:

* `Gender` is left a plain `str`. The classes are whatever the stored
  `LabelEncoder` in `models/preprocessor.pkl` saw, so a `Literal` would go stale
  the next time the preprocessor is refit. `validate_raw` owns that check and
  `Api.py` maps its `ValueError` to a 422 - the same status a `Literal` would
  have produced, from the one place that knows the answer.
* `School_Grade` is likewise a plain `str`; `preprocess_new` needs a year number
  inside it (`"9th"`), and that too is the preprocessor's business.

What *is* expressed here is what the wire format can decide alone: presence,
type, and the three divisors that must be positive because no zero-imputation
protects them downstream.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from Src.inference import BAND_LABELS, DEFAULT_MODEL, MAX_TIPS, RULES
from Src.Preprocessed import REQUIRED_RAW_COLUMNS

# `Src/inference.load_model` reads `models/model_{name}.pkl`, so the short names
# are the artifact names. Kept a Literal - unlike the gender classes these are
# fixed by the training code, not by a refitted pickle.
MODEL_NAMES = Literal["rf", "gb", "xgb"]


class RawRecord(BaseModel):
    """One teenager, in the raw column vocabulary of the source CSV.

    Extra keys are ignored, so a whole raw row - `ID`, `Name`, `Location`,
    `Phone_Usage_Purpose` included - can be posted unchanged; those four are
    dropped unused by the pipeline anyway.
    """

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "Age": 13,
                "Gender": "Female",
                "School_Grade": "9th",
                "Daily_Usage_Hours": 4.0,
                "Sleep_Hours": 6.1,
                "Academic_Performance": 78,
                "Social_Interactions": 5,
                "Exercise_Hours": 0.1,
                "Anxiety_Level": 10,
                "Depression_Level": 3,
                "Self_Esteem": 8,
                "Parental_Control": 0,
                "Screen_Time_Before_Bed": 1.4,
                "Phone_Checks_Per_Day": 86,
                "Apps_Used_Daily": 19,
                "Time_on_Social_Media": 3.6,
                "Time_on_Gaming": 1.7,
                "Time_on_Education": 1.2,
                "Family_Communication": 4,
                "Weekend_Usage_Hours": 8.7,
            }
        },
    )

    Age: int = Field(..., ge=0, description="Years.")
    Gender: str = Field(
        ...,
        description=(
            "Must be a class the stored LabelEncoder saw; an unseen value is a "
            "422 from `validate_raw`, not a schema error."
        ),
    )
    School_Grade: str = Field(..., description='Must carry a year number, e.g. "9th".')
    Daily_Usage_Hours: float = Field(..., ge=0)
    # The three divisors. `Src.Preprocessed.POSITIVE_DENOMINATORS` excludes them
    # from zero-imputation, so a 0 here would divide rather than be corrected.
    Sleep_Hours: float = Field(..., gt=0, description="Divisor - must exceed 0.")
    Phone_Checks_Per_Day: int = Field(..., gt=0, description="Divisor - must exceed 0.")
    Apps_Used_Daily: int = Field(..., gt=0, description="Divisor - must exceed 0.")
    Academic_Performance: float = Field(..., ge=0)
    Social_Interactions: float = Field(..., ge=0)
    Exercise_Hours: float = Field(..., ge=0)
    Anxiety_Level: float = Field(..., ge=0)
    Depression_Level: float = Field(..., ge=0)
    Self_Esteem: float = Field(..., ge=0)
    Parental_Control: int = Field(..., ge=0, le=1, description="Binary flag, not a count.")
    Screen_Time_Before_Bed: float = Field(..., ge=0)
    Time_on_Social_Media: float = Field(..., ge=0)
    Time_on_Gaming: float = Field(..., ge=0)
    Time_on_Education: float = Field(..., ge=0)
    Family_Communication: float = Field(..., ge=0)
    Weekend_Usage_Hours: float = Field(..., ge=0)


# The contract `validate_raw` enforces at runtime, checked once at import so a
# column added to the pipeline fails here rather than as a 422 on every request.
_MISSING = [c for c in REQUIRED_RAW_COLUMNS if c not in RawRecord.model_fields]
if _MISSING:
    raise RuntimeError(
        f"RawRecord is missing raw columns the pipeline requires: {_MISSING}"
    )


class PredictRequest(BaseModel):
    """A batch of records, one model, one tip cap for the whole batch."""

    records: list[RawRecord] = Field(..., min_length=1)
    model: MODEL_NAMES = Field(
        default=DEFAULT_MODEL,
        description=(
            "Short artifact name. `xgb` scores marginally better where xgboost "
            "is installed; a deployment without it answers 503 - see /models."
        ),
    )
    tips: int = Field(
        default=MAX_TIPS,
        ge=1,
        le=len(RULES),
        description=(
            f"How many recommendations to return per record, ranked worst-first "
            f"({len(RULES)} rules exist). `n_flagged` reports how many fired "
            f"before the cap."
        ),
    )


class Recommendation(BaseModel):
    """One triggered rule, as `Src.inference.recommend` emits it."""

    feature: str
    value: float
    threshold: float = Field(..., description="The calibrated cut, from thresholds.json.")
    direction: Literal["high", "low"]
    percentile: float = Field(..., description="Where this value sits in the cohort.")
    severity: float = Field(
        ...,
        description="Ranking key: the percentile, inverted for 'low' rules.",
    )
    message: str


class PredictionResult(BaseModel):
    """One record's warning - the payload `Scorer.score` returns per row."""

    score: float = Field(..., description="Predicted Addiction_Level, 1.0-10.0.")
    band: Literal[BAND_LABELS] = Field(  # type: ignore[valid-type]
        ..., description="Severity band, from cuts calibrated on non-ceiling rows."
    )
    band_description: str
    percentile: float = Field(
        ...,
        description=(
            "Read this alongside the band. The target is ceiling-censored, so "
            "63% of predictions land in the top band and a 'Severe' can sit at "
            "the 37th percentile - the band alone over-reports."
        ),
    )
    model: str = Field(..., description="Which regressor produced the score.")
    n_flagged: int = Field(
        ..., description="Rules triggered before `tips` truncated the list."
    )
    recommendations: list[Recommendation]


class PredictResponse(BaseModel):
    """Full response for /predict. `results` is positional with `records`."""

    results: list[PredictionResult]
    count: int
    model_used: str
    tips: int


class HealthResponse(BaseModel):
    """Never an error - a failed load is reported, not raised. See `Api.health`."""

    status: Literal["ok", "degraded"]
    model_loaded: bool
    default_model: str = DEFAULT_MODEL
    version: str = "1.0"


class ErrorResponse(BaseModel):
    detail: str


__all__ = [
    "ErrorResponse",
    "HealthResponse",
    "MODEL_NAMES",
    "PredictRequest",
    "PredictResponse",
    "PredictionResult",
    "RawRecord",
    "Recommendation",
]
