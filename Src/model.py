

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, cast

import joblib
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.linear_model import Lasso, LinearRegression, Ridge
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

try:  # package import: `from Src.model import ...`
    from .config import (
        K_BEST,
        Model_Artifacts_Path,
        Model_Path,
        Preprocessed_Data_Path,
        Seed,
        TEST_SIZE,
    )
    from .Preprocessed import TARGET
except ImportError:  # script import: `python model.py` from inside Src/
    from config import (
        K_BEST,
        Model_Artifacts_Path,
        Model_Path,
        Preprocessed_Data_Path,
        Seed,
        TEST_SIZE,
    )
    from Preprocessed import TARGET


# Winners of the full grid search: 1189 candidates, 5945 fits, ~21 min. Re-derive
# with `python main.py tune --save`, which writes `models/best_params.json` -
# gitignored, so *these constants are the tracked record of the search*, not the
# JSON. Keep the numbers below current if you change them.
# CV RMSE against the previous values: rid 1.0076 -> 1.0051, las 1.6135 -> 1.0058,
# rf 0.7033 -> 0.7007, gb 0.5312 -> 0.5138, xgb 0.5195 -> 0.4984. `lr` has nothing
# to tune - the search confirmed its defaults.
#
# NOTE: the pickles in `models/` predate these values. Run
# `python main.py train --save` to bring the artifacts back in step.
LINEAR_MODELS: dict[str, Any] = {
    "lr": LinearRegression(),
    # Default alpha=1.0 shrinks Lasso to the intercept, so it scored exactly the
    # mean baseline (R2 0.00). The grid had to be extended below the notebook's
    # 0.1 before it found anything that fits.
    "rid": Ridge(alpha=10.0, solver="sparse_cg", tol=1e-2),
    "las": Lasso(alpha=0.01, max_iter=1000, selection="cyclic", tol=1e-3),
}

ENSEMBLE_MODELS: dict[str, Any] = {
    "rf": RandomForestRegressor(
        bootstrap=True,
        max_depth=None,
        min_samples_leaf=2,
        min_samples_split=2,
        n_estimators=300,
        random_state=Seed,
    ),
    "gb": GradientBoostingRegressor(
        learning_rate=0.2,
        max_depth=3,
        min_samples_leaf=4,
        min_samples_split=10,
        n_estimators=300,
        random_state=Seed,
    ),
    "xgb": XGBRegressor(
        colsample_bytree=0.8,
        learning_rate=0.2,
        max_depth=3,
        n_estimators=300,
        subsample=0.8,
        random_state=Seed,
    ),
}

# Only these three are serialized - the linear models are reported as a sanity
# floor, not shipped.
SAVED_MODELS = list(ENSEMBLE_MODELS)


def make_models() -> dict[str, Any]:
    """Fresh unfitted copies of every model, linear first."""
    return {name: clone(m) for name, m in {**LINEAR_MODELS, **ENSEMBLE_MODELS}.items()}


# --------------------------------------------------------------------------- #
# Data
# --------------------------------------------------------------------------- #
def load_features(path: Path | str = Preprocessed_Data_Path) -> tuple[pd.DataFrame, pd.Series]:
    """Load the preprocessed CSV and split off the target."""
    df = pd.read_csv(path)
    return df.drop(columns=[TARGET]), df[TARGET]


def split_data(X: pd.DataFrame, y: pd.Series):
    """Hold out `TEST_SIZE` at `Seed`. Unstratified, as in the notebook."""
    return train_test_split(X, y, test_size=TEST_SIZE, random_state=Seed)


def get_data(path: Path | str = Preprocessed_Data_Path):
    """Load and split in one call -> X_train, X_test, y_train, y_test."""
    X, y = load_features(path)
    return split_data(X, y)


# --------------------------------------------------------------------------- #
# Feature selection and scaling - fitted on train, applied to test
# --------------------------------------------------------------------------- #
def feature_selection(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    k: int = K_BEST,
) -> tuple[pd.DataFrame, pd.DataFrame, SelectKBest]:
    """Keep the top `k` features by `f_regression`, scored on the training fold.

    Returns the two transformed frames and the fitted selector. Pandas output is
    kept on so the selected column names survive into the scaler and the
    permutation-importance plots.
    """
    selector = SelectKBest(f_regression, k=k)
    selector.set_output(transform="pandas")
    X_train_selected = cast(pd.DataFrame, selector.fit_transform(X_train, y_train))
    X_test_selected = cast(pd.DataFrame, selector.transform(X_test))
    return X_train_selected, X_test_selected, selector


def scale_data(
    X_train: pd.DataFrame, X_test: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame, StandardScaler]:
    """Standardise, fitting on the training fold only (see `14f0bfc`).

    Returns the two scaled frames and the fitted scaler.
    """
    scaler = StandardScaler()
    scaler.set_output(transform="pandas")
    X_train_scaled = cast(pd.DataFrame, scaler.fit_transform(X_train))
    X_test_scaled = cast(pd.DataFrame, scaler.transform(X_test))
    return X_train_scaled, X_test_scaled, scaler


def build_pipeline(model: Any, k: int = K_BEST) -> Pipeline:
    """select -> scale -> model, as one estimator.

    Used for honest cross-validation, where every fold has to refit selection
    and scaling, and as the shape the inference path should eventually take.
    """
    return Pipeline(
        [
            ("select", SelectKBest(f_regression, k=k)),
            ("scale", StandardScaler()),
            ("model", clone(model)),
        ]
    )


# --------------------------------------------------------------------------- #
# Training
# --------------------------------------------------------------------------- #
def train_models(
    X_train: pd.DataFrame, y_train: pd.Series, models: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Fit every model on the already selected+scaled training fold."""
    fitted = dict(models) if models is not None else make_models()
    for model in fitted.values():
        model.fit(X_train, y_train)
    return fitted


def prepare(
    k: int = K_BEST, path: Path | str = Preprocessed_Data_Path
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, SelectKBest, StandardScaler]:
    """Split, select and scale in the correct order.

    Returns `(X_train, X_test, y_train, y_test, selector, scaler)`.
    """
    X_train, X_test, y_train, y_test = get_data(path)
    X_train, X_test, selector = feature_selection(X_train, y_train, X_test, k=k)
    X_train, X_test, scaler = scale_data(X_train, X_test)
    return X_train, X_test, y_train, y_test, selector, scaler


# --------------------------------------------------------------------------- #
# Artifacts
# --------------------------------------------------------------------------- #
def save_artifacts(
    fitted: Mapping[str, Any],
    selector: SelectKBest,
    scaler: StandardScaler,
    out_dir: Path | str = Model_Path,
) -> list[Path]:
    """Write `preprocessing.pkl` and `model_{rf,gb,xgb}.pkl`.

    The estimators expect the selected, scaled columns - never the raw frame -
    so the fitted selector and scaler have to travel with them. This is the
    committed version of the notebook's cell 29.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []

    bundle_path = out_dir / Model_Artifacts_Path.name
    joblib.dump(
        {
            "selector": selector,
            "scaler": scaler,
            "features": list(selector.get_feature_names_out()),
        },
        bundle_path,
    )
    written.append(bundle_path)

    for name in SAVED_MODELS:
        path = out_dir / f"model_{name}.pkl"
        joblib.dump(fitted[name], path)
        written.append(path)
    return written


