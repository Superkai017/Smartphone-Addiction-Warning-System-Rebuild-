"""Smartphone addiction warning system - shared library code.

The preprocessing helpers are re-exported **lazily**. Importing any submodule
runs this file, so re-exporting them eagerly (`from .Preprocessed import ...`)
made `import Src.config` drag in joblib, pandas and scikit-learn - which
defeated the deferred imports in `main.py` and made even `python main.py --help`
fail on a bare interpreter. PEP 562 `__getattr__` keeps `from Src import
preprocess_new` working while `from Src.config import ...` stays free of
third-party imports.

`model`, `evaluation` and `tuning` are deliberately *not* re-exported at all:
they import `xgboost` at module scope, and an API that only scores records
should not need a training dependency. Import them by their full path.
"""

from importlib import import_module
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # for type checkers and IDEs only - never executed at runtime
    from .Preprocessed import (
        load_preprocessor,
        preprocess,
        preprocess_new,
        to_model_matrix,
    )

from .config import (
    Best_Params_Path,
    Data_Path,
    K_BEST,
    Model_Artifacts_Path,
    Model_Path,
    Preprocessed_Data_Path,
    Preprocessor_Path,
    Project_Root,
    Raw_Data_Path,
    Seed,
    TEST_SIZE,
)

# name -> submodule it lives in. Resolved on first attribute access.
_LAZY_EXPORTS = {
    "load_preprocessor": "Preprocessed",
    "preprocess": "Preprocessed",
    "preprocess_new": "Preprocessed",
    "to_model_matrix": "Preprocessed",
}

# Listed literally rather than splatting `_LAZY_EXPORTS`, so static analysers
# can see what the package exports without evaluating anything.
__all__ = [
    "Project_Root",
    "Data_Path",
    "Raw_Data_Path",
    "Preprocessed_Data_Path",
    "Model_Path",
    "Model_Artifacts_Path",
    "Preprocessor_Path",
    "Best_Params_Path",
    "K_BEST",
    "Seed",
    "TEST_SIZE",
    "load_preprocessor",
    "preprocess",
    "preprocess_new",
    "to_model_matrix",
]


def __getattr__(name: str) -> Any:
    """Import the owning submodule only when one of its names is asked for."""
    if name in _LAZY_EXPORTS:
        return getattr(import_module(f".{_LAZY_EXPORTS[name]}", __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(__all__)
