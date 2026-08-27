# Project Status — 2026-08-27

**Stage:** Preprocessing complete, modelling through tuned ensembles, three models serialized to
`models/`. Working tree clean. M6 (inference API) is the next unstarted milestone.
**Head:** `377f228` · **Since last review:** 8 commits (`14f0bfc..377f228`)
**Health:** 🟢 on track — everything is committed, the modelling notebook is deterministic top to
bottom, and every saved artifact has been reloaded and verified against its reported metrics.

## Movement since last review

Real, substantial progress — and as of `9416868`/`377f228`, all of it is committed.

- **`9416868` committed the backlog**: both notebooks, plus `preprocessed_data.csv` restored to
  tracking after being dropped in `b768e1a`. The standing data-loss risk is retired.
- **`377f228` serialized rf/gb/xgb to `models/`** and fixed the two defects that stood in the way —
  see "The bug that was hiding behind execution order" below.
- **The reproducibility gap is closed.** `preprocessed.ipynb` grew 15 → 27
  cells; all 24 engineered columns now have source (cells 14–21). The 18 columns named on 2026-08-23
  (`Sleep_Deficit`, `Distress_Index`, the three `_z` scores, `Grade_Num`, …) are derivable from
  committed code for the first time.
- **The 130 NaNs are gone.** `df.isna().sum().sum() == 0` on the current CSV, no infinities either.
  Cell 11's `.replace(0, mean)` removed the zero denominators that produced them.
- **`modelling.ipynb` is real work now** — 7 → 18 cells: `SelectKBest(k=18)`, scaling, split, three
  linear models, `GridSearchCV`, three tuned ensembles, a prediction-vs-actual plot, a save cell.
- **The CSV grew to 3000 × 28** (was 25) and now retains `Age`, `Gender`, `Daily_Usage_Hours`,
  partially retiring the "drops every raw predictor" risk.

## Milestones

| # | Milestone | Status | Evidence |
|---|-----------|--------|----------|
| M0 | Environment reproducible | 🔴 Blocked | No manifest. The `venv` kernel is **not a venv** — `%APPDATA%\jupyter\kernels\venv\kernel.json` points at global `Python313\python.exe` (3.13.9). `modelling.ipynb` adds an undeclared `xgboost` dependency. |
| M1 | Data foundation | 🟡 In progress | EDA committed. Target semantics now *decided in code* — continuous target, `r2_score`/`mean_squared_error`, regressors throughout — but README still frames Low/Moderate/High classification. Decided, not written down. |
| M2 | Preprocessing complete | 🟢 Done | 24/24 columns traceable to committed code, 0 NaNs and 0 infinities verified on the committed CSV, notebook runs end to end. |
| M3 | Split & scaling | 🟡 In progress | Exists, but the order is inverted: `SelectKBest` and `StandardScaler` are fit on the full frame (cells 7–8) *before* `train_test_split` (cell 9). Split is unstratified. |
| M4 | Baseline model | 🟢 Done | Verified on the committed CSV: tuned GB scores **MSE 0.2798 / R² 0.889**; predicting the train mean scores **MSE 2.5193 / R² 0.000** on the same split. The notebook's `las` row (MSE 2.5193, R² −0.00) *is* that naive baseline, reached by accident. |
| M5 | Model selection | 🟢 Done | rf/gb/xgb compared and tuned; xgb best at **MSE 0.2578 / R² 0.898**. `models/` holds `model_{rf,gb,xgb}.pkl` plus `preprocessing.pkl` (fitted `SelectKBest` + `StandardScaler` + feature list). All four reloaded and re-scored — metrics reproduce exactly. |
| M6 | Inference API | ⚪ Not started | No `src/` or `app/`. `preprocessing.pkl` gives it a loadable contract to build against. |
| M7 | Frontend | ⚪ Not started | — |
| M8 | Packaging | ⚪ Not started | Depends on M0. |

Top-level directories: `data/`, `notebook/`, `models/` (new).

## The bug that was hiding behind execution order

The single most important finding of this run. `copy_X: [True, False]` sat in the Ridge and Lasso
search grids (cell 12). `copy_X` is a memory-management flag, not a hyperparameter — but
`GridSearchCV` refits the winning estimator **in the calling process**, so whenever a `copy_X=False`
combination won, sklearn centred `X_new_train` **in place**. `X_new_test` was left untouched,
desyncing train from test by up to 0.013 per column. Every cell below then trained on shifted data
and was scored against unshifted data.

Measured cost, top to bottom: **gb MSE 0.280 → 0.414, xgb 0.258 → 0.597, rf 0.511 → 0.530**.

Two things kept it invisible. It is intermittent — `solver='sag'` carries no `random_state`, so
whether a `copy_X=False` combination wins varies run to run. And the notebook had never been run in
order: the ensembles were executed at `exec=80`, *before* the search at `exec=83`, so they happened
to see clean data. Fixed in `377f228` by dropping `copy_X` from all three grids. The notebook now
returns identical ensemble metrics across consecutive top-to-bottom runs.

