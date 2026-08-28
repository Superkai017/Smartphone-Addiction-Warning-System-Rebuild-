# Project Status — 2026-08-28

**Stage:** Preprocessing complete and now available as an importable module; modelling extended with a
full evaluation suite and an inference prototype; three models serialized to `models/`. M6 (inference
API) is partially scaffolded but has no service.
**Head:** `42857a1` · **Since last review:** 5 commits (`beb634b..42857a1`) plus this review's own changes
**Health:** 🟢 on track — the pipeline is reproducible from committed code in two independent
implementations, and the leakage question that has been open since 2026-08-23 is now measured rather
than assumed.

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
| M0 | Environment reproducible | 🔴 Blocked | Still no manifest. The `venv` kernel is **not a venv** — `kernel.json` points at global `Python313\python.exe` (3.13.9, pandas 2.2.3, sklearn 1.6.1). `xgboost`, `joblib` and `scipy` are all imported and undeclared. |
| M1 | Data foundation | 🟡 In progress | Target semantics now resolved *in code*: regression, then post-hoc severity bands (`classify_addiction`, cell 28). CLAUDE.md records this; README still frames it as native classification. |
| M2 | Preprocessing complete | 🟢 Done | Two implementations, byte-identical output. Notebook regenerates the CSV exactly (`161eec6`); `Src/Preprocessed.py` verified frame-equal this review. 0 NaNs, 0 infinities. |
| M3 | Split & scaling | 🟡 In progress | Order still inverted — `SelectKBest`/`StandardScaler` fit on the full frame (cells 7–8) before `train_test_split` (cell 9). Now measured: honest CV is *better* than the reported split, so the cost is nil. Split still unstratified. |
| M4 | Baseline model | 🟢 Done | Re-verified this review by reloading the pickles and reproducing the split: rf **0.5111 / R² 0.797**, gb **0.2798 / 0.889**, xgb **0.2578 / 0.898**. Mean-baseline row present in cell 19. |
| M5 | Model selection | 🟢 Done | xgb best. Capacity sweep (cell 20) says no simpler config wins in any family: rf depth-10 +0.021 RMSE, gb lr-0.05 +0.048. Learning curves, residual diagnostics and permutation importance all committed. |
| M6 | Inference API | 🟡 Scaffolded | `Src/` package + `Src.Preprocessed.preprocess()` now covers raw → engineered for a **batch**. Cell 28 prototypes the scoring path end to end (feature order, severity band, per-feature recommendations). No FastAPI app, and single-record scoring is still blocked — see risks. |
| M7 | Frontend | ⚪ Not started | — |
| M8 | Packaging | ⚪ Not started | Depends on M0. |

