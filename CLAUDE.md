# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Read this first: **`README.md` describes the intended end state, not the current one.** As of
2026-08-29 the repo holds three Jupyter notebooks, a six-module `Src/` package, two CSVs, five
pickled artifacts and one JSON artifact in `models/`. There is still **no API, no frontend, no
tests, and no Docker**. Do not assume any component the README lists exists until you have verified
it on disk.

Current pipeline stage: **EDA → preprocessing → modelling through tuned ensembles, with rf/gb/xgb
serialized to `models/`, and a calibrated warning layer (`Src/inference.py`) that turns a score into
a band, a cohort percentile and ranked advice. The HTTP layer is the next unstarted milestone — the
library behind it is done.**

`PROJECT_STATUS.md` carries the detailed milestone table, the measured metrics, and the open-risk
register. It is more current than this file — read it before planning work, and update it when you
close a risk.

## Environment & commands

`requirements.txt` pins every dependency to the versions this project is known to run on
(Python 3.13.9, pandas 2.2.3, scikit-learn 1.6.1, xgboost 3.1.2). `.venv/` is the project
environment and is gitignored.

**`python` on PATH is not the right interpreter.** It is a bare 3.10.0rc2 with *nothing* installed —
no pandas, no joblib, no sklearn — so running anything through it fails with `ModuleNotFoundError`.
The packages live under `…\Programs\Python\Python313\python.exe`. Always check
`python -c "import sys; print(sys.executable)"` before blaming the code for an import error;
`main.py` catches `ModuleNotFoundError` and prints the running interpreter for exactly this reason.

All three notebooks bind to a Jupyter kernel named `venv` (display name "Python (venv)") registered
globally in `%APPDATA%\jupyter\kernels\venv`. **That kernel is not this venv**: its `kernel.json`
points at the global Python313 install. It works, because Python313 has the same packages, but
`.venv` is the reproducible one — repoint the kernel at it when convenient.

```bash
# One-time setup
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt

# Everything runnable goes through main.py. Nothing writes without --save
python main.py                          # no arguments -> runs `all`
python main.py --help

# Regenerate data/Preprocessed Data/preprocessed_data.csv and models/preprocessor.pkl
python main.py preprocess
python main.py preprocess --dry-run     # run the pipeline, write nothing

# Train. --save replaces preprocessing.pkl and model_*.pkl
python main.py train
python main.py train --save --out models

# Score. --cv adds honest 5-fold CV with selection/scaling refit per fold
python main.py evaluate
python main.py evaluate --cv

# Re-derive the hyperparameters in Src/model.py. Full grid is 5945 fits, ~21 min
python main.py tune --random 40         # fast sample
python main.py tune --save              # full grid -> models/best_params.json (gitignored)

# Re-derive the severity bands and advice thresholds from the training distribution
python main.py calibrate                # print them
python main.py calibrate --save         # -> models/thresholds.json (committed, not gitignored)

# Score raw rows end to end: record -> features -> model -> band + percentile + advice
python main.py score 7                  # human-readable
python main.py score 0 1 2 --json       # the API payload
python main.py score 7 --model xgb --tips 5

# preprocess -> train -> evaluate in one go (tuning and calibration are deliberately excluded)
python main.py all

# Run notebooks
jupyter lab notebook/

# Execute a notebook headlessly (useful for checking a change actually runs)
jupyter nbconvert --to notebook --execute --inplace notebook/preprocessed.ipynb
```

There is no build, lint, or test command yet.

**Run notebooks top to bottom before trusting any number in them.** Non-linear execution order
previously hid a real defect: a `copy_X: [True, False]` entry in the Ridge/Lasso grids made
`GridSearchCV` centre the training matrix in place while the test matrix was left alone, degrading
every model below it (gb MSE 0.280 → 0.414, xgb 0.258 → 0.597). It was invisible because the
ensembles had been executed *before* the search. Fixed in `377f228`.

## Data flow

