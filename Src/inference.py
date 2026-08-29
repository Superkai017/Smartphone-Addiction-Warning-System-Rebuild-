"""Turn a predicted score into a warning: severity band, cohort percentile, advice.

`Src/model.py` stops at a number. A warning system has to say what that number
*means* - which band it falls in, how unusual it is, and what to do about it -
and that is the gap this module fills. It is the last stage before an HTTP
layer: `Scorer.score` returns JSON-ready dicts, so a FastAPI handler stays a
thin wrapper instead of becoming the place product logic accumulates.

**No threshold in this file is a guess.** `fit_thresholds` derives every cut
point from the training distribution and `python main.py calibrate` writes them
to `models/thresholds.json`; the constants below carry only wording and
direction. The prototype this replaces (`modelling.ipynb` cell 28) hardcoded its
numbers, and measured against the real distribution they were wrong in both
directions - `Academic_Per_Usage < 0.2` could never fire at all (the feature
runs 11-29) while `Weekend_Ratio > 0.6` fired on 90.6% of the cohort. Deriving
them from quantiles removes that whole class of error, and makes the thresholds
follow the data when preprocessing changes instead of silently going stale.

`xgboost` is deliberately not imported at module scope, so an API scoring with
the sklearn `gb` default never pays for a training dependency - the same rule
`Src/__init__.py` follows. `load_model("xgb")` still works wherever it is
installed.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

import joblib
import numpy as np
import pandas as pd

try:  # package import: `from Src.inference import ...`
    from .config import Model_Path, Preprocessed_Data_Path, Thresholds_Path
    from .Preprocessed import (
        TARGET,
        load_preprocessor,
        preprocess_new,
        to_model_matrix,
    )
except ImportError:  # script import: `python inference.py` from inside Src/
    from config import Model_Path, Preprocessed_Data_Path, Thresholds_Path
    from Preprocessed import (
        TARGET,
        load_preprocessor,
        preprocess_new,
        to_model_matrix,
    )


# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #
# Four bands, three cut points between them. Ordered worst-last, so
# `BAND_LABELS.index(band)` is itself a severity rank.
BAND_LABELS = ("Normal", "Moderate", "Addicted", "Severe")

BAND_BLURB = {
    "Normal": "minimal signs; usage sits in the lower quarter of the cohort.",
    "Moderate": "early signs of excess usage; below the cohort midpoint.",
    "Addicted": "usage patterns consistent with behavioural dependency.",
    "Severe": "high severity; usage dominates sleep, study and offline time.",
}

# Rules carry a direction and a message. The *threshold* is calibrated, not
# written here - see the module docstring.
#
# 'high' flags a value above the calibrated cut, 'low' one below it. Only 14 of
# the 18 model features get a rule: `Tracked_Hours`, `Untracked_Hours`,
# `Leisure_Hours` and `Social_vs_Gaming` are omitted because the component times
# they are built from exceed the stated daily total in half the source rows, so
# a message phrased in hours would be describing an artifact of the synthetic
# data. The ratio features resting on the same arithmetic (`Leisure_Ratio`
# especially, which exceeds 1.0 in 1025 rows) survive only because a quantile
# cut still ranks people correctly where the absolute scale is meaningless - so
# their message text says "relative to peers" and never asserts an hour count.
RULES: tuple[tuple[str, str, str], ...] = (
    ("Daily_Usage_Hours", "high",
     "Daily use is in the cohort's top quartile - set a screen-time budget and turn on app timers."),
    ("Leisure_Ratio", "high",
     "Usage skews recreational relative to peers - swap some leisure sessions for offline hobbies."),
    ("Education_Ratio", "low",
     "Little usage goes toward learning - carve out dedicated study blocks."),
    ("Weekend_Escalation", "high",
     "Usage climbs sharply at weekends - plan offline weekend activities in advance."),
    ("Weekend_Ratio", "high",
     "Weekends are especially screen-heavy - introduce a weekend no-phone window."),
    ("Minutes_Per_Check", "low",
     "The phone is picked up very frequently - turn off non-essential notifications."),
    ("Hours_Per_App", "low",
     "Attention is spread thin across many apps - declutter the ones rarely needed."),
    ("Sleep_Deficit", "high",
     "Sleep is being cut into - set a hard device curfew before bed."),
    ("Screen_To_Sleep_Ratio", "high",
     "Screen time is large relative to sleep - prioritise sleep hygiene, cut late-night use."),
    ("Bedtime_Screen_Share", "high",
     "Much of the usage lands right before bed - charge the phone outside the bedroom."),
    ("Online_To_Offline_Ratio", "high",
     "Online activity dominates offline activity - schedule regular in-person time."),
    ("Family_To_Screen_Ratio", "low",
     "Little family time relative to screen time - build in device-free family blocks."),
    ("Academic_Per_Usage", "low",
     "Usage is not translating into academic benefit - check whether it displaces schoolwork."),
    ("Unsupervised_Usage", "high",
     "Most usage happens unsupervised - encourage more shared or monitored use."),
)

RULED_FEATURES = [feature for feature, _, _ in RULES]

# Quantiles the cut points are taken from. A 'high' rule fires above the 75th
# percentile and a 'low' rule below the 25th, so by construction each rule flags
# roughly a quarter of the cohort rather than 0% or 90% of it.
HIGH_Q = 0.75
LOW_Q = 0.25

# Advice that fires on everything discriminates nothing. The prototype printed
# 14 tips for one teenager; this caps the list and ranks by how extreme the
# value actually is.
MAX_TIPS = 3

# Sklearn-only, so importing this module never drags in xgboost. `xgb` scores
# marginally better (test MSE 0.2478 vs 0.2675) where the dependency is present.
DEFAULT_MODEL = "gb"


# --------------------------------------------------------------------------- #
# Calibration
# --------------------------------------------------------------------------- #
def _quantile_grid(series: pd.Series, points: int = 101) -> list[float]:
    """Sample a series' quantile function so a percentile can be interpolated later.

    Cheaper to store and to read than a full ECDF, and 101 points is finer than
    the advice needs - the ranking only has to order 14 features.
    """
    qs = np.linspace(0.0, 1.0, points)
    return [float(v) for v in series.quantile(qs).to_numpy()]


def fit_thresholds(
    df: pd.DataFrame, high_q: float = HIGH_Q, low_q: float = LOW_Q
) -> dict[str, Any]:
    """Derive every cut point in the warning layer from the training frame.

    Two things get calibrated, and they go stale for different reasons:

    * **Band cuts**, from the target. They depend only on `Addiction_Level`,
      which no retrain changes - so re-running after a tuning pass is pointless.
    * **Rule thresholds**, from the engineered feature quantiles. These *do*
      move when a preprocessing formula changes, so recalibrate after any edit
      to `Src/Preprocessed.py`.

    The band cuts come from the **non-ceiling** rows on purpose. 50.8% of the
    target sits exactly at 10.0, which puts the median there too, so quartiles
    of the full target degenerate to `[8.0, 10.0, 10.0]` - two identical edges
    and an empty band. Taking them from the 1476 uncensored rows instead gives
    `[6.7, 8.0, 9.0]`, which spreads the bottom three bands evenly (12.5 / 12.5
    / 12.1%) where the hardcoded 4/6/9 left them nearly empty (1.4 / 6.4%).

    What this does **not** fix: the top band still holds 62.8% of the cohort. No
    absolute cut can change that - it is ceiling censoring in the source data,
    not a threshold mistake. `percentile` is the field that separates a
    borderline "Severe" from a genuine one; report it alongside the band.
    """
    y = df[TARGET]
    ceiling = float(y.max())
    uncensored = y[y < ceiling]

    cuts = [float(np.round(uncensored.quantile(q), 3)) for q in (0.25, 0.50, 0.75)]
    if len(set(cuts)) != len(cuts):  # guards a future change in the data's shape
        raise ValueError(
            f"band cut points are not distinct: {cuts}. The target distribution has "
            f"changed shape; pick cuts by hand rather than from quantiles."
        )

    thresholds: dict[str, dict[str, float]] = {}
    for feature, direction, _ in RULES:
        q = high_q if direction == "high" else low_q
        thresholds[feature] = {
            "quantile": float(q),
            "value": float(np.round(df[feature].quantile(q), 4)),
        }

    return {
        "target": TARGET,
        "n_rows": int(len(df)),
        "score_range": [float(y.min()), ceiling],
        "ceiling_share": float(np.round((y >= ceiling).mean(), 4)),
        "band_labels": list(BAND_LABELS),
        "band_cuts": cuts,
        "rule_quantiles": {"high": float(high_q), "low": float(low_q)},
        "rule_thresholds": thresholds,
        "score_grid": _quantile_grid(y),
        "feature_grids": {f: _quantile_grid(df[f]) for f in RULED_FEATURES},
    }


def save_thresholds(
    calibration: Mapping[str, Any], path: Path | str = Thresholds_Path
) -> Path:
    """Write the calibration as readable JSON.

    JSON rather than a pickle because these are numbers a human should be able
    to review in a diff - a band cut moving from 8.0 to 6.7 changes what every
    user is told, and that should not be invisible inside a binary.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(dict(calibration), indent=2), encoding="utf-8")
    return path