Top-level directories: `data/`, `notebook/`, `models/`, `Src/`.

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
| **Single-record inference still impossible.** The zero-fill, the z-scores and the `LabelEncoder` are all frame-relative; `preprocessing.pkl` starts after them | M6 cannot score one teenager, which is the entire product | Refit those three as stateful transformers (`SimpleImputer`, `StandardScaler`, a saved encoder) inside one `Pipeline`, fitted on train and serialized whole | 2026-08-27 |
| **Severity bands put 64% of the data in "Severe"**, 1.4% in "Normal" | The user-facing output is near-constant — the warning system rarely says anything but "severe" | Set cut points from the observed distribution, or model the ceiling explicitly (censored regression / two-stage) | 2026-08-28 |
| **Recommendation thresholds are uncalibrated** and fired 14/14 on the demo sample | Advice is generic; every user sees nearly every tip | Derive thresholds from `df[FEATURE_ORDER].quantile([.25,.5,.75])`, cap the number of tips shown | 2026-08-28 |
| **Preprocessing now exists twice** — `notebook/preprocessed.ipynb` and `Src/Preprocessed.py` | They agree today (verified). Nothing enforces that they keep agreeing, and a silent divergence means the model is trained on something other than what the API computes | A test asserting the module reproduces the committed CSV; eventually have the notebook import the module rather than restate it | 2026-08-28 |
| **Model-save cell (c29) is commented out**, as is the tuning cell (c14) | The four artifacts in `models/` have no committed code that reproduces them — the same "committed result, uncommitted code" gap that M2 closed, reappearing at M5/M6 | Restore both behind `RUN_SEARCH = False` / `SAVE_MODELS = False` guards | 2026-08-27 |
| `.replace(0, mean)` applied to `Parental_Control`, a **binary 0/1 flag** with 1478 zeros (49.3%) | "No parental control" becomes 0.5073, so `Unsupervised_Usage = Daily × (1 − PC)` is mislabelled, not merely rescaled. Every artifact in `models/` inherits it | Exclude `Parental_Control` from `ZERO_AS_MISSING` in `Src/Preprocessed.py` and re-run | 2026-08-27 |
| The same replacement fabricates activity for genuine zeros: `Exercise_Hours` 366 rows (12.2%), `Social_Interactions` 257 (8.6%), `Time_on_Education` 250 (8.3%) | A teen who exercises zero hours is recorded as average. Feeds `Offline_Activity` and `Online_To_Offline_Ratio` directly | Restrict replacement to `Daily_Usage_Hours` (25 rows), where zero is genuinely implausible | 2026-08-27 |
| No dependency manifest; kernel named `venv` is not one | Not reproducible on any other machine. M8 blocked | `pip freeze > requirements.txt` from Python313, then a real `.venv` | 2026-08-23 |
| `preprocessed.ipynb` cell 26 writes to a **relative** path, landing in `notebook/` | Re-running the notebook drops a stray copy instead of updating the tracked file | Use `Src.config.Preprocessed_Data_Path`; `python -m Src.Preprocessed` already does | 2026-08-27 |
| All three notebooks hardcode `r'D:\Phone addicted\…'` | Repo runs on exactly one machine. `Src/config.py` now exists to fix this | Import the config module in cell 1 | 2026-08-23 |
| Selection and scaling fit before the split; split unstratified | Rule violation and API blocker. **Measured cost: nil** (honest CV is 0.015–0.026 RMSE *better*) | Wrap in a `Pipeline`, fit after the split | 2026-08-23 |
| README frames Low/Moderate/High classification | Code does regression + post-hoc banding. CLAUDE.md now says so; README does not | One paragraph in README | 2026-08-23 |
| `Untracked_Hours < 0` in **1582** rows; `Leisure_Ratio > 1` in **1025** | Both are inside the selected k=18, and `Untracked_Hours` is the 3rd-largest linear coefficient | Source artifact — document the caveat or drop the two features | 2026-08-23 |
| `models/` holds 6.8 MB of binaries, `model_rf.pkl` alone 5.8 MB | Every clone pays for it; each retrain commits a fresh undeltifiable blob | Fine at this size. If retraining becomes routine, keep only the winner or move to LFS | 2026-08-27 |

## Recommended next 3 actions

1. **Write `requirements.txt` and make a real `.venv`.** M0 has been the top blocker in all three
   reports. Ten minutes of `pip freeze` from Python313 unblocks M8 and makes every other number in
   this file reproducible by someone else.
2. **Collapse preprocessing into one fitted, serializable `Pipeline`.** This single change closes
   four open risks at once: single-record inference, the leakage rule violation, the frame-relative
   statistics, and the duplicate-implementation drift. `Src/Preprocessed.py` is the natural home.
3. **Fix `Parental_Control`, then re-band the output.** The first is a genuine semantic error every
   model inherits; the second is what stands between a good RMSE and a warning system that actually
   varies its warning.

## Review log
- 2026-08-23 — Baseline review. M0 blocked, M1–M2 in progress, M3+ not started. 8 open risks, 2 of them blocking execution. (`14f0bfc`)
- 2026-08-27 — M2 gap closed and NaNs resolved, but only in an uncommitted working tree; M4 reached and verified genuine (R² 0.811 off the ceiling, vs 0.000 naive). Leakage confirmed present and measured harmless. New: binary flag corrupted by mean-imputation, model-save cell dumps strings, tuning cell commented out. Metric-illusion risk retired. (`36bf0f1`)
- 2026-08-27 — Work committed (`9416868`); M2 and M5 closed. Found and fixed a `copy_X` grid entry that centred the training matrix in place and silently degraded every ensemble below it (gb 0.280→0.414, xgb 0.258→0.597) — invisible until the notebook was run in order. rf/gb/xgb serialized to `models/` with their fitted preprocessing and verified by reload. Health 🟡 → 🟢. (`377f228`)
- 2026-08-27 — Reproduction check: all three notebooks execute top to bottom with zero errors in a clean kernel, and `preprocessed.ipynb` regenerates `preprocessed_data.csv` byte-identical to the committed copy. (`161eec6`)
- 2026-08-28 — Preprocessing extracted to `Src/Preprocessed.py` and verified frame-equal to the committed CSV; all three pickles reloaded and re-scored (xgb 0.2578 / R² 0.898). Leakage quantified as harmless via train-only `Pipeline` CV. CLAUDE.md rewritten — it had drifted to describing a notebook-only repo with a 25-column CSV and 130 NaNs. New risks: severity bands put 64% of rows in "Severe", recommendation thresholds uncalibrated, preprocessing now duplicated in two places. (`42857a1`)