```
data/Raw Data/teen_phone_addiction_dataset.csv    3000 x 25  (Kaggle, synthetic)
  ├─ notebook/eda.ipynb           distributions, boxplots, f_regression ranking, heatmap
  ├─ notebook/preprocessed.ipynb  drop IDs → label-encode Gender → zero-impute → 24 features
  └─ Src/Preprocessed.py          the same pipeline as an importable module, split fit/transform
       ├─ data/Preprocessed Data/preprocessed_data.csv   3000 x 28
       │    ├─ notebook/modelling.ipynb   SelectKBest(k=18) → scale → split → linear + ensembles
       │    │    └─ models/  model_{rf,gb,xgb}.pkl, preprocessing.pkl   ← the committed artifacts
       │    └─ Src/model.py   split → SelectKBest(k=18) → scale → same models, train-only fit
       │         ├─ Src/evaluation.py   metrics, ceiling-masked metrics, honest Pipeline CV
       │         └─ Src/tuning.py       GridSearchCV over the Pipeline → models/best_params.json
       └─ models/preprocessor.pkl   the fitted statistics, replayed onto new records

new record (dict / DataFrame)
  └─ preprocess_new()  → 27 engineered cols → to_model_matrix() → 18 scaled cols → model.predict
       └─ Src/inference.py  Scorer.score() → {score, band, percentile, recommendations}
            └─ models/thresholds.json   band cuts + rule thresholds + quantile grids
```

`preprocessed_data.csv` keeps `Age`, `Gender`, `Daily_Usage_Hours` and the target `Addiction_Level`
as raw columns, plus **24 engineered features**. The other 18 raw predictors (`Sleep_Hours`,
`Phone_Checks_Per_Day`, `Time_on_*`, …) are dropped once the features derived from them exist.

`models/preprocessing.pkl` is a dict of `{selector, scaler, features}` — a `SelectKBest` fitted on
27 columns and a `StandardScaler` on the surviving 18.

`models/preprocessor.pkl` sits *ahead* of it: `{gender_classes, zero_means, psych_stats,
output_columns, feature_columns}`, written by `python main.py preprocess`. It is what lets a single
raw record be preprocessed identically to the training frame. Refit and re-save it whenever
`ZERO_AS_MISSING`, `PSYCH_COLUMNS` or any feature formula changes, or new records will be engineered
against stale statistics.

**Such a change invalidates four artifacts, in this order:** `python main.py preprocess` (CSV +
`preprocessor.pkl`), then `train --save` (`preprocessing.pkl` + `model_*.pkl`), then
`calibrate --save` (`thresholds.json`). Skipping the middle step is the dangerous one — the scaler
in `preprocessing.pkl` stores the *old* column moments, so it silently mis-scales the new CSV.
The `Parental_Control` fix moved `Unsupervised_Usage` by a factor of 2.03 and would have been scaled
against a mean of 1.2297 instead of 2.4960.

### Preprocessing exists twice — keep both in sync

`notebook/preprocessed.ipynb` and `Src/Preprocessed.py` implement the same pipeline and produce
identical output (verified with `assert_frame_equal` against the committed CSV). **A change to one
must be mirrored in the other**, or the notebook and the module will silently disagree about what
the model was trained on. The module is the better place for logic the API will need; the notebook
retains the exploratory framing and its committed outputs.

The fit/transform split is module-only and does **not** need mirroring: it changed the signatures,
not the arithmetic, and `preprocess(raw)` still reproduces the committed CSV exactly. Any change to a
*formula* still does.

## Modeling constraints you must account for

- **Target `Addiction_Level` is continuous (1.0–10.0), not tiered.** The README frames the problem
  as classification into Low/Moderate/High; every line of code does regression (`r2_score`,
  `mean_squared_error`, regressors throughout). **Settled as of 2026-08-29:** regression, then
  post-hoc banding in `Src/inference.py` against cut points calibrated from the target distribution.
  The README is the only thing left out of line.
- **The target is ceiling-censored.** 1524 of 3000 rows (50.8%) sit exactly at 10.0; mean is 8.88.
  Always report metrics on the non-saturated range separately. The current models do hold up there —
  gb scores MSE 0.435 / R² 0.825 on the 295 non-ceiling test rows, against MSE 0.268 / R² 0.894
  overall — so this is a reporting discipline, not a known inflation. Splits are still unstratified.
  The censoring also breaks quantile banding: the median *is* the ceiling, so quartiles of the full
  target collapse to `[8.0, 10.0, 10.0]`. `Src/inference.py` takes its cut points from the 1476
  uncensored rows instead (`[6.7, 8.0, 9.0]`). That fixes the bottom three bands — 11.3 / 11.9 /
  13.8% of predictions rather than 1.2 / 5.8 / 30.1% — but **nothing moves the top band off 63%**,
  because the data really is that saturated. The `percentile` field carries the information the band
  cannot: a "Severe" prediction ranges from the 37th to the 75th percentile.
