"""Command-line entry point for the smartphone addiction warning system.

Every runnable step lives here. `Src/` holds only library code - the functions
this file calls - so there is one place to look for "how do I run it" and one
place to change when a step grows an option.

    python main.py                         # no arguments: runs `all`
    python main.py preprocess              # raw CSV -> preprocessed CSV + preprocessor.pkl
    python main.py train --save            # fit the models, write models/
    python main.py evaluate --cv           # metrics on the held-out fold
    python main.py tune --random 40        # hyperparameter search
    python main.py calibrate --save        # fit the severity bands + advice thresholds
    python main.py score 7                 # score a raw row end to end
    python main.py all                     # preprocess -> train -> evaluate, in order

Every command runs read-only unless you pass `--save`, so `python main.py all`
reports without touching a tracked file.

Heavy imports are deferred into the command functions on purpose. `Src/model.py`
and everything downstream of it import `xgboost` at module scope, and
`preprocess` has no business requiring a training dependency to regenerate a
CSV - the same reason `Src/__init__.py` does not re-export them.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow `python /any/path/main.py` from any working directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from Src.config import (  # noqa: E402  (must follow the sys.path line)
    Best_Params_Path,
    K_BEST,
    Model_Path,
    Preprocessed_Data_Path,
    Preprocessor_Path,
    Thresholds_Path,
)


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #
def cmd_preprocess(args: argparse.Namespace) -> None:
    """Rebuild the preprocessed CSV and the fitted preprocessing statistics."""
    from Src.Preprocessed import build_preprocessed_dataset

    df = build_preprocessed_dataset(
        output_path=None if args.dry_run else args.out,
        preprocessor_path=None if args.dry_run else args.preprocessor,
    )
    print(f"{df.shape[0]} rows x {df.shape[1]} cols | NaNs: {int(df.isna().sum().sum())}")
    if args.dry_run:
        print("(nothing written - drop --dry-run to update the CSV and preprocessor.pkl)")
    else:
        print(f"wrote {args.out}")
        print(f"wrote {args.preprocessor}")


def cmd_train(args: argparse.Namespace) -> None:
    """Split, select, scale and fit every model. Writes only with --save."""
    from Src.model import prepare, save_artifacts, train_models

    X_train, X_test, y_train, _, selector, scaler = prepare(k=args.k)
    print(
        f"train {X_train.shape} | test {X_test.shape} | "
        f"{args.k} features: {', '.join(list(X_train.columns)[:4])}, ..."
    )
    fitted = train_models(X_train, y_train)
    print(f"fitted {len(fitted)} models: {', '.join(fitted)}")

    if args.save:
        for path in save_artifacts(fitted, selector, scaler, args.out):
            print(f"wrote {path}")
    else:
        print("(nothing written - pass --save to replace the artifacts in models/)")


def cmd_evaluate(args: argparse.Namespace) -> None:
    """Train, then print the metric tables. Never writes."""
    from Src.evaluation import report

    report(k=args.k, cv=args.cv)


def cmd_tune(args: argparse.Namespace) -> None:
    """Search the hyperparameter grids and compare against Src/model.py."""
    from Src.tuning import print_report, quiet_workers, save_report, search

    if not args.verbose:
        quiet_workers()
    result = search(
        models=args.models,
        k=args.k,
        folds=args.folds,
        n_iter=args.random,
        scoring=args.scoring,
        verbose=args.verbose,
    )
    print_report(result)

    if args.save:
        print(f"\nwrote {save_report(result, args.out)}")
    else:
        print(f"\n(nothing written - pass --save to record this in {Best_Params_Path.name})")


def cmd_calibrate(args: argparse.Namespace) -> None:
    """Fit the severity bands and advice thresholds from the training distribution."""
    from Src.inference import RULES, calibrate, save_thresholds

    cal = calibrate(args.data, high_q=args.high_q, low_q=args.low_q)
    lo, hi = cal["score_range"]
    print(
        f"{cal['n_rows']} rows | target {cal['target']} in [{lo}, {hi}] | "
        f"{cal['ceiling_share']:.1%} at the ceiling"
    )
    print(f"band cuts (from the non-ceiling rows): {cal['band_cuts']}")
    print(f"  {' < '.join(cal['band_labels'])}")
    print(f"\nrule thresholds (high=q{args.high_q}, low=q{args.low_q}):")
    for feature, direction, _ in RULES:
        entry = cal["rule_thresholds"][feature]
        print(f"  {feature:<26}{direction:>5} {entry['value']:>12.4f}")

    if args.save:
        print(f"\nwrote {save_thresholds(cal, args.out)}")
    else:
        print(f"\n(nothing written - pass --save to update {Thresholds_Path.name})")


def cmd_score(args: argparse.Namespace) -> None:
    """Score raw rows end to end: record -> features -> model -> band + advice.

    Reads from the raw CSV by row index so the whole chain can be exercised
    without a web layer or a hand-written record. Never writes.
    """
    import json

    from Src.inference import Scorer
    from Src.Preprocessed import load_raw_data

    # No validate_raw here: `preprocess_new` -> `transform` already calls it, and
    # repeating it would imply validation is the caller's job.
    raw = load_raw_data()
    rows = raw.iloc[args.rows]

    scorer = Scorer.load(args.model)
    for index, result in zip(args.rows, scorer.score(rows, limit=args.tips)):
        if args.json:
            print(json.dumps(result, indent=2))
            continue
        print(
            f"row {index}: {result['score']:.2f}/10  {result['band']} "
            f"({result['percentile']:.0f}th percentile) via {result['model']}"
        )
        print(f"  {result['band_description']}")
        print(f"  {result['n_flagged']} of 14 rules flagged, showing {len(result['recommendations'])}:")
        for tip in result["recommendations"]:
            print(
                f"    [{tip['severity']:>5.1f}] {tip['feature']} = {tip['value']:.3f} "
                f"({tip['direction']} vs {tip['threshold']:.3f})"
            )
            print(f"            {tip['message']}")
        print()


def cmd_all(args: argparse.Namespace) -> None:
    """preprocess -> train -> evaluate, in the order the data flows.

    Tuning is deliberately not included: a full grid is ~5900 fits, which is
    not something a top-level "run everything" should start by surprise.
    """
    from Src.evaluation import report
    from Src.Preprocessed import build_preprocessed_dataset

    print("== preprocess ==")
    df = build_preprocessed_dataset(
        output_path=args.out_data if args.save else None,
        preprocessor_path=args.out_preprocessor if args.save else None,
    )
    print(f"{df.shape[0]} rows x {df.shape[1]} cols | NaNs: {int(df.isna().sum().sum())}")

    print("\n== train + evaluate ==")
    report(k=args.k, cv=args.cv)

    if args.save:
        from Src.model import prepare, save_artifacts, train_models

        X_train, _, y_train, _, selector, scaler = prepare(k=args.k)
        fitted = train_models(X_train, y_train)
        print()
        for path in save_artifacts(fitted, selector, scaler, args.out_models):
            print(f"wrote {path}")
    else:
        print("\n(nothing written - pass --save to update the CSV and models/)")


# --------------------------------------------------------------------------- #
# Parser
# --------------------------------------------------------------------------- #
# What a bare `python main.py` does. `all` is preprocess -> train -> evaluate
# and writes nothing without --save, so it is safe to run by accident.
DEFAULT_COMMAND = "all"

TUNABLE = ["lr", "rid", "las", "rf", "gb", "xgb"]

SCORING_DEFAULT = "neg_root_mean_squared_error"

# Mirrored from Src/inference.py rather than imported: `python main.py --help`
# must not pay for pandas and sklearn just to print a default.
HIGH_Q = 0.75
LOW_Q = 0.25
MAX_TIPS = 3
DEFAULT_MODEL = "gb"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description=(__doc__ or "").splitlines()[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Not required: running the file with no arguments - the IDE's Run button,
    # or a bare `python main.py` - falls through to DEFAULT_COMMAND.
    sub = parser.add_subparsers(dest="command", required=False)

    def add_k(p: argparse.ArgumentParser) -> None:
        p.add_argument(
            "-k",
            type=int,
            default=K_BEST,
            help=f"features to keep (default {K_BEST})",
        )

    # -- preprocess ---------------------------------------------------------
    pre = sub.add_parser("preprocess", help="rebuild the preprocessed CSV + preprocessor.pkl")
    pre.add_argument("--out", default=Preprocessed_Data_Path, help="output CSV path")
    pre.add_argument(
        "--preprocessor", default=Preprocessor_Path, help="output path for the fitted statistics"
    )
    pre.add_argument(
        "--dry-run", action="store_true", help="run the pipeline but write nothing"
    )
    pre.set_defaults(func=cmd_preprocess)

    # -- train --------------------------------------------------------------
    train = sub.add_parser("train", help="fit the linear and ensemble models")
    add_k(train)
    train.add_argument(
        "--save",
        action="store_true",
        help="write preprocessing.pkl and model_*.pkl, replacing the notebook's",
    )
    train.add_argument("--out", default=Model_Path, help="directory for --save")
    train.set_defaults(func=cmd_train)

    # -- evaluate -----------------------------------------------------------
    ev = sub.add_parser("evaluate", help="metrics on the held-out test fold")
    add_k(ev)
    ev.add_argument(
        "--cv", action="store_true", help="also run honest 5-fold CV over a Pipeline"
    )
    ev.set_defaults(func=cmd_evaluate)

    # -- tune ---------------------------------------------------------------
    tune = sub.add_parser("tune", help="hyperparameter search")
    add_k(tune)
    tune.add_argument(
        "--models",
        nargs="+",
        choices=TUNABLE,
        default=TUNABLE,
        help="which models to search (default: all)",
    )
    tune.add_argument("--folds", type=int, default=5, help="CV folds (default 5)")
    tune.add_argument(
        "--random",
        type=int,
        default=None,
        metavar="N",
        help="sample N candidates per model instead of the full grid",
    )
    tune.add_argument(
        "--scoring", default=SCORING_DEFAULT, help=f"sklearn scorer (default {SCORING_DEFAULT})"
    )
    tune.add_argument("--verbose", type=int, default=0, help="GridSearchCV verbosity")
    tune.add_argument("--save", action="store_true", help=f"write {Best_Params_Path.name}")
    tune.add_argument("--out", default=Best_Params_Path, help="path for --save")
    tune.set_defaults(func=cmd_tune)

    # -- calibrate ----------------------------------------------------------
    cal = sub.add_parser("calibrate", help="fit the severity bands + advice thresholds")
    cal.add_argument("--data", default=Preprocessed_Data_Path, help="frame to calibrate against")
    cal.add_argument(
        "--high-q", type=float, default=HIGH_Q, dest="high_q",
        help=f"quantile a 'high' rule fires above (default {HIGH_Q})",
    )
    cal.add_argument(
        "--low-q", type=float, default=LOW_Q, dest="low_q",
        help=f"quantile a 'low' rule fires below (default {LOW_Q})",
    )
    cal.add_argument("--save", action="store_true", help=f"write {Thresholds_Path.name}")
    cal.add_argument("--out", default=Thresholds_Path, help="path for --save")
    cal.set_defaults(func=cmd_calibrate)

    # -- score --------------------------------------------------------------
    sc = sub.add_parser("score", help="score raw rows end to end (band + advice)")
    sc.add_argument(
        "rows", nargs="*", type=int, default=[0],
        help="row indices in the raw CSV (default: 0)",
    )
    sc.add_argument(
        "--model", default=DEFAULT_MODEL, choices=["rf", "gb", "xgb"],
        help=f"which fitted model to score with (default {DEFAULT_MODEL})",
    )
    sc.add_argument(
        "--tips", type=int, default=MAX_TIPS, help=f"recommendations to show (default {MAX_TIPS})"
    )
    sc.add_argument("--json", action="store_true", help="print the API payload instead")
    sc.set_defaults(func=cmd_score)

    # -- all ----------------------------------------------------------------
    everything = sub.add_parser("all", help="preprocess, train and evaluate in order")
    add_k(everything)
    everything.add_argument("--cv", action="store_true", help="include honest 5-fold CV")
    everything.add_argument(
        "--save", action="store_true", help="write the CSV, preprocessor.pkl and models/"
    )
    everything.add_argument("--out-data", default=Preprocessed_Data_Path, help="output CSV path")
    everything.add_argument(
        "--out-preprocessor", default=Preprocessor_Path, help="output path for the statistics"
    )
    everything.add_argument("--out-models", default=Model_Path, help="directory for the models")
    everything.set_defaults(func=cmd_all)

    return parser


def _dependency_help(missing: str | None) -> str:
    """Turn a bare ModuleNotFoundError into something actionable.

    The usual cause is not a broken checkout but the wrong interpreter: `python`
    on PATH here is a bare 3.10 with none of the dependencies, while the
    packages live under a different install. Print which interpreter is actually
    running so that is obvious.
    """
    return (
        f"\nmissing dependency: {missing}\n\n"
        f"  running   {sys.executable}\n"
        f"            Python {sys.version.split()[0]}\n\n"
        f"  This interpreter does not have the project's dependencies installed.\n"
        f"  Create a project environment and install them:\n\n"
        f"      python -m venv .venv\n"
        f"      .venv\\Scripts\\activate        # Linux/macOS: source .venv/bin/activate\n"
        f"      pip install -r requirements.txt\n"
    )


def main(argv: list[str] | None = None) -> None:
    raw = sys.argv[1:] if argv is None else list(argv)
    if not raw:
        # Bare `python main.py` (or the IDE Run button) does the useful thing
        # rather than printing a usage error. `all` writes nothing on its own.
        print(f"no command given - running '{DEFAULT_COMMAND}' "
              f"(see `python main.py --help` for the rest)\n")
        raw = [DEFAULT_COMMAND]

    args = build_parser().parse_args(raw)
    try:
        args.func(args)
    except ModuleNotFoundError as exc:
        print(_dependency_help(exc.name), file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
