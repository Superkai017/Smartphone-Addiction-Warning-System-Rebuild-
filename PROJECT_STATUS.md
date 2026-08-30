# Project Status — 2026-08-30

**Stage:** Preprocessing complete and importable; modelling extended with a full evaluation suite;
three models serialized to `models/`; the warning layer (band + percentile + calibrated advice) built
and verified as `Src/inference.py`; **M6 closed — the FastAPI service over it is live and exercised
end to end** (`App/`: `/health`, `/models`, `/predict`).
**Head:** `3c18d94` · **Since the 2026-08-28 baseline:** 20 commits (`42857a1..3c18d94`), plus this review's rewrite of `App/Api.py` and `App/Schemas.py` in the working tree
**Health:** 🟢 on track — the pipeline is reproducible from committed code in two independent
implementations, the leakage question that has been open since 2026-08-23 is now measured rather
than assumed, and the scoring path is reachable over HTTP. One new packaging gap: `fastapi` and
`uvicorn` are not in `requirements.txt`.

## Movement since last review

- **Preprocessing became code, not just a notebook.** `Src/Preprocessed.py` implements the full raw →
  engineered pipeline as importable functions (`preprocess`, `build_preprocessed_dataset`, seven
  `add_*` feature blocks). Verified this review: `assert_frame_equal` against the committed CSV passes
  on all 3000 × 28 — same columns, same dtypes, same values, 0 NaNs. Both `python -m Src.Preprocessed`
  and the script form run clean, and regenerating the CSV leaves `git status` untouched.
- **`Src/` package established** (`abb9d35`, `b4dc0de`, `42857a1`): `config.py` resolves every path
  from the repo root, retiring the hardcoded-absolute-path problem for new code.
- **`modelling.ipynb` grew 14 → 30 cells** (`3badc7c`) with a real evaluation suite: full metric table
  vs. a mean baseline, 5-fold CV train/val gaps, a capacity sweep, learning curves, residual/Q-Q
  diagnostics, permutation importance, and an honest train-only `Pipeline` comparison.
- **The leakage is confirmed harmless, with a number.** Cell 22 wraps each ensemble in a train-only
  `Pipeline(SelectKBest → StandardScaler)` and cross-validates: honest CV RMSE comes in **below** the
  reported test RMSE for all three (rf −0.021, gb −0.026, xgb −0.015). The inverted order is a rule
  violation and an API blocker, not a result inflator.
- **Deterministic leakage ruled out.** Linear R² 0.617 against best-ensemble 0.898 (cell 18) — the
  target is not a linear restatement of its inputs.
- **CLAUDE.md rewritten** against verified state. It had drifted badly: it still described a
  notebook-only repo, a 25-column CSV, 130 unhandled NaNs, an open reproducibility gap, and notebook
  paths that "no longer exist". All corrected.

## Milestones

