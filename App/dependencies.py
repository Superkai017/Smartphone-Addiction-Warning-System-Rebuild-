"""Artifact loading for the API.

`Src/inference.Scorer` already bundles the four artifacts a score needs - the
preprocessor state, the selector/scaler, the regressor and the calibration - and
its docstring says an API should build it at startup and reuse it. That is all
this module does.

Loading is cached per model name rather than eager for every model, so a
deployment without `xgboost` installed still serves the sklearn default: `xgb`
is only ever touched if a request asks for it. Paths come from `Src/config.py`,
which resolves them against the repo root - the artifacts live in
`<repo>/models`, not `App/models`.
"""

from functools import lru_cache

from Src.inference import DEFAULT_MODEL, Scorer


@lru_cache(maxsize=None)
def get_scorer(model_name: str = DEFAULT_MODEL) -> Scorer:
    """Return the `Scorer` for one model, loading its artifacts on first use.

    Cached, so the pickles are read once per model for the process lifetime.
    Raises `FileNotFoundError` if an artifact is missing, or `ImportError` for
    `xgb` where xgboost is not installed.
    """
    return Scorer.load(model_name)


def warm(model_name: str = DEFAULT_MODEL) -> Scorer:
    """Load the default scorer up front so missing artifacts fail at boot.

    Without this the first request is the one that discovers `models/` was never
    populated, and it surfaces as a 500 to a user rather than as a startup error
    to whoever deployed it.
    """
    return get_scorer(model_name)
