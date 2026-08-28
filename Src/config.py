"""Project-wide paths.

Paths are resolved relative to the repo root (derived from this file's location)
rather than hardcoded absolute Windows strings, so the package works from any
working directory and on any machine.
"""

from pathlib import Path

Project_Root = Path(__file__).resolve().parents[1]

Data_Path = Project_Root / "data"
Raw_Data_Path = Data_Path / "Raw Data" / "teen_phone_addiction_dataset.csv"
Preprocessed_Data_Path = Data_Path / "Preprocessed Data" / "preprocessed_data.csv"

Model_Path = Project_Root / "models"
Seed = 42