| # | Milestone | Status | Evidence |
|---|-----------|--------|----------|
| M0 | Environment reproducible | 🟢 Done | **Closed 2026-08-29.** `requirements.txt` pins all 11 dependencies to the working versions; `.venv/` created from Python 3.13.9 and gitignored. `xgboost`, `joblib` and `scipy` are now declared. Remaining nit: the `venv` Jupyter kernel still points at the global Python313 install rather than `.venv`. |
| M1 | Data foundation | 🟡 In progress | Target semantics now resolved *in code*: regression, then post-hoc severity bands (`classify_addiction`, cell 28). CLAUDE.md records this; README still frames it as native classification. |
| M2 | Preprocessing complete | 🟢 Done | Two implementations, byte-identical output. Notebook regenerates the CSV exactly (`161eec6`); `Src/Preprocessed.py` verified frame-equal this review. 0 NaNs, 0 infinities. |
| M3 | Split & scaling | 🟡 In progress | Order still inverted — `SelectKBest`/`StandardScaler` fit on the full frame (cells 7–8) before `train_test_split` (cell 9). Now measured: honest CV is *better* than the reported split, so the cost is nil. Split still unstratified. |
| M4 | Baseline model | 🟢 Done | Re-verified 2026-08-28 by reloading the pickles and reproducing the split: rf **0.5111 / R² 0.797**, gb **0.2798 / 0.889**, xgb **0.2578 / 0.898**. After the 2026-08-29 grid search `Src/model.py` scores rf **0.5113 / 0.797**, gb **0.2675 / 0.894**, xgb **0.2478 / 0.902**, and the pickles in `models/` now hold exactly that — reloaded and round-tripped to the same four decimals after `train --save`. Mean-baseline row present in cell 19. |
| M5 | Model selection | 🟢 Done | xgb best. Capacity sweep (cell 20) says no simpler config wins in any family: rf depth-10 +0.021 RMSE, gb lr-0.05 +0.048. Learning curves, residual diagnostics and permutation importance all committed. `Src/tuning.py` (2026-08-29) makes the searches behind the hyperparameters re-runnable — 1189 candidates, 5945 fits, over a `Pipeline` so each fold refits selection and scaling. |
| M6 | Inference API | 🟢 Done | **Closed 2026-08-30.** `App/` is a three-module FastAPI package over `Src/inference.Scorer`: `Schemas.py` (wire format, constants imported from `Src.inference` so it cannot drift), `dependencies.py` (`lru_cache`d `Scorer.load` per model name, `warm()` in `lifespan`), `Api.py` (`GET /health`, `GET /models`, `POST /predict`). Verified against the real artifacts this review — health `{"status":"ok","model_loaded":true,"default_model":"gb"}`, `/models` `{"available":["rf","gb","xgb"]}`, `/predict` 200 on the schema's own example (score **10.0 / "Severe" / 75.0th percentile**, 5 of 14 rules flagged, 3 returned) and on a 200-row batch of the raw CSV, `model="xgb"` + `tips=5` honoured, `Gender="Nonbinary"` → **422** carrying `validate_raw`'s message, `Sleep_Hours=0` and `records=[]` → **422** field-level from pydantic. Booted under real uvicorn (`python -m uvicorn App.Api:app`) and served `/health`. fastapi 0.141.1 / uvicorn 0.52.4 / pydantic 2.13.5. |
| M7 | Frontend | ⚪ Not started | Now unblocked — `/predict` returns the full payload a UI needs. |
| M8 | Packaging | ⚪ Not started | Depends on M0. Newly blocked on `requirements.txt`, which does not pin `fastapi`/`uvicorn`/`pydantic`. |

Top-level directories: `data/`, `notebook/`, `models/`, `Src/`, `App/`.

## Verified findings this review

**The raw → engineered gap is closed for batch input, but not for a single record.** This was the
headline M6 blocker on 2026-08-27, and `Src/Preprocessed.py` resolves most of it. What remains is
narrower and more specific: three steps compute their statistics from whatever frame is passed in, so
they are undefined for one row.

- `impute_zeros_with_mean` fills from `df[col].mean()` of the input frame
- `add_psychological_composite` z-scores against the input frame's mean/std
- `encode_gender` refits a `LabelEncoder` on every call

Scoring one teenager requires those fitted statistics to be persisted. Nothing persists them today.
`preprocessing.pkl` still resumes from the engineered 27-column frame (`selector.n_features_in_ = 27`,
`scaler` 18) — confirmed again this review.

> **Resolved 2026-08-29.** Measured on raw row 7 (`Gender = "Other"`), the three steps were not merely
> undefined but silently wrong: gender encoded 0 instead of 2, both z-scores `NaN`, and
> `Unsupervised_Usage` 5.1 instead of 2.5126 because `Parental_Control = 0` was never imputed.
> `Src/Preprocessed.py` now separates `fit(df) → state` from `transform(df, state)` and writes the
> state to `models/preprocessor.pkl`. `preprocess_new()` takes a dict, a list of dicts or a frame;
> `to_model_matrix()` applies `preprocessing.pkl`'s selector and scaler to reach the 18 model columns.
> `validate_raw()` rejects missing columns, nulls, unseen `Gender` values, unparsable `School_Grade`
> and zeros in the three divisors that are *not* zero-imputed (`Sleep_Hours`, `Phone_Checks_Per_Day`,
> `Apps_Used_Daily`) instead of emitting `inf`.
>
> Verified: `preprocess(raw)` is still `assert_frame_equal` to the committed CSV (the tracked file is
> unchanged after a re-run); one record dict, a 20-row chunk and the full frame all reproduce their
> rows of that CSV through the saved state; gb scores raw row 7 to **8.5006** identically via
> `preprocess_new` and via the committed batch frame.

