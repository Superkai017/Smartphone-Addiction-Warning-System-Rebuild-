from config import (
  Seed,
TEST_SIZE    
)
import pandas as pd
import numpy as np
from Preprocessed import Preprocessed_Data_Path, TARGET
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor , GradientBoostingRegressor 
from  xgboost import XGBRegressor
from sklearn.feature_selection import f_regression, SelectKBest
def get_data():
    """Load the preprocessed data and split into train/test folds."""
    df = pd.read_csv(Preprocessed_Data_Path)
    X = df.drop(columns=[TARGET])
    y = df[TARGET]
    return train_test_split(X, y, test_size=TEST_SIZE, random_state=Seed)
def split_data(X: pd.DataFrame, y: pd.Series):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=Seed)
    return X_train, X_test, y_train, y_test
def scale_data(X_train: pd.DataFrame, X_test: pd.DataFrame):
    """Scale the features using StandardScaler."""
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    return X_train_scaled, X_test_scaled
def feature_selection(X_train: pd.DataFrame, y_train: pd.Series, X_test: pd.DataFrame, k: int = 16):
    """Select the top k features based on univariate linear regression tests."""
    selector = SelectKBest(score_func=f_regression, k=k)
    X_train_selected = selector.fit_transform(X_train, y_train)
    X_test_selected = selector.transform(X_test)
    return X_train_selected, X_test_selected, selector.get_support(indices=True)