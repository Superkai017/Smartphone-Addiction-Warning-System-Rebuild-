"""Hyperparameter search for the Addiction_Level regressors.

Module form of cells 12 and 14 of `notebook/modelling.ipynb`, which are
commented out there because a full grid takes ~20 minutes. The winners are
hardcoded in `Src/model.py`; this is the code that re-derives them.

    python -m Src.tuning                    # full grid over all six models
    python -m Src.tuning --models gb xgb    # just those two
    python -m Src.tuning --random 40        # 40 random draws per model instead
    python -m Src.tuning --save             # write models/best_params.json

**Searching a Pipeline, not a matrix.** The notebook searches on
`X_new_train`, which was already selected and scaled using the whole dataset.
Here each candidate is `build_pipeline(model)`, so every CV fold refits
`SelectKBest` and `StandardScaler` on its own training rows. Scores are
therefore a little worse than the notebook's and a lot more honest. Parameters
are declared bare (`n_estimators`) and prefixed with `model__` on the way in, so
the grids below stay readable and the winners drop straight back into
`Src/model.py`.

**Three grid entries from the notebook were invalid** and would have scored
`NaN` for every candidate that touched them:

- `Ridge(positive=True)` accepts only `solver="lbfgs"`, and `lbfgs` in turn
  requires `positive=True`. The notebook crosses `positive: [True, False]` with
  seven solvers that exclude `lbfgs`, so every `positive=True` row raises. Split
  into two grids here.
- `Lasso(max_iter=None)` fails validation - `max_iter` must be a positive int.
  Dropped `None`.
- `Lasso(alpha=1.0)`, the smallest value the notebook searches, already
  regularises every coefficient to zero: it scores exactly the mean baseline
  (R2 0.00). The grid needed to extend *downward*, not upward.

`copy_X` is deliberately absent. It is a memory-management flag, not a
hyperparameter, and a `copy_X=False` winner centres the training matrix in place
while the test matrix is left alone - the defect fixed in `377f228`.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np
import pandas as pd
from sklearn.exceptions import ConvergenceWarning
from sklearn.model_selection import GridSearchCV, KFold, RandomizedSearchCV, cross_val_score

try:  # package import: `python -m Src.tuning`
    from .config import Best_Params_Path, Seed
    from .model import ENSEMBLE_MODELS, K_BEST, LINEAR_MODELS, build_pipeline, get_data
except ImportError:  # script import: `python tuning.py` from inside Src/
    from config import Best_Params_Path, Seed
    from model import ENSEMBLE_MODELS, K_BEST, LINEAR_MODELS, build_pipeline, get_data


SCORING = "neg_root_mean_squared_error"

# A search grid per model. A *list* of dicts means "these regions", which is how
# the two mutually exclusive Ridge configurations are expressed.
GRIDS: dict[str, list[dict[str, list[Any]]]] = {
    "lr": [
        {
            "fit_intercept": [True, False],
            "positive": [True, False],
        }
    ],
    "rid": [
        {
            "alpha": [0.1, 1.0, 10.0],
            "fit_intercept": [True, False],
            "max_iter": [None, 1000, 5000],
            "tol": [1e-4, 1e-3, 1e-2],
            "solver": ["auto", "svd", "cholesky", "lsqr", "sparse_cg", "sag", "saga"],
            "positive": [False],
        },
        {  # lbfgs is the only solver that supports positive=True, and vice versa
            "alpha": [0.1, 1.0, 10.0],
            "fit_intercept": [True, False],
            "max_iter": [None, 1000, 5000],
            "tol": [1e-4, 1e-3, 1e-2],
            "solver": ["lbfgs"],
            "positive": [True],
        },
    ],
    "las": [
        {
            # extended below the notebook's 0.1: at alpha=1.0 Lasso is already
            # fully shrunk to the intercept and scores the mean baseline.
            "alpha": [0.0001, 0.001, 0.01, 0.1, 1.0],
            "fit_intercept": [True, False],
            "max_iter": [1000, 5000],
            "tol": [1e-4, 1e-3, 1e-2],
            "selection": ["cyclic", "random"],
            "positive": [True, False],
        }
    ],
    "rf": [
        {
            "n_estimators": [100, 200, 300],
            "max_depth": [None, 10, 20],
            "min_samples_split": [2, 5, 10],
            "min_samples_leaf": [1, 2, 4],
            "bootstrap": [True, False],
        }
    ],
    "gb": [
        {
            "n_estimators": [100, 200, 300],
            "learning_rate": [0.01, 0.1, 0.2],
            "max_depth": [3, 5, 7],
            "min_samples_split": [2, 5, 10],
            "min_samples_leaf": [1, 2, 4],
        }
    ],
    "xgb": [
        {
            "n_estimators": [100, 200, 300],
            "learning_rate": [0.01, 0.1, 0.2],
            "max_depth": [3, 5, 7],
            "subsample": [0.8, 1.0],
            "colsample_bytree": [0.8, 1.0],
        }
    ],
}

ALL_MODELS = list(GRIDS)


def _zoo() -> dict[str, Any]:
    """Every model `Src/model.py` defines, keyed the same way as `GRIDS`."""
    return {**LINEAR_MODELS, **ENSEMBLE_MODELS}


def prefix_grid(grid: Sequence[Mapping[str, list[Any]]]) -> list[dict[str, list[Any]]]:
    """`{"alpha": ...}` -> `{"model__alpha": ...}`, for searching a Pipeline."""
    return [{f"model__{k}": v for k, v in region.items()} for region in grid]


def strip_prefix(params: Mapping[str, Any]) -> dict[str, Any]:
    """Undo `prefix_grid` so the winners are pasteable into `Src/model.py`."""
    return {k.removeprefix("model__"): v for k, v in params.items()}


def grid_size(grid: Sequence[Mapping[str, list[Any]]]) -> int:
    """Number of candidates a grid enumerates."""
    return sum(int(np.prod([len(v) for v in region.values()])) for region in grid)


def quiet_workers() -> None:
    """Silence `ConvergenceWarning` inside joblib's worker processes.

    Worker processes are spawned fresh and do not inherit the parent's warning
    filters, but they do inherit its environment, and Python applies
    `PYTHONWARNINGS` at interpreter start. Call before any search that uses
    `n_jobs != 1`. Set the variable yourself to override.
    """
    os.environ.setdefault(
        "PYTHONWARNINGS", "ignore::sklearn.exceptions.ConvergenceWarning"
    )


def _single_threaded(pipe) -> Any:
    """Give the search all the cores, not the estimator.

    `rf` and `xgb` parallelise internally; leaving that on while `GridSearchCV`
    also forks means every worker fights for the same cores.
    """
    if "model__n_jobs" in pipe.get_params():
        pipe.set_params(model__n_jobs=1)
    return pipe


# --------------------------------------------------------------------------- #
# Search
# --------------------------------------------------------------------------- #
def search_model(
    name: str,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    k: int = K_BEST,
    folds: int = 5,
    n_iter: int | None = None,
    scoring: str = SCORING,
    verbose: int = 0,
) -> dict[str, Any]:
    """Search one model's grid and compare the winner to the current setting.

    `n_iter` switches to `RandomizedSearchCV` with that many draws. Returns the
    winning parameters, its CV score, and the CV score of whatever
    `Src/model.py` currently has configured, so the two are directly comparable.
    """
    model = _zoo()[name]
    grid = prefix_grid(GRIDS[name])
    cv = KFold(n_splits=folds, shuffle=True, random_state=Seed)
    estimator = _single_threaded(build_pipeline(model, k=k))

    total = grid_size(GRIDS[name])
    if n_iter is not None:
        searcher: Any = RandomizedSearchCV(
            estimator,
            grid,
            n_iter=min(n_iter, total),
            cv=cv,
            scoring=scoring,
            n_jobs=-1,
            random_state=Seed,
            verbose=verbose,
        )
        candidates = min(n_iter, total)
    else:
        searcher = GridSearchCV(
            estimator, grid, cv=cv, scoring=scoring, n_jobs=-1, verbose=verbose
        )
        candidates = total

    started = time.perf_counter()
    with warnings.catch_warnings():
        # Coordinate descent does not converge in the small-`alpha` corners of
        # the Lasso grid. Those candidates score worse and lose, so the warning
        # is noise - but one line per fold drowns the report. This only covers
        # the in-process path; `n_jobs=-1` forks, and a filter set here does not
        # cross into a loky worker. `quiet_workers()` handles that half.
        warnings.simplefilter("ignore", ConvergenceWarning)
        searcher.fit(X_train, y_train)
    elapsed = time.perf_counter() - started

    # What the constants in Src/model.py score under the identical protocol.
    current = -cross_val_score(
        _single_threaded(build_pipeline(model, k=k)),
        X_train,
        y_train,
        cv=cv,
        scoring=scoring,
        n_jobs=-1,
    ).mean()
    best = -searcher.best_score_

    return {
        "best_params": strip_prefix(searcher.best_params_),
        "best_cv_RMSE": float(best),
        "current_cv_RMSE": float(current),
        "improvement": float(current - best),
        "candidates": int(candidates),
        "of_total": int(total),
        "fit_seconds": round(elapsed, 1),
    }


def search(
    models: Sequence[str] = tuple(ALL_MODELS),
    k: int = K_BEST,
    folds: int = 5,
    n_iter: int | None = None,
    scoring: str = SCORING,
    verbose: int = 0,
) -> dict[str, Any]:
    """Run `search_model` for each name and collect the results."""
    X_train, _, y_train, _ = get_data()
    results: dict[str, Any] = {}
    for name in models:
        print(
            f"searching {name}: {grid_size(GRIDS[name])} candidates x {folds} folds"
            + (f", sampling {n_iter}" if n_iter else "")
            + " ...",
            flush=True,
        )
        results[name] = search_model(
            name, X_train, y_train, k=k, folds=folds, n_iter=n_iter,
            scoring=scoring, verbose=verbose,
        )
        r = results[name]
        print(
            f"  {name}: {r['best_cv_RMSE']:.4f} vs current {r['current_cv_RMSE']:.4f} "
            f"({r['improvement']:+.4f}) in {r['fit_seconds']}s",
            flush=True,
        )
    return {
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scoring": scoring,
        "search": "random" if n_iter else "grid",
        "cv_folds": folds,
        "k": k,
        "seed": Seed,
        "results": results,
    }


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #
def summary_table(report: Mapping[str, Any]) -> pd.DataFrame:
    """One row per model: search winner vs. what `Src/model.py` uses today."""
    rows = []
    for name, r in report["results"].items():
        rows.append(
            {
                "model": name,
                "best_cv_RMSE": r["best_cv_RMSE"],
                "current_cv_RMSE": r["current_cv_RMSE"],
                "improvement": r["improvement"],
                "candidates": r["candidates"],
                "seconds": r["fit_seconds"],
            }
        )
    return pd.DataFrame(rows).set_index("model")


def print_report(report: Mapping[str, Any]) -> None:
    """Print the comparison table, then each winner as pasteable kwargs."""
    table = summary_table(report)
    print(f"\n{report['search']} search, {report['cv_folds']}-fold, scoring={report['scoring']}")
    print(table.round(4).to_string())

    print("\nWinning parameters:")
    for name, r in report["results"].items():
        kwargs = ", ".join(f"{k}={v!r}" for k, v in sorted(r["best_params"].items()))
        verdict = "improves" if r["improvement"] > 1e-4 else "no better than current"
        print(f"  {name:4s} ({verdict}): {kwargs}")

    beaten = [n for n, r in report["results"].items() if r["improvement"] > 1e-4]
    if beaten:
        print(
            f"\n{len(beaten)} model(s) improved: {', '.join(beaten)}. "
            "Update the constants in Src/model.py, then re-run python -m Src.evaluation."
        )
    else:
        print("\nNo model beat its current configuration - leave Src/model.py alone.")


def save_report(report: Mapping[str, Any], path: Path | str = Best_Params_Path) -> Path:
    """Write the report as JSON so the search is a record, not folklore."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument(
        "--models", nargs="+", choices=ALL_MODELS, default=ALL_MODELS,
        help="which models to search (default: all)",
    )
    parser.add_argument(
        "-k", type=int, default=K_BEST, help=f"features to keep (default {K_BEST})"
    )
    parser.add_argument("--folds", type=int, default=5, help="CV folds (default 5)")
    parser.add_argument(
        "--random", type=int, default=None, metavar="N",
        help="sample N candidates per model instead of the full grid",
    )
    parser.add_argument("--scoring", default=SCORING, help=f"sklearn scorer (default {SCORING})")
    parser.add_argument("--verbose", type=int, default=0, help="GridSearchCV verbosity")
    parser.add_argument(
        "--save", action="store_true", help=f"write {Best_Params_Path.name}"
    )
    parser.add_argument("--out", default=Best_Params_Path, help="path for --save")
    args = parser.parse_args(argv)

    if not args.verbose:
        quiet_workers()
    report = search(
        models=args.models, k=args.k, folds=args.folds,
        n_iter=args.random, scoring=args.scoring, verbose=args.verbose,
    )
    print_report(report)

    if args.save:
        print(f"\nwrote {save_report(report, args.out)}")
    else:
        print(f"\n(nothing written - pass --save to record this in {Best_Params_Path.name})")


if __name__ == "__main__":
    main()