**The severity bands inherit the ceiling problem.** `classify_addiction` splits at 4/6/9. Applied to
the committed target, that puts **1926 of 3000 rows (64.2%) in "Severe Addicted"** and just 41 (1.4%)
in "Normal". A warning system whose modal output is "severe" carries little information, however good
its RMSE. The banding needs to be set from the distribution, or the ceiling censoring needs handling
upstream.

**The recommendation rules are not calibrated.** Cell 28 says so in its own comment — the thresholds
are "reasonable starting assumptions, not derived from this dataset's actual distribution". Its own
demo output flags **14 of 14 tracked features** for a single sample. Rules that fire on everything do
not discriminate.

**All three ensembles carry a wide train/validation gap** (cell 20): rf 0.324 → 0.703, gb 0.164 →
0.532, xgb 0.181 → 0.520. The capacity sweep says shrinking them makes validation worse in every
family, so this is the bias-variance floor for this feature set rather than a tuning mistake — but it
should not be described as a well-fit model.

## Historical: the bug that was hiding behind execution order

Retained because the lesson still governs how this repo is worked on. A `copy_X: [True, False]` entry
in the Ridge/Lasso grids made `GridSearchCV` refit a `copy_X=False` winner in the calling process,
centring `X_new_train` **in place** while `X_new_test` was left alone. Every cell below trained on
shifted data and scored against unshifted data (gb 0.280 → 0.414, xgb 0.258 → 0.597). It stayed
invisible because the notebook had never been run in order — the ensembles executed before the search.
Fixed in `377f228`.

**Run notebooks top to bottom before trusting any number in them.**

## Open risks

