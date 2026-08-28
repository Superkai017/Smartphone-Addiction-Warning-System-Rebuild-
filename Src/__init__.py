"""Smartphone addiction warning system - shared library code."""

from .config import (
    Data_Path,
    Model_Path,
    Preprocessed_Data_Path,
    Project_Root,
    Raw_Data_Path,
)

__all__ = [
    "Project_Root",
    "Data_Path",
    "Raw_Data_Path",
    "Preprocessed_Data_Path",
    "Model_Path",
]

# Still to come, once the modules that define them exist. Do not list a name
# in __all__ before it is importable - `from Src import *` raises AttributeError
# on any name __all__ promises but the package does not define.
#   load_data, preprocess_features  -> Src/data.py
#   train_model, save_artifacts     -> Src/model.py