**The lesson generalises past this bug:** non-linear execution order was hiding a real defect, and
would have shipped corrupted models. Run the notebook top to bottom before trusting any number in it.

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
| Tuning cell (c14) commented out, outputs retained; c15 hardcodes the params from that run | Identical in kind to the M2 gap this report closed, reappearing at M5 — a committed result that no committed code reproduces. Its outputs were preserved by hand through the re-runs; a plain re-execution wipes them | Restore it behind a `RUN_SEARCH = False` guard, or write the best params to a JSON the notebook reads | 2026-08-27 |
| Linear search (c12) still reports wandering best-params between runs — `max_iter` `None`/`1000`/`5000`, `selection` `cyclic`/`random` | Cosmetic now that `copy_X` is gone, but the reported "best parameters" are not reproducible. `solver='sag'`/`'saga'` carry no `random_state`, and several combinations tie | Pass `random_state=42` to the Ridge/Lasso estimators in c11 | 2026-08-27 |
| c12 grids still contain invalid combinations — `svd` + `positive=True` for Ridge, `max_iter=None` for Lasso | ~3960 of 9720 fits fail and score `nan`, filling the output with `FitFailedWarning` tracebacks and slowing the search | Drop `None` from Lasso's `max_iter`; drop `svd`/`cholesky` or `positive` from the Ridge grid | 2026-08-27 |
| `models/` adds 6.5 MB of binaries to git, `model_rf.pkl` alone 5.8 MB | Every clone pays for it, and each retrain commits a fresh 5.8 MB blob that git cannot delta-compress | Fine at this size. If retraining becomes routine, keep only the winner or move to LFS | 2026-08-27 |
| `.replace(0, mean)` applied to `Parental_Control`, a **binary 0/1 flag** with 1478 zeros (49.3%) | "No parental control" becomes 0.5073. `Unsupervised_Usage = Daily × (1 − PC)` is now `Daily × 0.4927` instead of `Daily` for unsupervised teens — the feature is mislabelled, not merely rescaled | Exclude `Parental_Control` from the zero-replacement list | 2026-08-27 |
| The same replacement fabricates activity for genuine zeros: `Exercise_Hours` 366 rows (12.2%), `Social_Interactions` 257 (8.6%), `Time_on_Education` 250 (8.3%) | A teen who exercises zero hours is recorded as average. Feeds `Offline_Activity` and `Online_To_Offline_Ratio` directly | Restrict replacement to `Daily_Usage_Hours` (25 rows), where a zero is genuinely implausible | 2026-08-27 |
| `preprocessed.ipynb` cell 26 writes the CSV to a **relative** path, landing in `notebook/` | The file is tracked again as of `9416868`, but re-running preprocessing drops a stray copy in `notebook/` instead of updating the tracked one | Write to `../data/Preprocessed Data/preprocessed_data.csv` | 2026-08-27 |
| Both notebooks still hardcode `r'D:\Phone addicted\...'` | Repo runs on exactly one machine | Repo-relative paths | 2026-08-23 |
| Scaling and selection fit before the split; split unstratified | Violates CLAUDE.md's stated rule and blocks reuse of the transform at inference time | Wrap in a `Pipeline`, fit after the split. Measured cost of the bug itself: nil | 2026-08-23 |
| README frames classification; every line of code does regression | M6 and M7 branch on this | One paragraph in README and CLAUDE.md | 2026-08-23 |
| `Untracked_Hours < 0` in **1582** rows (was 1475); `Leisure_Ratio > 1` in **1025** (was 968) | Worsened by the zero-replacement. Both features are inside the selected k=18 | Source artifact — document the caveat or drop the two features | 2026-08-23 |
| No dependency manifest | Not reproducible on any other machine | `pip freeze > requirements.txt` from Python313 | 2026-08-23 |

## Recommended next 3 actions

1. **Fix `Parental_Control` and re-run preprocessing.** It is the one remaining data defect with
   genuinely wrong semantics rather than merely awkward ones, and every artifact in `models/`
   currently inherits it through `Unsupervised_Usage`.
2. **Move selection and scaling behind the split into a `Pipeline`.** M6 needs one fitted object to
   load anyway, `preprocessing.pkl` is already that object in embryo, and it closes the last
   standing leakage complaint at the same time. Measured accuracy cost: nil.
3. **Write `requirements.txt` and stop calling the kernel `venv`.** M0 has been the top blocker in
   both reports. `pip freeze` from Python313 plus a real `.venv` is under ten minutes, and M8
   cannot start until it lands.

## Review log
- 2026-08-23 — Baseline review. M0 blocked, M1–M2 in progress, M3+ not started. 8 open risks, 2 of them blocking execution. (`14f0bfc`)
- 2026-08-27 — M2 gap closed and NaNs resolved, but only in an uncommitted working tree; M4 reached and verified genuine (R² 0.811 off the ceiling, vs 0.000 naive). Leakage confirmed present and measured harmless. New: binary flag corrupted by mean-imputation, model-save cell dumps strings, tuning cell commented out. Metric-illusion risk retired. (`36bf0f1`)
- 2026-08-27 — Work committed (`9416868`); M2 and M5 closed. Found and fixed a `copy_X` grid entry that centred the training matrix in place and silently degraded every ensemble below it (gb 0.280→0.414, xgb 0.258→0.597) — invisible until the notebook was run in order. rf/gb/xgb serialized to `models/` with their fitted preprocessing and verified by reload. Health 🟡 → 🟢. (`377f228`)
