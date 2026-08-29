

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

import joblib
import pandas as pd
from sklearn.preprocessing import LabelEncoder

try:  # package import: `from Src.Preprocessed import ...`, `from Src import ...`
    from .config import (
        Model_Artifacts_Path,
        Preprocessed_Data_Path,
        Preprocessor_Path,
        Raw_Data_Path,
    )
except ImportError:  # script import: `python Preprocessed.py` from inside Src/
    from config import (
        Model_Artifacts_Path,
        Preprocessed_Data_Path,
        Preprocessor_Path,
        Raw_Data_Path,
    )


# Free-text / identifier columns with no predictive value.
ID_COLUMNS = ["ID", "Name", "Location"]

# Columns where 0 reads as "not recorded" rather than a real measurement, and
# where a 0 would otherwise blow up the ratio features below. Imputed with the
# training-set mean, computed over the un-imputed column (zeros included).
ZERO_AS_MISSING = [
    "Daily_Usage_Hours",
    "Social_Interactions",
    "Exercise_Hours",
    "Parental_Control",
    "Screen_Time_Before_Bed",
    "Time_on_Social_Media",
    "Time_on_Gaming",
    "Time_on_Education",
    "Weekend_Usage_Hours",
]

# Affect scales that become z-scores, standardised against the training moments.
PSYCH_COLUMNS = ["Anxiety_Level", "Depression_Level", "Self_Esteem"]

# Raw predictors dropped once their engineered counterparts exist. `Age`,
# `Gender` and `Daily_Usage_Hours` survive as-is; everything else here is
# represented downstream by a ratio, difference or z-score.
RAW_COLUMNS_TO_DROP = [
    "School_Grade",
    "Sleep_Hours",
    "Academic_Performance",
    "Social_Interactions",
    "Exercise_Hours",
    "Anxiety_Level",
    "Depression_Level",
    "Self_Esteem",
    "Parental_Control",
    "Screen_Time_Before_Bed",
    "Phone_Checks_Per_Day",
    "Apps_Used_Daily",
    "Time_on_Social_Media",
    "Time_on_Gaming",
    "Time_on_Education",
    "Phone_Usage_Purpose",
    "Family_Communication",
    "Weekend_Usage_Hours",
]

# Every raw column a feature actually reads. `ID`, `Name`, `Location` and
# `Phone_Usage_Purpose` are dropped unused, so a new record may omit them.
REQUIRED_RAW_COLUMNS = [
    "Age",
    "Gender",
    "School_Grade",
    "Daily_Usage_Hours",
    "Sleep_Hours",
    "Academic_Performance",
    "Social_Interactions",
    "Exercise_Hours",
    "Anxiety_Level",
    "Depression_Level",
    "Self_Esteem",
    "Parental_Control",
    "Screen_Time_Before_Bed",
    "Phone_Checks_Per_Day",
    "Apps_Used_Daily",
    "Time_on_Social_Media",
    "Time_on_Gaming",
    "Time_on_Education",
    "Family_Communication",
    "Weekend_Usage_Hours",
]

# Divisors that are NOT zero-imputed. The raw data never puts a 0 here, but an
# API caller can, and the result would be a silent inf rather than an error.
POSITIVE_DENOMINATORS = ["Sleep_Hours", "Phone_Checks_Per_Day", "Apps_Used_Daily"]

TARGET = "Addiction_Level"


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #
def load_raw_data(path: Path | str = Raw_Data_Path) -> pd.DataFrame:
    """Load the raw Kaggle dataset (3000 rows x 25 cols)."""
    return pd.read_csv(path)


def load_preprocessed_data(path: Path | str = Preprocessed_Data_Path) -> pd.DataFrame:
    """Load the committed preprocessed dataset (3000 rows x 28 cols)."""
    return pd.read_csv(path)


def as_frame(
    records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]],
) -> pd.DataFrame:
    """Accept a frame, a single record dict, or a list of record dicts."""
    if isinstance(records, pd.DataFrame):
        return records
    if isinstance(records, Mapping):
        return pd.DataFrame([records])
    return pd.DataFrame(list(records))