| Risk | Impact | Cheapest fix | First seen |
|------|--------|--------------|-----------|
| ~~**Single-record inference still impossible.**~~ **Closed 2026-08-29.** `fit`/`transform` split in `Src/Preprocessed.py`; the gender classes, zero-fill means and affect moments now persist to `models/preprocessor.pkl` and are replayed by `preprocess_new()` | Was: M6 cannot score one teenager, which is the entire product | Done. Residual: `models/preprocessor.pkl` must be refit alongside any formula change, and it is a plain dict rather than a `Pipeline` | 2026-08-27 |
| ~~**Severity bands put 64% of the data in "Severe"**, 1.4% in "Normal"~~ **Partly closed 2026-08-29.** Cuts now come from the 1476 non-ceiling rows (`[6.7, 8.0, 9.0]`), fixing the bottom three bands: 11.3 / 11.9 / 13.8% of predictions vs 1.2 / 5.8 / 30.1% before | The top band is **still 63%** and no absolute cut point can change that — it is ceiling censoring in the source data. Mitigated, not solved: `percentile` is now returned alongside the band and separates a 37th-percentile "Severe" from a 75th. **Seen live over HTTP 2026-08-30:** the first 200 raw rows scored through `/predict` come back **63.5% "Severe"**, and the mildest of those sits at the **37.3rd percentile** — a below-median teenager labelled with the worst band. Any frontend must render the percentile, not just the band | Remaining fix is upstream — censored regression or a two-stage model. Do not chase it with more thresholds | 2026-08-28 |
| ~~**Recommendation thresholds are uncalibrated** and fired 14/14 on the demo sample~~ **Closed 2026-08-29.** Thresholds are q75/q25 of each feature, written to `models/thresholds.json` by `main.py calibrate`. Worse than "uncalibrated" on inspection: `Academic_Per_Usage < 0.2` was **dead code** (feature runs 11–29, fired 0.0%) and `Weekend_Ratio > 0.6` fired on **90.6%**. All 14 rules now fire on 23.5–25.6%; tips are ranked by cohort percentile and capped at 3 (median 3 flagged, max 9, never 14) | Was: advice generic, every user saw nearly every tip | Done. Residual: rule thresholds are feature quantiles, so they go stale on any preprocessing-formula change — recalibrate alongside `preprocessor.pkl` | 2026-08-28 |
| **`requirements.txt` does not pin `fastapi`, `uvicorn` or `pydantic`** | A fresh clone installs the pipeline and then cannot start the API — the manifest no longer describes the project. M8 blocker, and the same class of failure M0 closed on 2026-08-29 | Add the three pins at the versions `.venv` runs (`fastapi==0.141.1`, `uvicorn==0.52.4`, `pydantic==2.13.5`) under a `# --- api ---` heading | 2026-08-30 |
| **The API has no tests**, and neither does anything else | `/predict` was verified by hand this review; nothing re-checks that the schema still matches `Scorer.score`'s payload, or that a bad `Gender` still yields 422 rather than 500. `Schemas.py` importing its constants from `Src.inference` prevents *constant* drift, not shape drift | A `TestClient` smoke test over the four cases already exercised by hand. It needs no network and no fixtures — the artifacts are committed | 2026-08-30 |
| **Preprocessing now exists twice** — `notebook/preprocessed.ipynb` and `Src/Preprocessed.py` | They agree today (verified). Nothing enforces that they keep agreeing, and a silent divergence means the model is trained on something other than what the API computes | A test asserting the module reproduces the committed CSV; eventually have the notebook import the module rather than restate it | 2026-08-28 |
| ~~**Model-save cell (c29) is commented out**, as is the tuning cell (c14).~~ **Closed 2026-08-29.** `main.py train --save` is c29; `Src/tuning.py` is c12+c14, runnable on demand. Its `models/best_params.json` is gitignored, so the tracked record of the search is the constants in `Src/model.py` plus their before/after CV numbers | Was: the artifacts in `models/` had no committed code that reproduces them, and the searches behind the hyperparameters were folklore | Done, and as of 2026-08-29 `--save` has been run: the committed pickles *are* the train-only tuned fit | 2026-08-27 |
| ~~`.replace(0, mean)` applied to `Parental_Control`, a **binary 0/1 flag** with 1478 zeros (49.3%)~~ **Closed 2026-08-29.** Excluded from `ZERO_AS_MISSING`; CSV, `preprocessor.pkl`, `preprocessing.pkl`, `model_*.pkl` and `thresholds.json` all regenerated, notebook mirrored and re-executed | **The stated impact was wrong and is corrected here.** Imputation mapped the flag to {0.5073, 1}, so `1 − PC` became {0.4927, 0} = **exactly 0.492667 × the correct {1, 0}**. A positive scalar multiple is invisible to `StandardScaler` and `f_regression`, so no model ever saw it: post-fix `evaluate` reproduces every metric to 4 dp and `SelectKBest` keeps the same 18 with an identical F of 97.572. The real damage was semantic — `Unsupervised_Usage` held 0.49 × hours, so the calibrated advice threshold was in fabricated units (2.4633 → **5.0000** real hours) | Done | 2026-08-27 |
| The same replacement fabricates activity for genuine zeros: `Exercise_Hours` 366 rows (12.2%), `Social_Interactions` 257 (8.6%), `Time_on_Education` 250 (8.3%) | A teen who exercises zero hours is recorded as average. Feeds `Offline_Activity` and `Online_To_Offline_Ratio` directly. **Unlike `Parental_Control` this is not a rescale** — it moves only the zero rows and leaves the rest, so it genuinely distorts the fitted models and the metrics will move when it is fixed | Restrict replacement to `Daily_Usage_Hours` (25 rows), where zero is genuinely implausible. Then re-run preprocess → train --save → calibrate --save | 2026-08-27 |
| ~~No dependency manifest; kernel named `venv` is not one~~ **Closed 2026-08-29.** `requirements.txt` + a real `.venv` | Was: not reproducible on any other machine, M8 blocked | Done. Residual: the Jupyter kernel still binds to global Python313, not `.venv` | 2026-08-23 |
| `preprocessed.ipynb` cell 26 writes to a **relative** path, landing in `notebook/` | Re-running the notebook drops a stray copy instead of updating the tracked file | Use `Src.config.Preprocessed_Data_Path`; `python main.py preprocess` already does | 2026-08-27 |
| All three notebooks hardcode `r'D:\Phone addicted\…'` | Repo runs on exactly one machine. `Src/config.py` now exists to fix this | Import the config module in cell 1 | 2026-08-23 |
| Selection and scaling fit before the split; split unstratified | Rule violation and API blocker. **Measured cost: nil** (honest CV is 0.015–0.026 RMSE *better*). `Src/model.py` now fits both on train only and lands on the same metrics to 4 dp, so the notebook is the only remaining offender. Split still unstratified everywhere | Re-run the notebook in `Src/model.py`'s order, or have it import the module. Stratify on a binned target | 2026-08-23 |
| README frames Low/Moderate/High classification | Code does regression + post-hoc banding. CLAUDE.md now says so; README does not | One paragraph in README | 2026-08-23 |
| `Untracked_Hours < 0` in **1582** rows; `Leisure_Ratio > 1` in **1025** | Both are inside the selected k=18, and `Untracked_Hours` is the 3rd-largest linear coefficient | Source artifact — document the caveat or drop the two features | 2026-08-23 |
| `models/` holds 6.8 MB of binaries, `model_rf.pkl` alone 5.8 MB | Every clone pays for it; each retrain commits a fresh undeltifiable blob | Fine at this size. If retraining becomes routine, keep only the winner or move to LFS | 2026-08-27 |

