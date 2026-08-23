# Project Status — 2026-08-23

**Stage:** EDA complete; feature engineering half-committed; nothing downstream of preprocessing has started.
**Head:** `14f0bfc` · **Since last review:** baseline report — no prior review to compare against.
**Health:** 🟡 needs attention — neither notebook runs from a clean checkout and 18 of 24 engineered
columns cannot be regenerated from committed code. Held at yellow rather than red because both
blockers are cheap to retire and no completed work has been lost.

## Movement since last review

First review. Baseline established from `14f0bfc` and the 7-commit history behind it.
Working tree carries two untracked files (`CLAUDE.md`, `loop.md`) and no modifications.

## Milestones

| # | Milestone | Status | Evidence |
|---|-----------|--------|----------|
| M0 | Environment reproducible | 🔴 Blocked | No `requirements.txt` / `environment.yml` / `pyproject.toml`. Notebooks bind to kernel `venv` registered in `%APPDATA%\jupyter\kernels`, outside the repo. System `python` (3.10.0rc2) has no pandas. |
| M1 | Data foundation | 🟡 In progress | `eda.ipynb` (16 cells) commits distributions, boxplots, `f_regression` ranking, correlation heatmap. Raw data sourced and documented in README. Blocked from done: target semantics still undecided. |
| M2 | Preprocessing complete | 🟡 In progress | Commit message claims complete; `preprocessed.ipynb` (10 cells) stops after the usage-composition block producing 6 features. CSV holds 24. 130 NaNs across 7 ratio columns remain unhandled. |
| M3 | Split & scaling | ⚪ Not started | Deliberately deferred to post-split to avoid leakage (`14f0bfc`). Correct call — no action needed until M2 closes. |
| M4 | Baseline model | ⚪ Not started | No `models/`, no training code. |
| M5 | Model selection | ⚪ Not started | — |
| M6 | Inference API | ⚪ Not started | No `src/` or `app/`. README specifies FastAPI/Flask. |
| M7 | Frontend | ⚪ Not started | README specifies React/Streamlit. |
| M8 | Packaging | ⚪ Not started | Depends on M0. |

Top-level directories present: `data/`, `notebook/`. That is the whole codebase.

## Open risks

| Risk | Impact | Cheapest fix | First seen |
|------|--------|--------------|-----------|
| Both notebooks read `data\teen_phone_addiction_dataset.csv`, which moved to `data/Raw Data/` in `14f0bfc` | Cell 1 fails on every fresh run; nothing in the repo is currently executable | Replace the two hardcoded absolute paths with repo-relative ones | 2026-08-23 |
| 18 of 24 engineered columns have no committed source code (`Sleep_Deficit`, `Distress_Index`, the three `_z` scores, `Grade_Num`, `Minutes_Per_Check`, `Weekend_Escalation`, …) | `preprocessed_data.csv` cannot be regenerated or audited; any downstream model rests on unreviewable transforms | Recover the lost cells into `preprocessed.ipynb`, re-run, and diff against the committed CSV | 2026-08-23 |
| Target saturated at ceiling: 1524/3000 rows (50.8%) exactly 10.0, mean 8.88 | A constant predictor will post a strong RMSE; model selection at M4–M5 will pick the wrong winner | Decide the metric now — report performance on the non-saturated range separately, or bin and stratify | 2026-08-23 |
| README frames classification (Low/Moderate/High); `Addiction_Level` is continuous 1.0–10.0 | M3 onward branch on this; building before deciding means rework | Owner decision, then write it into README and CLAUDE.md | 2026-08-23 |
| Component times exceed stated total in 1475/3000 rows → `Untracked_Hours` negative, `Leisure_Ratio` > 1.0 in 968 rows | The "residual browsing time" reading of these 6 features is not defensible; they may mislead feature-importance claims | Source-data artifact, not a code bug — either drop the affected features or document the caveat before they reach a model | 2026-08-23 |
| 130 NaNs across 7 ratio columns from `.replace(0, np.nan)` zero-denominator guards | Most sklearn estimators reject NaN; will surface as a hard failure at M4 | Choose impute vs. drop and apply inside the preprocessing notebook | 2026-08-23 |
| No dependency manifest | Project is not reproducible on any other machine | `pip freeze > requirements.txt` from the working kernel | 2026-08-23 |
| `preprocessed_data.csv` drops every raw predictor, keeping only engineered features | Models never see `Daily_Usage_Hours`, `Sleep_Hours`, `Phone_Checks_Per_Day` directly; may be intentional, but it is undocumented | Confirm intent; if unintentional, retain raw columns alongside derived ones | 2026-08-23 |

## Recommended next 3 actions

1. **Fix the two data paths.** Five minutes, and it is the difference between a repo that runs and
   one that does not. Everything else on this list requires executing a notebook first.
2. **Decide regression vs. classification and record it.** Zero code cost, gates M3 through M7.
   Leaving it open means M2's cleanup decisions get made twice.
3. **Close the reproducibility gap in M2.** Recover the 18 missing feature-engineering cells,
   resolve the 130 NaNs in the same pass, and regenerate `preprocessed_data.csv` from a notebook
   that runs top to bottom. Until this lands, M2 is not complete regardless of what the CSV contains.

## Review log
- 2026-08-23 — Baseline review. M0 blocked, M1–M2 in progress, M3+ not started. 8 open risks, 2 of them blocking execution. (`14f0bfc`)