def validate_raw(df: pd.DataFrame) -> None:
    """Fail loudly on input the feature formulas cannot honestly consume."""
    missing = [c for c in REQUIRED_RAW_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"missing required raw columns: {missing}")

    blank = [c for c in REQUIRED_RAW_COLUMNS if df[c].isna().any()]
    if blank:
        raise ValueError(f"raw columns contain nulls: {blank}")

    bad = [c for c in POSITIVE_DENOMINATORS if (df[c] <= 0).any()]
    if bad:
        raise ValueError(
            f"columns must be > 0 - they are divisors, and are not zero-imputed: {bad}"
        )


# --------------------------------------------------------------------------- #
# Cleaning
# --------------------------------------------------------------------------- #
# The helpers below mutate the frame they are handed. `transform()` copies once
# up front, so a caller's own frame is never touched.
def drop_identifiers(df: pd.DataFrame) -> pd.DataFrame:
    """Drop ID / Name / Location, if the frame carries them."""
    return df.drop(columns=ID_COLUMNS, errors="ignore")


def encode_gender(df: pd.DataFrame, classes: Sequence[str]) -> pd.DataFrame:
    """Label-encode `Gender` against the training classes (Female=0, Male=1, Other=2).

    Fitting a fresh `LabelEncoder` per call would renumber whichever categories
    happen to appear in the incoming frame, so the codes are read off the stored
    class list instead.
    """
    lookup = {label: code for code, label in enumerate(classes)}
    unknown = sorted(set(df["Gender"].unique()) - set(lookup))
    if unknown:
        raise ValueError(f"unseen Gender values {unknown}; training saw {list(classes)}")
    df["Gender"] = df["Gender"].map(lookup).astype(int)
    return df


def impute_zeros_with_mean(df: pd.DataFrame, means: Mapping[str, float]) -> pd.DataFrame:
    """Replace 0 with the training mean, so ratio denominators are never zero."""
    for col, mean in means.items():
        df[col] = df[col].replace(0, mean)
    return df


# --------------------------------------------------------------------------- #
# Feature engineering
# --------------------------------------------------------------------------- #
def add_usage_composition(df: pd.DataFrame) -> pd.DataFrame:
    """Slice `Daily_Usage_Hours` (r=0.60 with the target) into its components.

    Note: the synthetic source data lets the component times exceed the stated
    daily total, so `Untracked_Hours` goes negative and `Leisure_Ratio` exceeds
    1.0 on a large share of rows. Those are artifacts of the source data, not
    bugs - but the "residual browsing time" reading of these columns does not
    hold.
    """
    df["Tracked_Hours"] = (
        df["Time_on_Social_Media"] + df["Time_on_Gaming"] + df["Time_on_Education"]
    )
    df["Untracked_Hours"] = df["Daily_Usage_Hours"] - df["Tracked_Hours"]
    df["Leisure_Hours"] = df["Time_on_Social_Media"] + df["Time_on_Gaming"]
    df["Leisure_Ratio"] = df["Leisure_Hours"] / df["Daily_Usage_Hours"]
    df["Education_Ratio"] = df["Time_on_Education"] / df["Daily_Usage_Hours"]
    df["Social_vs_Gaming"] = df["Time_on_Social_Media"] - df["Time_on_Gaming"]
    return df


def add_weekend_behaviour(df: pd.DataFrame) -> pd.DataFrame:
    """Weekend spike vs. flat-high usage - a plausible compulsivity signal."""
    df["Weekend_Escalation"] = df["Weekend_Usage_Hours"] - df["Daily_Usage_Hours"]
    df["Weekend_Ratio"] = df["Weekend_Usage_Hours"] / df["Daily_Usage_Hours"]
    return df


def add_intensity(df: pd.DataFrame) -> pd.DataFrame:
    """Separate short compulsive checking from long immersive sessions.

    Low `Minutes_Per_Check` = constant short checks; high = fewer, longer
    sessions. Different behavioural profiles at the same total hours.
    """
    df["Minutes_Per_Check"] = (df["Daily_Usage_Hours"] * 60) / df["Phone_Checks_Per_Day"]
    df["Checks_Per_App"] = df["Phone_Checks_Per_Day"] / df["Apps_Used_Daily"]
    df["Hours_Per_App"] = df["Daily_Usage_Hours"] / df["Apps_Used_Daily"]
    return df