## Recommended next 3 actions

1. **Pin `fastapi`, `uvicorn` and `pydantic` in `requirements.txt`.** One-line-each fix for a
   manifest that no longer installs the project it describes, and the cheapest of the three.
2. **Add a `TestClient` smoke test** over the four cases verified by hand this review (health,
   `/models`, a 200 predict, a 422 on unseen `Gender`). This is the repo's first test, so it also
   settles where tests live and how they run — and it is the only thing that will catch
   `Schemas.py` drifting from `Scorer.score`'s payload shape after a preprocessing change.
3. **Stop mean-imputing the remaining genuine zeros** (`Exercise_Hours` 366 rows,
   `Social_Interactions` 257, `Time_on_Education` 250). This is the last open *data* defect and,
   unlike `Parental_Control`, it is not a rescale — the fitted models and every metric will move.
   Restrict replacement to `Daily_Usage_Hours`, then re-run `preprocess` → `train --save` →
   `calibrate --save` in that order. (`model_rf.pkl`'s 17 MB and folding selection/scaling into one
   `Pipeline` both remain open — see the risk table — but neither blocks a user-facing improvement.)

## Review log
- 2026-08-30 — **M6 closed: the FastAPI service is live.** Started from a
  `ModuleNotFoundError: No module named 'App'`, which turned out to be two faults stacked. The
  reported one is invocation, not code: `python App/Api.py` puts `App/` on `sys.path[0]` instead of
  the repo root, so the absolute `App.` and `Src.` imports cannot resolve — only
  `python -m uvicorn App.Api:app` from the root works, and that is now recorded in CLAUDE.md.
  Fixing it exposed the second: `Api.py` as committed in `3c18d94` was generic **classification**
  boilerplate (`predict_proba`, a hardcoded `0.5` threshold) importing `model, preprocessor,
  thresholds` from `App/dependencies.py`, which exports neither — none of the three names exist, and
  the project does regression plus post-hoc banding anyway. `Schemas.py` was the same boilerplate
  and had to go with it — a `PredictRequest` of `{data, threshold}` and a `PredictionResult` of
  `{prediction, probability, label}`, which describe a classifier this repo does not contain, so
  `/predict` raised `AttributeError: 'PredictRequest' object has no attribute 'model'` rather than
  answering. Both rewritten against `dependencies.py`: `lifespan` calls `warm()`, `/predict` scores
  the whole batch in one `Scorer.score` call, `ValueError` → 422 and
  `FileNotFoundError`/`ImportError` → 503, `/health` never raises, and a new `/models` probes what
  actually loads so a caller finds an absent `xgboost` there rather than through a 503. `Schemas.py`
  now imports `BAND_LABELS`, `DEFAULT_MODEL`, `MAX_TIPS` and `RULES` from `Src.inference` and
  asserts its `RawRecord` covers `REQUIRED_RAW_COLUMNS` at import time, so a pipeline column added
  later fails at startup rather than as a 422 on every request. Verified against the committed artifacts: the schema's example
  record returns **10.0 / "Severe" / 75.0th percentile** with 5 of 14 rules flagged and 3 returned;
  `Gender="Nonbinary"` → 422 carrying `validate_raw`'s own message; `Sleep_Hours=0` → 422 caught
  field-level by pydantic; real uvicorn boots and serves `/health`. A 200-row batch bands **63.5% "Severe"**, the
  mildest at the 37.3rd percentile — **the ceiling-censoring risk showing up in a user-facing
  response**, logged against that row.
  New gap: `requirements.txt` still pins only the pipeline, so a fresh clone cannot start the API.
