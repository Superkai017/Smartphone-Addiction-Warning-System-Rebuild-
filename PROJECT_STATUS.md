# Project Status — 2026-08-27

**Stage:** Preprocessing complete and modelling through tuned ensembles — but all of it lives in the
working tree, uncommitted. `HEAD` is still 18 columns short of a reproducible pipeline.
**Head:** `36bf0f1` · **Since last review:** 6 commits (`14f0bfc..36bf0f1`)
**Health:** 🟡 needs attention — both blockers from the last report are solved on disk and unsaved in
git; a crash now loses the entire feature-engineering and modelling effort for the third time.

## Movement since last review

Real, substantial progress, most of it uncommitted.

- **The reproducibility gap is closed — in the working tree.** `preprocessed.ipynb` grew 15 → 27
  cells; all 24 engineered columns now have source (cells 14–21). Verified against `HEAD`: the same
  18 columns named on 2026-08-23 (`Sleep_Deficit`, `Distress_Index`, the three `_z` scores,
  `Grade_Num`, …) are **still** underivable from committed code.
- **The 130 NaNs are gone.** `df.isna().sum().sum() == 0` on the current CSV, no infinities either.
  Cell 11's `.replace(0, mean)` removed the zero denominators that produced them.
- **`modelling.ipynb` is real work now** — 7 → 18 cells: `SelectKBest(k=18)`, scaling, split, three
  linear models, `GridSearchCV`, three tuned ensembles, a prediction-vs-actual plot, a save cell.
- **The CSV grew to 3000 × 28** (was 25) and now retains `Age`, `Gender`, `Daily_Usage_Hours`,
  partially retiring the "drops every raw predictor" risk.
- **`preprocessed_data.csv` was deleted from git** in `b768e1a` and never re-added. It is untracked.

## Milestones

| # | Milestone | Status | Evidence |
|---|-----------|--------|----------|
| M0 | Environment reproducible | 🔴 Blocked | No manifest. The `venv` kernel is **not a venv** — `%APPDATA%\jupyter\kernels\venv\kernel.json` points at global `Python313\python.exe` (3.13.9). `modelling.ipynb` adds an undeclared `xgboost` dependency. |
| M1 | Data foundation | 🟡 In progress | EDA committed. Target semantics now *decided in code* — continuous target, `r2_score`/`mean_squared_error`, regressors throughout — but README still frames Low/Moderate/High classification. Decided, not written down. |
| M2 | Preprocessing complete | 🟡 In progress | Complete on disk: 24/24 columns traceable, 0 NaNs, runs end to end. **Uncommitted.** At `HEAD`, 18/24 columns remain untraceable — unchanged from the last report. |
| M3 | Split & scaling | 🟡 In progress | Exists, but the order is inverted: `SelectKBest` and `StandardScaler` are fit on the full frame (cells 7–8) *before* `train_test_split` (cell 9). Split is unstratified. |
| M4 | Baseline model | 🟢 Done | Verified on the committed CSV: tuned GB scores **MSE 0.2799 / R² 0.889**; predicting the train mean scores **MSE 2.5193 / R² 0.000** on the same split. The notebook's `las` row (MSE 2.5193, R² −0.00) *is* that naive baseline, reached by accident. |
| M5 | Model selection | 🟡 In progress | rf/gb/xgb compared and tuned (xgb best: MSE 0.258, R² 0.90). Two defects: the `GridSearchCV` cell (14) is **commented out with its outputs retained**, and the save cell (17) is unexecuted and broken. No `models/`. |
| M6 | Inference API | ⚪ Not started | No `src/` or `app/`. |
| M7 | Frontend | ⚪ Not started | — |
| M8 | Packaging | ⚪ Not started | Depends on M0. |

Top-level directories: `data/`, `notebook/`. Unchanged.

## Verified findings this run

**The metric illusion did not materialise — retire that risk.** The ceiling saturation is real
(1524/3000 at 10.0, mean 8.882) but the model beats the naive baseline on the hard part too: on the
295 non-ceiling test rows alone, GB scores **MSE 0.470 / R² 0.811**. Ceiling rows: MSE 0.096.

**The leakage is a rule violation, not a result inflator.** Re-running the same GB inside a
train-only `Pipeline(SelectKBest → StandardScaler)` gives **MSE 0.2799 vs 0.2798** — identical to
four decimals. Fix it because CLAUDE.md forbids it and the API will need the fitted pipeline anyway,
not because the numbers are wrong.