def add_sleep_displacement(df: pd.DataFrame) -> pd.DataFrame:
    """Sleep lost to screens. 9h is the teen recommendation, not 8."""
    df["Sleep_Deficit"] = (9 - df["Sleep_Hours"]).clip(lower=0)
    df["Screen_To_Sleep_Ratio"] = df["Daily_Usage_Hours"] / df["Sleep_Hours"]
    df["Bedtime_Screen_Share"] = df["Screen_Time_Before_Bed"] / df["Daily_Usage_Hours"]
    return df


def add_offline_displacement(df: pd.DataFrame) -> pd.DataFrame:
    """Offline life traded away for screen time."""
    df["Offline_Activity"] = df["Exercise_Hours"] + df["Social_Interactions"]
    df["Online_To_Offline_Ratio"] = df["Daily_Usage_Hours"] / df["Offline_Activity"]
    df["Family_To_Screen_Ratio"] = df["Family_Communication"] / df["Daily_Usage_Hours"]
    return df


def add_psychological_composite(
    df: pd.DataFrame, stats: Mapping[str, Mapping[str, float]]
) -> pd.DataFrame:
    """Z-score the three affect scales against the training moments, and combine them.

    `Self_Esteem` is reverse-coded, hence the subtraction in `Distress_Index`.
    A single new record has no spread of its own, so the mean and std have to
    come from `stats` rather than from the frame being transformed.
    """
    for col in PSYCH_COLUMNS:
        df[f"{col}_z"] = (df[col] - stats[col]["mean"]) / stats[col]["std"]
    df["Distress_Index"] = (
        df[["Anxiety_Level_z", "Depression_Level_z"]].mean(axis=1) - df["Self_Esteem_z"]
    )
    return df


def add_context(df: pd.DataFrame) -> pd.DataFrame:
    """Moderators: academic cost, supervision, school year.

    `Parental_Control` is nominally 0/1, but `impute_zeros_with_mean` has
    already replaced its zeros with the training mean, so `Unsupervised_Usage`
    ends up a graded weight rather than a clean on/off mask.
    """
    df["Academic_Per_Usage"] = df["Academic_Performance"] / df["Daily_Usage_Hours"]
    df["Unsupervised_Usage"] = df["Daily_Usage_Hours"] * (1 - df["Parental_Control"])
    # Ordinal - better than one-hot for a school year.
    grade = df["School_Grade"].astype(str).str.extract(r"(\d+)")[0]
    if grade.isna().any():
        unparsed = df.loc[grade.isna(), "School_Grade"].unique().tolist()
        raise ValueError(f"School_Grade values carry no year number: {unparsed}")
    df["Grade_Num"] = grade.astype(int)
    return df


def engineer_features(
    df: pd.DataFrame, psych_stats: Mapping[str, Mapping[str, float]]
) -> pd.DataFrame:
    """Run every feature block, in the order the notebook uses."""
    df = add_usage_composition(df)
    df = add_weekend_behaviour(df)
    df = add_intensity(df)
    df = add_sleep_displacement(df)
    df = add_offline_displacement(df)
    df = add_psychological_composite(df, psych_stats)
    df = add_context(df)
    return df


