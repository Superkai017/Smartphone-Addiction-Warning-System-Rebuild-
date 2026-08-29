

from pathlib import Path

Project_Root = Path(__file__).resolve().parents[1]

Data_Path = Project_Root / "data"
Raw_Data_Path = Data_Path / "Raw Data" / "teen_phone_addiction_dataset.csv"
Preprocessed_Data_Path = Data_Path / "Preprocessed Data" / "preprocessed_data.csv"

Model_Path = Project_Root / "models"
# Statistics the raw -> features pipeline learned at training time (gender
# encoding, zero-imputation means, z-score mean/std). Needed to preprocess new
# records the same way the training data was preprocessed.
Preprocessor_Path = Model_Path / "preprocessor.pkl"
# {selector, scaler, features} fitted on the engineered 27-column frame.
Model_Artifacts_Path = Model_Path / "preprocessing.pkl"
# Winning hyperparameters written by `python main.py tune --save`, so the searches
# behind the constants in `Src/model.py` are reproducible rather than folklore.
Best_Params_Path = Model_Path / "best_params.json"

Seed = 42
TEST_SIZE    = 0.2

# Features `SelectKBest` keeps. 18 is what the notebook selected and what
# `models/preprocessing.pkl` was fitted with - changing it invalidates every
# artifact in `models/`. Lives here rather than in `Src/model.py` so `main.py`
# can read it without importing xgboost.
K_BEST = 18
