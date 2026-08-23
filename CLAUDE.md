# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Read this first: **`README.md` describes the intended end state, not the current one.** Today the repo is
notebook-only — two Jupyter notebooks and two CSVs. There is no `src/`, no trained model, no API, no
frontend, no `requirements.txt`, and no tests. Do not assume any component the README lists (FastAPI,
React/Streamlit, Docker, `.pkl` artifacts) exists until you have verified it on disk.

Current pipeline stage: **EDA done → feature engineering partially done → scaling, split, and modeling not started.**

## Environment & commands

No dependency manifest is committed. Both notebooks bind to a Jupyter kernel named `venv`
(display name "Python (venv)") that is registered globally in `%APPDATA%\jupyter\kernels\venv`, not
inside this repo. The system `python` on PATH (3.10.0rc2) does **not** have pandas installed — always
run analysis through that kernel, or create a project venv first.

```bash
# Create a project-local env (does not exist yet; do this before adding scripts)
python -m venv .venv && .venv/Scripts/activate
pip install pandas numpy matplotlib seaborn scikit-learn jupyter

# Run notebooks
jupyter lab notebook/

# Execute a notebook headlessly (useful for checking a change actually runs)
jupyter nbconvert --to notebook --execute --inplace notebook/preprocessed.ipynb
```

There is no build, lint, or test command because there is nothing yet to build, lint, or test.

## Data flow

```
data/Raw Data/teen_phone_addiction_dataset.csv   3000 rows x 25 cols (Kaggle, synthetic)
  └─ notebook/eda.ipynb            distributions, boxplots, f_regression ranking, correlation heatmap
  └─ notebook/preprocessed.ipynb   drops ID/Name/Location, engineers ratio & composition features
       └─ data/Preprocessed Data/preprocessed_data.csv   3000 rows x 25 cols
```

The two CSVs have the same shape by coincidence, not because columns were transformed in place.
`preprocessed_data.csv` keeps **only `Addiction_Level` plus 24 engineered features** — every raw
predictor (`Daily_Usage_Hours`, `Sleep_Hours`, `Phone_Checks_Per_Day`, …) was dropped. Any model
trained on it sees derived signal only.

### Reproducibility gap

`preprocessed.ipynb` ends after the "Usage composition" block, which creates 6 features
(`Tracked_Hours`, `Untracked_Hours`, `Leisure_Hours`, `Leisure_Ratio`, `Education_Ratio`,
`Social_vs_Gaming`). The committed CSV contains **18 more** — `Weekend_Escalation`, `Minutes_Per_Check`,
`Checks_Per_App`, `Sleep_Deficit`, `Screen_To_Sleep_Ratio`, `Bedtime_Screen_Share`, `Offline_Activity`,
`Anxiety_Level_z`, `Depression_Level_z`, `Self_Esteem_z`, `Distress_Index`, `Grade_Num`, and others.
**The code that produced them is not in the repo.** Before extending preprocessing, either recover
that code into the notebook or regenerate the CSV from a notebook that runs end to end.

## Modeling constraints you must account for

- **Target `Addiction_Level` is continuous (1.0–10.0), not tiered.** README frames the problem as
  classification into Low/Moderate/High; the data supports regression. Pick one and make the
  notebooks, the README, and the eventual API agree.
- **The target is ceiling-censored.** 1524 of 3000 rows (50.8%) sit exactly at the 10.0 maximum;
  mean is 8.88. Plain R²/RMSE will look deceptively strong. Treat this as a censored/imbalanced
  problem — stratify splits, and report metrics on the non-saturated range separately.
- **Component times exceed the stated total.** `Time_on_Social_Media + Time_on_Gaming +
  Time_on_Education > Daily_Usage_Hours` in 1475 of 3000 rows, so `Untracked_Hours` goes negative
  and `Leisure_Ratio` exceeds 1.0 in 968 rows. The "residual browsing time" reading of these
  features does not hold. This is an artifact of the synthetic source data, not a code bug.
- **Scaling is deliberately deferred** to after the train/test split, to avoid leakage (see commit
  `14f0bfc`). Do not add a `.fit_transform()` over the full frame to the preprocessing notebook.
- **25 NaNs per ratio column** (30 in `Online_To_Offline_Ratio`) remain in the committed CSV, from
  `.replace(0, np.nan)` guards on zero denominators. They are unhandled — decide impute vs. drop
  before training.

## Conventions in this codebase

- Notebooks are committed **with outputs**; keep it that way for review continuity.
- Data paths are hardcoded Windows absolute strings (`r'D:\Phone addicted\...'`). **Both notebooks
  currently point at `data\teen_phone_addiction_dataset.csv`, which no longer exists** — the file
  moved to `data/Raw Data/` in commit `14f0bfc` and the notebooks were not updated, so cell 1 fails
  on a fresh run. Fix these to repo-relative paths rather than patching the absolute string.
- Directory names contain spaces (`Raw Data`, `Preprocessed Data`) — quote them in shell commands.
- Commit messages are lowercase, descriptive, and explain *why* (e.g. deferring scaling to avoid
  leakage). Match that style.