def drop_raw_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Drop the raw predictors now represented by engineered features."""
    return df.drop(columns=RAW_COLUMNS_TO_DROP, errors="ignore")


# --------------------------------------------------------------------------- #
# Fit / transform
# --------------------------------------------------------------------------- #
def _apply(df: pd.DataFrame, state: Mapping[str, Any]) -> pd.DataFrame:
    """The pipeline itself, without the output-column check `transform` adds."""
    out = df.copy()
    out = drop_identifiers(out)
    out = encode_gender(out, state["gender_classes"])
    out = impute_zeros_with_mean(out, state["zero_means"])
    out = engineer_features(out, state["psych_stats"])
    out = drop_raw_columns(out)
    return out


def fit(df: pd.DataFrame) -> dict[str, Any]:
    """Learn, from the training frame, every statistic `transform` needs."""
    validate_raw(df)
    state: dict[str, Any] = {
        "gender_classes": LabelEncoder().fit(df["Gender"]).classes_.tolist(),
        "zero_means": {col: float(df[col].mean()) for col in ZERO_AS_MISSING},
        "psych_stats": {
            col: {"mean": float(df[col].mean()), "std": float(df[col].std())}
            for col in PSYCH_COLUMNS
        },
    }
    columns = list(_apply(df, state).columns)
    state["output_columns"] = columns
    state["feature_columns"] = [c for c in columns if c != TARGET]
    return state


def transform(df: pd.DataFrame, state: Mapping[str, Any]) -> pd.DataFrame:
    """Raw frame in, model-ready frame out, using `state`. Does not mutate `df`.

    Columns come back in the training order, so the downstream `SelectKBest`
    sees the 27 features it was fitted on. The target rides along when the frame
    carries it and is simply absent for new records.
    """
    validate_raw(df)
    out = _apply(df, state)
    missing = [c for c in state["feature_columns"] if c not in out.columns]
    if missing:
        raise ValueError(f"pipeline did not produce expected features: {missing}")
    return out[[c for c in state["output_columns"] if c in out.columns]]


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Training path: fit on `df`, then transform it.

    For anything but the full training frame use `preprocess_new` - the
    statistics fitted here are only meaningful on a frame of that size.
    """
    return transform(df, fit(df))


def preprocess_new(
    records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]],
    state: Mapping[str, Any] | None = None,
) -> pd.DataFrame:
    """Preprocess unknown new data with the statistics saved at training time.

    Accepts a DataFrame, one record dict, or a list of record dicts. Loads
    `models/preprocessor.pkl` unless a `state` is passed in - an API should load
    it once at startup and hand it over on every call.
    """
    if state is None:
        state = load_preprocessor()
    return transform(as_frame(records), state)


# --------------------------------------------------------------------------- #
# Artifacts
# --------------------------------------------------------------------------- #
def save_preprocessor(
    state: Mapping[str, Any], path: Path | str = Preprocessor_Path
) -> Path:
    """Persist the fitted state so new records get the training statistics."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(dict(state), path)
    return path


def load_preprocessor(path: Path | str = Preprocessor_Path) -> dict[str, Any]:
    """Load the fitted state written by `build_preprocessed_dataset`."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found - run `python main.py preprocess` to fit and save it"
        )
    return joblib.load(path)


def to_model_matrix(
    features: pd.DataFrame, artifacts: Mapping[str, Any] | None = None
) -> pd.DataFrame:
    """Select and scale engineered features down to the 18 columns the models take.

    `features` is what `preprocess_new` returns; `artifacts` is the
    `{selector, scaler, features}` dict from `models/preprocessing.pkl`.

    Returned as a named frame so the 18 columns stay inspectable. Match the
    estimator when scoring, or sklearn warns on every call: the committed
    `models/*.pkl` came from the notebook and were fitted on bare arrays, so
    pass `X.to_numpy()`; anything written by `python main.py train --save` was
    fitted on a named frame, so pass `X` itself.
    """
    fitted: Mapping[str, Any] = (
        joblib.load(Model_Artifacts_Path) if artifacts is None else artifacts
    )
    selector, scaler, names = fitted["selector"], fitted["scaler"], fitted["features"]
    X = features.drop(columns=[TARGET], errors="ignore")
    X = X[list(selector.feature_names_in_)]
    selected = pd.DataFrame(selector.transform(X), columns=names, index=X.index)
    return pd.DataFrame(scaler.transform(selected), columns=names, index=X.index)


# --------------------------------------------------------------------------- #
# Pipeline
# --------------------------------------------------------------------------- #
def build_preprocessed_dataset(
    raw_path: Path | str = Raw_Data_Path,
    output_path: Path | str | None = Preprocessed_Data_Path,
    preprocessor_path: Path | str | None = Preprocessor_Path,
) -> pd.DataFrame:
    """Fit on the raw CSV, then write both the dataset and the fitted state."""
    raw = load_raw_data(raw_path)
    state = fit(raw)
    df = transform(raw, state)
    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_path, index=False)
    if preprocessor_path is not None:
        save_preprocessor(state, preprocessor_path)
    return df