- **Component times exceed the stated total.** `Time_on_Social_Media + Time_on_Gaming +
  Time_on_Education > Daily_Usage_Hours` in 1475 of 3000 raw rows. After zero-imputation
  `Untracked_Hours` is negative in **1582** rows and `Leisure_Ratio` exceeds 1.0 in **1025**. The
  "residual browsing time" reading of these features does not hold. This is an artifact of the
  synthetic source data, not a code bug — and both features are inside the selected k=18.
- **Zero-imputation is the remaining data defect.** `Src/Preprocessed.py:impute_zeros_with_mean`
  replaces 0 with the column mean across **eight** columns (nine until 2026-08-29). This resolved
  the old NaN problem (the committed CSV has **0 NaNs and 0 infinities**), but it still overreaches:
  - It fabricates activity for real zeros: `Exercise_Hours` 366 rows, `Social_Interactions` 257,
    `Time_on_Education` 250. A teen who exercises zero hours is recorded as average. Only
    `Daily_Usage_Hours` (25 rows) is a case where zero is genuinely implausible. **Unlike the
    `Parental_Control` case below, this one is not a rescale** — it moves the zero rows and leaves
    every other row alone, so it does distort the fitted models. Still open.
  - ~~`Parental_Control`~~ **Fixed 2026-08-29**, and the reason it mattered is *not* what this file
    used to claim. It is a binary 0/1 flag (1478 zeros, 49.3%), and mean-imputation mapped it to
    {0.5073, 1}, so `1 − PC` became {0.4927, 0} — which is **exactly 0.492667 × the correct {1, 0}**.
    A positive scalar multiple is invisible to `StandardScaler` and to `f_regression`, both being
    correlation-based, so the models never saw a difference: after the fix, `main.py evaluate`
    reproduces every metric to four decimals and `SelectKBest` keeps the same 18 features with an
    identical F of 97.572. What was genuinely broken was the feature's **meaning** — the column
    named `Unsupervised_Usage` held 0.49 × unsupervised hours, so every user-facing number and
    calibrated threshold derived from it was in fabricated units (the q75 cut moved 2.4633 → 5.0000
    real hours). Fix the semantics for the sake of the warning layer, not the metrics.
- **Scaling must stay behind the train/test split** to avoid leakage (see `14f0bfc`). Do not add a
  `.fit_transform()` over the full frame to preprocessing. `modelling.ipynb` currently violates this
  — `SelectKBest` and `StandardScaler` are fit on the full frame before `train_test_split`. Measured
  cost is nil (0.2799 vs 0.2798 inside a train-only `Pipeline`), so fix it because the API needs one
  fitted pipeline object anyway, not because the numbers are wrong. `Src/model.py` does it in the
  right order (split → select → scale, both fitted on train). Configured with the notebook's
  hyperparameters it reproduced the notebook's headline metrics to four decimals — the direct
  confirmation that the cost is nil. It now carries the tuned values instead, so its numbers are
  better than the notebook's rather than equal to them. **As of 2026-08-29 the committed
  `models/*.pkl` are `Src/model.py`'s train-only tuned fit**, not the notebook's — written by
  `python main.py train --save` and verified to round-trip to `evaluate`'s table (rf 0.5113/0.797,
  gb 0.2675/0.894, xgb 0.2478/0.902). `modelling.ipynb` is now the only full-frame offender.
- **Nothing in the warning layer may hardcode a threshold.** `Src/inference.py` derives every cut
  from the training distribution and `python main.py calibrate --save` writes them to
  `models/thresholds.json`; the module holds only wording and direction. This is not style — the
  prototype it replaced (`modelling.ipynb` cell 28) guessed its numbers and they were wrong in both
  directions: `Academic_Per_Usage < 0.2` could never fire (the feature runs 11–29) and
  `Weekend_Ratio > 0.6` fired on 90.6% of the cohort. Quantile-derived, all 14 rules now fire on
  23.5–25.6%. **Recalibrate after any change to a preprocessing formula** — the rule thresholds are
  feature quantiles and will go stale. The band cuts come from the target and survive a retrain.
