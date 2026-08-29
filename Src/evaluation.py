"""Scoring and reporting for the Addiction_Level regressors.

Module form of cells 17-22 of `notebook/modelling.ipynb`. `Src/model.py` owns
the data, the estimators and the artifacts; everything that only *measures* a
fitted model lives here.

    python -m Src.evaluation            # metrics on the held-out test fold
    python -m Src.evaluation --cv       # add honest 5-fold CV over a Pipeline

Two tables come out of a plain run, and the second is the one to read.
`Addiction_Level` is capped at 10.0 with 50.8% of rows sitting exactly there,
so an overall R2 is flattered by a large block of rows any model gets right by
saturating. `non_ceiling_mask` restricts scoring to the rows underneath the cap.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Mapping

import numpy as np
import pandas as pd
from sklearn.metrics import (
    explained_variance_score,
    mean_absolute_error,
    mean_squared_error,
    median_absolute_error,
    r2_score,
)
from sklearn.model_selection import KFold, cross_val_score

try:  # package import: `python -m Src.evaluation`
    from .config import Preprocessed_Data_Path, Seed
    from .model import (
        ENSEMBLE_MODELS,
        K_BEST,
        LINEAR_MODELS,
        build_pipeline,
        load_features,
        prepare,
        train_models,
    )
except ImportError:  # script import: `python evaluation.py` from inside Src/
    from config import Preprocessed_Data_Path, Seed
    from model import (
        ENSEMBLE_MODELS,
        K_BEST,
        LINEAR_MODELS,
        build_pipeline,
        load_features,
        prepare,
        train_models,
    )


# `Addiction_Level` maxes out at 10.0; 1524 of 3000 rows (50.8%) sit exactly
# there. Metrics over the full test fold are not wrong, just easy.
CEILING = 10.0


def non_ceiling_mask(y: pd.Series) -> np.ndarray:
    """Rows below the 10.0 cap - the half of the data that is actually hard."""
    return (y < CEILING).to_numpy()


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #
def metric_row(y_true, y_pred, name: str) -> dict[str, Any]:
    """One row of the report. Mirrors cell 19 of `modelling.ipynb`.

    `bias` is the mean residual - negative means the model over-predicts, which
    is what the ceiling pushes it to do on the non-saturated rows.
    """
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    residual = y_true - y_pred
    return {
        "model": name,
        "MSE": mean_squared_error(y_true, y_pred),
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "MAE": mean_absolute_error(y_true, y_pred),
        "MedAE": median_absolute_error(y_true, y_pred),
        "R2": r2_score(y_true, y_pred),
        "ExplVar": explained_variance_score(y_true, y_pred),
        "bias": float(residual.mean()),
        "p90_abs": float(np.percentile(np.abs(residual), 90)),
        "max_abs": float(np.abs(residual).max()),
    }


def evaluate(
    fitted: Mapping[str, Any],
    X_test: pd.DataFrame,
    y_test: pd.Series,
    y_train: pd.Series,
    mask: np.ndarray | None = None,
) -> pd.DataFrame:
    """Score every fitted model against the mean-prediction baseline.

    `mask` restricts the *scoring* rows without refitting - pass
    `non_ceiling_mask(y_test)` to see how the models do once the saturated block
    is removed. The baseline predicts `y_train.mean()` for everything, so any
    model that fails to beat it has learned nothing.
    """
    y_true = y_test if mask is None else y_test[mask]
    baseline = np.full(len(y_true), y_train.mean())
    rows = [metric_row(y_true, baseline, "baseline_mean")]
    for name, model in fitted.items():
        pred = model.predict(X_test)
        rows.append(metric_row(y_true, pred if mask is None else pred[mask], name))
    return pd.DataFrame(rows).set_index("model")


def cross_validate_pipelines(
    X: pd.DataFrame,
    y: pd.Series,
    k: int = K_BEST,
    folds: int = 5,
    models: Mapping[str, Any] | None = None,
) -> pd.DataFrame:
    """5-fold RMSE with selection and scaling refit inside every fold.

    This is the honest number: no fold ever sees the statistics of its own
    validation rows. Compare it against the held-out test RMSE - here CV comes
    out *better*, which is what rules the notebook's fit-before-split order out
    as a source of inflation.
    """
    zoo = models if models is not None else {**LINEAR_MODELS, **ENSEMBLE_MODELS}
    cv = KFold(n_splits=folds, shuffle=True, random_state=Seed)
    rows = []
    for name, model in zoo.items():
        scores = -cross_val_score(
            build_pipeline(model, k=k),
            X,
            y,
            cv=cv,
            scoring="neg_root_mean_squared_error",
            n_jobs=-1,
        )
        rows.append({"model": name, "cv_RMSE": scores.mean(), "cv_std": scores.std()})
    return pd.DataFrame(rows).set_index("model")


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def show_table(title: str, table: pd.DataFrame, decimals: int = 4) -> None:
    """Print a titled, rounded table. Shared with `Src/tuning.py`."""
    print(f"\n{title}")
    print(table.round(decimals).to_string())


def report(
    k: int = K_BEST,
    path: Path | str = Preprocessed_Data_Path,
    cv: bool = False,
) -> dict[str, pd.DataFrame]:
    """Train, score and print every table. Returns them for programmatic use."""
    X_train, X_test, y_train, y_test, _, _ = prepare(k=k, path=path)
    print(
        f"train {X_train.shape} | test {X_test.shape} | "
        f"{k} features: {', '.join(list(X_train.columns)[:4])}, ..."
    )
    fitted = train_models(X_train, y_train)

    tables = {"overall": evaluate(fitted, X_test, y_test, y_train)}
    show_table("All test rows:", tables["overall"])

    mask = non_ceiling_mask(y_test)
    tables["non_ceiling"] = evaluate(fitted, X_test, y_test, y_train, mask=mask)
    show_table(
        f"Below the {CEILING} ceiling only ({int(mask.sum())} of {len(y_test)} test rows):",
        tables["non_ceiling"],
    )

    if cv:
        X, y = load_features(path)
        tables["cv"] = cross_validate_pipelines(X, y, k=k)
        show_table("Honest 5-fold CV (selection + scaling refit per fold):", tables["cv"])

    return tables


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument(
        "-k", type=int, default=K_BEST, help=f"features to keep (default {K_BEST})"
    )
    parser.add_argument(
        "--cv", action="store_true", help="also run honest 5-fold CV over a Pipeline"
    )
    args = parser.parse_args(argv)
    report(k=args.k, cv=args.cv)


if __name__ == "__main__":
    main()
