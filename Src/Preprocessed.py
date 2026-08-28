from config import (
    Data_Path,
    Model_Path,
    Preprocessed_Data_Path,
    Project_Root,
)
import pandas as pd
import numpy as np
def load_preprocessed_data() -> pd.DataFrame:
    """Load the preprocessed data from the CSV file.

    Returns:
        pd.DataFrame: The preprocessed data as a pandas DataFrame.
    """
    return pd.read_csv(Preprocessed_Data_Path)