- **The psychological features carry no signal.** `f_regression` p-values: `Distress_Index` 0.13,
  `Self_Esteem_z` 0.22, `Anxiety_Level_z` 0.38, `Depression_Level_z` 0.64, `Grade_Num` 0.75, `Age`
  0.086, `Gender` 0.085 — `k=18` drops all of them. The synthetic target is a near-deterministic
  function of usage and sleep. A model trained here learns the generator's arithmetic, not
  adolescent psychology; say so rather than overclaiming in any user-facing copy.
- **Single-record inference works; use `preprocess_new`, never `preprocess`.** `preprocessing.pkl`
  resumes from the engineered 27-column frame. Ahead of it sat three frame-relative steps — the
  `Gender` `LabelEncoder`, the zero-fill means, and the affect z-scores — that were undefined for one
  row. `Src/Preprocessed.py` now splits `fit` from `transform` and persists those statistics to
  `models/preprocessor.pkl`, so `preprocess_new(record) → to_model_matrix(...)` scores a raw record.
  `preprocess(df)` is still fit-then-transform on the same frame: correct for the full training CSV
  and wrong for anything smaller. The selector and scaler are still fit before the split (above);
  folding all four stages into one `Pipeline` remains the tidier end state.

## Conventions in this codebase

- Notebooks are committed **with outputs**; keep it that way for review continuity.
- `Src/__init__.py` re-exports the preprocessing and inference helpers but **not** `Src/model.py`,
  `Src/evaluation.py` or `Src/tuning.py`, all of which pull in `xgboost` at module scope. Keep it
  that way: an API that only needs `preprocess_new` should not be forced to install a training
  dependency. `Src/inference.py` qualifies for re-export because it loads estimators through
  `joblib` by name rather than importing `xgboost` — scoring with the `gb` default needs nothing
  beyond sklearn. Preserve that when adding to it.
- **The `Src/` modelling modules form a one-way chain: `model.py` ← `evaluation.py`, `tuning.py`.**
  `model.py` owns the data, the estimators and the artifacts; `evaluation.py` only measures fitted
  models; `tuning.py` only searches for parameters. Neither may be imported *by* `model.py` — that
  would be a cycle. Anything all three need goes in `model.py` or `config.py`.
  `inference.py` sits outside that chain entirely: it depends on `Preprocessed.py` and `config.py`
  only, never on `model.py`, which is what keeps the scoring path free of `xgboost`.
- **`main.py` is the only entry point.** No module under `Src/` has a `main()` or a
  `if __name__ == "__main__"` block, and `python -m Src.<anything>` does nothing — argument parsing
  lives in `main.py`'s subparsers and calls library functions (`build_preprocessed_dataset`,
  `prepare`/`train_models`/`save_artifacts`, `report`, `search`). Add a new runnable step as a
  subcommand there, not as another module `main()`. `main.py` imports the heavy modules *inside* each
  command function, so `python main.py preprocess` still works without `xgboost` installed.
- **New code takes paths from `Src/config.py`** (`Raw_Data_Path`, `Preprocessed_Data_Path`,
  `Model_Path`, `Preprocessor_Path`, `Model_Artifacts_Path`, `Best_Params_Path`, `Seed`,
  `TEST_SIZE`), which resolves them relative to the repo root. The three
  notebooks still hardcode `r'D:\Phone addicted\…'` absolute strings — they resolve on this machine
  and nowhere else. Migrate them to the config module rather than patching the string.
- `preprocessed.ipynb`'s final cell writes to a **relative** `preprocessed_data.csv`, which lands in
  `notebook/` instead of updating the tracked file. `python main.py preprocess` writes to the right
  place; prefer it.
- The package directory is `Src/` with a capital S, and the module is `Preprocessed.py`. Windows is
  case-insensitive, so `src/preprocessed.py` silently resolves to the same file — match the existing
  casing in imports (`from Src.Preprocessed import …`) so it works if the repo is ever cloned on
  Linux.
- Directory names contain spaces (`Raw Data`, `Preprocessed Data`) — quote them in shell commands.
- Commit messages are lowercase, descriptive, and explain *why* (e.g. deferring scaling to avoid
  leakage). Match that style.