def load_thresholds(path: Path | str = Thresholds_Path) -> dict[str, Any]:
    """Load the calibration written by `python main.py calibrate --save`."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found - run `python main.py calibrate --save` to fit and write it"
        )
    return json.loads(path.read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Banding
# --------------------------------------------------------------------------- #
def classify(score: float, cuts: Sequence[float]) -> str:
    """Map a score to its band label. Cuts are exclusive upper bounds."""
    index = int(np.searchsorted(np.asarray(cuts, dtype=float), score, side="right"))
    return BAND_LABELS[index]


def percentile_of(value: float, grid: Sequence[float]) -> float:
    """Where `value` sits in a distribution summarised by a 0-100 quantile grid.

    Returned 0-100. Interpolates between grid points, and because the grid runs
    flat wherever the distribution piles up, a value on a plateau is reported at
    the *middle* of it rather than at either edge - which is what stops every
    ceiling score from claiming the 100th percentile when half the cohort shares
    it.
    """
    arr = np.asarray(grid, dtype=float)
    pct = np.linspace(0.0, 100.0, len(arr))
    low = float(np.interp(value, arr, pct, left=0.0, right=100.0))
    # The same interpolation on negated, reversed arrays finds the far end of a
    # plateau; the midpoint of the two is the honest rank.
    high = 100.0 - float(np.interp(-value, -arr[::-1], pct, left=0.0, right=100.0))
    return float(np.round((low + high) / 2.0, 1))


# --------------------------------------------------------------------------- #
# Advice
# --------------------------------------------------------------------------- #
def recommend(
    features: Mapping[str, float],
    calibration: Mapping[str, Any],
    limit: int = MAX_TIPS,
) -> list[dict[str, Any]]:
    """Rank the triggered rules by how extreme the value is, return the worst `limit`.

    Severity is the value's cohort percentile, inverted for 'low' rules, so a
    feature at the 99th percentile outranks one that only just crossed the 75th.
    Ranking is what makes the cap safe: truncating an *unordered* list would
    drop the worst finding as readily as the mildest.

    Pass `limit=len(RULES)` for the full set - the count, not the text, is what
    a caller usually wants.
    """
    thresholds = calibration["rule_thresholds"]
    grids = calibration["feature_grids"]

    flagged: list[dict[str, Any]] = []
    for feature, direction, message in RULES:
        if feature not in features:
            continue
        value = float(features[feature])
        cut = float(thresholds[feature]["value"])
        triggered = value > cut if direction == "high" else value < cut
        if not triggered:
            continue
        pct = percentile_of(value, grids[feature])
        flagged.append(
            {
                "feature": feature,
                "value": float(np.round(value, 4)),
                "threshold": cut,
                "direction": direction,
                "percentile": pct,
                "severity": float(np.round(pct if direction == "high" else 100.0 - pct, 1)),
                "message": message,
            }
        )

    flagged.sort(key=lambda tip: tip["severity"], reverse=True)
    return flagged[:limit]


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #
def load_model(name: str = DEFAULT_MODEL, model_dir: Path | str = Model_Path) -> Any:
    """Load one fitted regressor by short name (`rf`, `gb`, `xgb`)."""
    path = Path(model_dir) / f"model_{name}.pkl"
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found - run `python main.py train --save` to write it"
        )
    return joblib.load(path)


def _predict(model: Any, X: pd.DataFrame) -> np.ndarray:
    """Predict, matching how the estimator was fitted.

    The committed pickles came from the notebook and were fitted on bare arrays;
    anything from `python main.py train --save` was fitted on a named frame.
    Passing the wrong one warns on every call, so read it off the estimator
    rather than hardcoding either - this module has to keep working across the
    retrain that replaces those artifacts.
    """
    matrix = X if hasattr(model, "feature_names_in_") else X.to_numpy()
    return np.asarray(model.predict(matrix))


@dataclass
class Scorer:
    """Everything needed to score a record, loaded once.

    An API builds this at startup and calls `score` per request, so the four
    artifacts are read from disk once rather than on every call.
    """

    state: Mapping[str, Any]
    artifacts: Mapping[str, Any]
    model: Any
    calibration: Mapping[str, Any]
    model_name: str = DEFAULT_MODEL

    @classmethod
    def load(
        cls,
        model_name: str = DEFAULT_MODEL,
        model_dir: Path | str = Model_Path,
        thresholds_path: Path | str = Thresholds_Path,
    ) -> "Scorer":
        return cls(
            state=load_preprocessor(),
            artifacts=joblib.load(Path(model_dir) / "preprocessing.pkl"),
            model=load_model(model_name, model_dir),
            calibration=load_thresholds(thresholds_path),
            model_name=model_name,
        )

    def score(
        self,
        records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]],
        limit: int = MAX_TIPS,
    ) -> list[dict[str, Any]]:
        """Raw record(s) -> one JSON-ready warning per row.

        Accepts whatever `preprocess_new` accepts: a dict, a list of dicts or a
        frame. Always returns a list, so a caller handling a single record
        indexes `[0]` rather than branching on the input shape.
        """
        engineered = preprocess_new(records, self.state)
        X = to_model_matrix(engineered, self.artifacts)

        low, high = self.calibration["score_range"]
        scores = np.clip(_predict(self.model, X), low, high)

        cuts = self.calibration["band_cuts"]
        grid = self.calibration["score_grid"]

        out: list[dict[str, Any]] = []
        for (_, row), score in zip(engineered.iterrows(), scores):
            band = classify(float(score), cuts)
            values = row.to_dict()
            ranked = recommend(values, self.calibration, limit=len(RULES))
            out.append(
                {
                    "score": float(np.round(score, 3)),
                    "band": band,
                    "band_description": BAND_BLURB[band],
                    "percentile": percentile_of(float(score), grid),
                    "model": self.model_name,
                    "n_flagged": len(ranked),
                    "recommendations": ranked[:limit],
                }
            )
        return out


def score_records(
    records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]],
    model_name: str = DEFAULT_MODEL,
    limit: int = MAX_TIPS,
) -> list[dict[str, Any]]:
    """One-shot wrapper. Reloads every artifact - use `Scorer` in a service."""
    return Scorer.load(model_name).score(records, limit=limit)


def calibrate(
    data_path: Path | str = Preprocessed_Data_Path,
    high_q: float = HIGH_Q,
    low_q: float = LOW_Q,
) -> dict[str, Any]:
    """Read the training frame and fit the calibration. `main.py calibrate` calls this."""
    return fit_thresholds(pd.read_csv(data_path), high_q=high_q, low_q=low_q)
