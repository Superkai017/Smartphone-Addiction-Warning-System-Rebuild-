"""Preprocessing pipeline for the teen phone addiction dataset.

Script form of `notebook/preprocessed.ipynb`: reads the raw Kaggle CSV, drops
identifiers, label-encodes `Gender`, imputes zero-valued measurements with the
column mean, engineers 24 features, then drops the raw predictors it derived
them from.

Running this module rewrites `data/Preprocessed Data/preprocessed_data.csv`:

    python -m Src.Preprocessed

Scaling is deliberately NOT done here. It belongs after the train/test split so
the test fold does not leak into the fitted scaler - see `notebook/modelling.ipynb`.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.preprocessing import LabelEncoder

try:  # package import: `python -m Src.Preprocessed`, `from Src import ...`
    from .config import Preprocessed_Data_Path, Raw_Data_Path
except ImportError:  # script import: `python Preprocessed.py` from inside Src/
    from config import Preprocessed_Data_Path, Raw_Data_Path


# Free-text / identifier columns with no predictive value.
ID_COLUMNS = ["ID", "Name", "Location"]

# Columns where 0 reads as "not recorded" rather than a real measurement, and
# where a 0 would otherwise blow up the ratio features below. Imputed with the
# column mean, computed over the un-imputed column (zeros included).
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


# --------------------------------------------------------------------------- #
# Cleaning
# --------------------------------------------------------------------------- #
# The helpers below mutate the frame they are handed. `preprocess()` copies once
# up front, so a caller's own frame is never touched.
def drop_identifiers(df: pd.DataFrame) -> pd.DataFrame:
    """Drop ID / Name / Location."""
    return df.drop(columns=ID_COLUMNS)


def encode_gender(df: pd.DataFrame) -> pd.DataFrame:
    """Label-encode `Gender` (alphabetical: Female=0, Male=1, ...)."""
    df["Gender"] = LabelEncoder().fit_transform(df["Gender"])
    return df


def impute_zeros_with_mean(
    df: pd.DataFrame, columns: list[str] = ZERO_AS_MISSING
) -> pd.DataFrame:
    """Replace 0 with the column mean, so ratio denominators are never zero."""
    for col in columns:
        df[col] = df[col].replace(0, df[col].mean())
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


def add_psychological_composite(df: pd.DataFrame) -> pd.DataFrame:
    """Z-score the three affect scales and combine them.

    `Self_Esteem` is reverse-coded, hence the subtraction in `Distress_Index`.
    The z-scores use full-frame mean/std, matching the notebook; if these
    features ever move behind the train/test split, refit them on train only.
    """
    for col in ["Anxiety_Level", "Depression_Level", "Self_Esteem"]:
        df[f"{col}_z"] = (df[col] - df[col].mean()) / df[col].std()
    df["Distress_Index"] = (
        df[["Anxiety_Level_z", "Depression_Level_z"]].mean(axis=1) - df["Self_Esteem_z"]
    )
    return df


def add_context(df: pd.DataFrame) -> pd.DataFrame:
    """Moderators: academic cost, supervision, school year.

    `Parental_Control` is nominally 0/1, but `impute_zeros_with_mean` has
    already replaced its zeros with the column mean, so `Unsupervised_Usage`
    ends up a graded weight rather than a clean on/off mask.
    """
    df["Academic_Per_Usage"] = df["Academic_Performance"] / df["Daily_Usage_Hours"]
    df["Unsupervised_Usage"] = df["Daily_Usage_Hours"] * (1 - df["Parental_Control"])
    # Ordinal - better than one-hot for a school year.
    df["Grade_Num"] = df["School_Grade"].str.extract(r"(\d+)").astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Run every feature block, in the order the notebook uses."""
    for step in (
        add_usage_composition,
        add_weekend_behaviour,
        add_intensity,
        add_sleep_displacement,
        add_offline_displacement,
        add_psychological_composite,
        add_context,
    ):
        df = step(df)
    return df


def drop_raw_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Drop the raw predictors now represented by engineered features."""
    return df.drop(columns=RAW_COLUMNS_TO_DROP)


# --------------------------------------------------------------------------- #
# Pipeline
# --------------------------------------------------------------------------- #
def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Raw frame in, model-ready frame out. Does not mutate `df`."""
    out = df.copy()
    out = drop_identifiers(out)
    out = encode_gender(out)
    out = impute_zeros_with_mean(out)
    out = engineer_features(out)
    out = drop_raw_columns(out)
    return out


def build_preprocessed_dataset(
    raw_path: Path | str = Raw_Data_Path,
    output_path: Path | str | None = Preprocessed_Data_Path,
) -> pd.DataFrame:
    """Run the pipeline end to end and, unless `output_path` is None, write it."""
    df = preprocess(load_raw_data(raw_path))
    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_path, index=False)
    return df


def main() -> None:
    df = build_preprocessed_dataset()
    print(f"wrote {df.shape[0]} rows x {df.shape[1]} cols -> {Preprocessed_Data_Path}")
    print(f"NaNs: {int(df.isna().sum().sum())}")


if __name__ == "__main__":
    main()