- 2026-08-29 — **`Parental_Control` excluded from `ZERO_AS_MISSING`**, and the repo's own account of
  why that mattered turned out to be wrong. The imputation was an *exact positive rescale* of
  `Unsupervised_Usage` (×0.492667), which `StandardScaler` and `f_regression` cannot see: post-fix
  `evaluate` reproduces all 14 metric cells to 4 dp, the selected 18 are unchanged, and F is
  identical at 97.572. So no model was ever corrupted — but the column's *units* were fabricated,
  which is what reached users through the advice layer (q75 threshold 2.4633 → 5.0000 real hours).
  Regenerated the CSV (one column changed, `Unsupervised_Usage`, now a clean 0/1 mask), mirrored the
  change into `notebook/preprocessed.ipynb` and re-executed it (output still `assert_frame_equal` to
  the tracked CSV), then ran `train --save` and `calibrate --save`. The retrain was **required, not
  cosmetic**: `preprocessing.pkl`'s scaler held the old moments (mean 1.2297 vs 2.4960) and would
  have mis-scaled the column by 2×. Side effect: `model_rf.pkl` 5.8 MB → 17 MB.
- 2026-08-29 — **Warning layer built and calibrated** (`Src/inference.py`, `main.py calibrate` /
  `score`, `models/thresholds.json`). `modelling.ipynb` cell 28's prototype was measured against the
  real distribution before being replaced: of its 14 hardcoded rules one could never fire
  (`Academic_Per_Usage < 0.2`, feature range 11–29) and one fired on 90.6% of the cohort
  (`Weekend_Ratio > 0.6`). Re-derived at q75/q25, all 14 fire on 23.5–25.6%, median 3 per teenager
  and never more than 9. Band cuts had a subtler problem: the documented fix — quartiles of the
  target — is impossible, because 50.8% of the target sits at the ceiling and drags the median there
  too, degenerating the cuts to `[8.0, 10.0, 10.0]`. Taking them from the 1476 uncensored rows gives
  `[6.7, 8.0, 9.0]` and spreads the bottom three bands (11.3 / 11.9 / 13.8% vs 1.2 / 5.8 / 30.1%);
  the top band stays at 63% and a `percentile` field was added because no cut point can fix that.
  Verified end to end: raw row 7 scores **8.501 / "Addicted" / 30th percentile** through
  `Scorer.score`, matching the 8.5006 recorded below. `python main.py --help` still runs on the
  dependency-free interpreter.