**No psychological feature carries any signal.** `f_regression` p-values: `Distress_Index` 0.13,
`Self_Esteem_z` 0.22, `Anxiety_Level_z` 0.38, `Depression_Level_z` 0.64, `Age` 0.086, `Gender` 0.085,
`Grade_Num` 0.75. `k=18` drops all of them, correctly. The synthetic target is a near-deterministic
function of usage and sleep — `Daily_Usage_Hours` F=1414, `Screen_To_Sleep_Ratio` F=1295. A "warning
system" trained here is learning the generator's arithmetic, not adolescent psychology.

## Open risks

| Risk | Impact | Cheapest fix | First seen |
|------|--------|--------------|-----------|
| **All of M2 and M5 is uncommitted** (7391 insertions across two notebooks) | The commit log already records two crash-related losses (`86c9c29`, `b768e1a`). A third wipes every feature-engineering and modelling cell written since. | `git add notebook/ && git commit` — before anything else on this list | 2026-08-27 |
| Save cell (`modelling.ipynb` c17) does `joblib.dump('rf', …)` — it serialises **the string**, not the fitted model; also shadows the `models` dict from c11 | M5 cannot complete; three tiny `.pkl` files that look like success | Dump `ensemble_models[k]`, not the key. Cell is unexecuted, so nothing is on disk yet | 2026-08-27 |
| Tuning cell (c14) commented out, outputs retained; c15 hardcodes the params from that run | Identical in kind to the M2 gap this report just closed, reappearing at M5 — a committed result that no committed code reproduces | Restore it behind a `RUN_SEARCH = False` guard, or write the best params to a JSON the notebook reads | 2026-08-27 |
| `.replace(0, mean)` applied to `Parental_Control`, a **binary 0/1 flag** with 1478 zeros (49.3%) | "No parental control" becomes 0.5073. `Unsupervised_Usage = Daily × (1 − PC)` is now `Daily × 0.4927` instead of `Daily` for unsupervised teens — the feature is mislabelled, not merely rescaled | Exclude `Parental_Control` from the zero-replacement list | 2026-08-27 |
| The same replacement fabricates activity for genuine zeros: `Exercise_Hours` 366 rows (12.2%), `Social_Interactions` 257 (8.6%), `Time_on_Education` 250 (8.3%) | A teen who exercises zero hours is recorded as average. Feeds `Offline_Activity` and `Online_To_Offline_Ratio` directly | Restrict replacement to `Daily_Usage_Hours` (25 rows), where a zero is genuinely implausible | 2026-08-27 |
| `preprocessed_data.csv` untracked since `b768e1a`; cell 26 writes it to a **relative** path, landing in `notebook/` | The pipeline's output sits outside version control and lands in the wrong directory; the copy in `data/Preprocessed Data/` was placed there by hand | Write to `../data/Preprocessed Data/preprocessed_data.csv`, then commit it | 2026-08-27 |
| Both notebooks still hardcode `r'D:\Phone addicted\...'` | Repo runs on exactly one machine | Repo-relative paths | 2026-08-23 |
| Scaling and selection fit before the split; split unstratified | Violates CLAUDE.md's stated rule and blocks reuse of the transform at inference time | Wrap in a `Pipeline`, fit after the split. Measured cost of the bug itself: nil | 2026-08-23 |
| README frames classification; every line of code does regression | M6 and M7 branch on this | One paragraph in README and CLAUDE.md | 2026-08-23 |
| `Untracked_Hours < 0` in **1582** rows (was 1475); `Leisure_Ratio > 1` in **1025** (was 968) | Worsened by the zero-replacement. Both features are inside the selected k=18 | Source artifact — document the caveat or drop the two features | 2026-08-23 |
| No dependency manifest | Not reproducible on any other machine | `pip freeze > requirements.txt` from Python313 | 2026-08-23 |

## Recommended next 3 actions

1. **Commit the working tree, unfixed, right now.** Six commits of history say this repo loses work.
   The notebooks have defects, but an imperfect commit beats a third loss — fix forward afterwards.
2. **Repair the two M5 defects** — dump the model objects rather than their dictionary keys, and put
   the grid-search code back behind a flag so the hardcoded best-params are reproducible. Both are
   single-cell edits, and they are all that stands between here and a serialised model in `models/`.
3. **Fix `Parental_Control` and re-run preprocessing.** It is the one data defect with wrong
   semantics rather than merely awkward ones, and every downstream artifact inherits it.

## Review log
- 2026-08-23 — Baseline review. M0 blocked, M1–M2 in progress, M3+ not started. 8 open risks, 2 of them blocking execution. (`14f0bfc`)
- 2026-08-27 — M2 gap closed and NaNs resolved, but only in an uncommitted working tree; M4 reached and verified genuine (R² 0.811 off the ceiling, vs 0.000 naive). Leakage confirmed present and measured harmless. New: binary flag corrupted by mean-imputation, model-save cell dumps strings, tuning cell commented out. Metric-illusion risk retired. (`36bf0f1`)