- 2026-08-23 — Baseline review. M0 blocked, M1–M2 in progress, M3+ not started. 8 open risks, 2 of them blocking execution. (`14f0bfc`)
- 2026-08-27 — M2 gap closed and NaNs resolved, but only in an uncommitted working tree; M4 reached and verified genuine (R² 0.811 off the ceiling, vs 0.000 naive). Leakage confirmed present and measured harmless. New: binary flag corrupted by mean-imputation, model-save cell dumps strings, tuning cell commented out. Metric-illusion risk retired. (`36bf0f1`)
- 2026-08-27 — Work committed (`9416868`); M2 and M5 closed. Found and fixed a `copy_X` grid entry that centred the training matrix in place and silently degraded every ensemble below it (gb 0.280→0.414, xgb 0.258→0.597) — invisible until the notebook was run in order. rf/gb/xgb serialized to `models/` with their fitted preprocessing and verified by reload. Health 🟡 → 🟢. (`377f228`)
- 2026-08-27 — Reproduction check: all three notebooks execute top to bottom with zero errors in a clean kernel, and `preprocessed.ipynb` regenerates `preprocessed_data.csv` byte-identical to the committed copy. (`161eec6`)
- 2026-08-29 — Evaluation split into `Src/evaluation.py`, hyperparameter search added as `Src/tuning.py`, and every entry point moved to `main.py` (`preprocess`/`train`/`evaluate`/`tune`/`all`); no module under `Src/` has a `main()` any more. Full grid run: 1189 candidates, 5945 fits, 21 min (`models/best_params.json`, gitignored). Five of six models improved and the constants in `Src/model.py` were updated — gb test MSE 0.2799 → **0.2675** (R² 0.8938), xgb 0.2578 → **0.2478** (0.9016), and off the ceiling gb 0.4701 → **0.4348**, xgb 0.4378 → **0.4176**. `las` was the big one: default `alpha=1.0` had it scoring the mean baseline, and `alpha=0.01` takes CV RMSE 1.6135 → 1.0058. Caveat: `rid`'s +0.0025 win is train-fold-CV only — it is marginally *worse* on the test fold and on full-frame CV, which is noise against a 0.038 std. Kept anyway, because selecting on the test fold is the thing this repo is trying not to do. **`models/*.pkl` now lag the constants**; they need a `python main.py train --save`.
- 2026-08-29 — `Src/model.py` finished: split → `SelectKBest(k=18)` → `StandardScaler` fitted on train only, the notebook's tuned hyperparameters as constants, a metrics table that also scores the 295 non-ceiling test rows, honest `Pipeline` CV behind `--cv`, and c29's save behind `--save`. Reproduces the notebook to 4 dp (gb 0.2799 / R² 0.8889, xgb 0.2578 / 0.8977; gb 0.4701 / 0.8110 off the ceiling), which settles the leakage question empirically. Honest CV: xgb 0.4925 ± 0.0198 vs 0.5078 reported — CV still the better number. Note `Lasso()` at default `alpha=1.0` collapses to the mean baseline (R² 0.00) in both the notebook and the module.
- 2026-08-29 — Single-record inference unblocked. `Src/Preprocessed.py` split into `fit`/`transform` with the three frame-relative statistics persisted to `models/preprocessor.pkl`; added `preprocess_new`, `to_model_matrix` and `validate_raw`. Batch output byte-identical to the committed CSV; one record dict reproduces its CSV row and scores to the same gb prediction (8.5006) as the batch path. Top M6 risk closed.
- 2026-08-28 — Preprocessing extracted to `Src/Preprocessed.py` and verified frame-equal to the committed CSV; all three pickles reloaded and re-scored (xgb 0.2578 / R² 0.898). Leakage quantified as harmless via train-only `Pipeline` CV. CLAUDE.md rewritten — it had drifted to describing a notebook-only repo with a 25-column CSV and 130 NaNs. New risks: severity bands put 64% of rows in "Severe", recommendation thresholds uncalibrated, preprocessing now duplicated in two places. (`42857a1`)
