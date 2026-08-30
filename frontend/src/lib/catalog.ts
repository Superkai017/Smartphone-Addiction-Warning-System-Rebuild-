/**
 * Presentation metadata: labels, units, categories, blurbs, chart colours.
 *
 * This is what survived the deletion of `server/engine.ts`. That module mixed
 * two things - display copy, which belongs in the frontend, and *thresholds and
 * a scoring function*, which do not. The numbers are gone: cut points now come
 * from `GET /api/rules` (which reads `models/thresholds.json`) and scores from
 * `POST /api/predict`.
 *
 * The rule that used to hold both is the reason for the split. `Src/inference.py`'s
 * docstring warns that a hardcoded threshold goes stale the moment a
 * preprocessing formula changes, and the deleted module had already drifted:
 * its `Unsupervised_Usage` cut was written against the pre-fix units, and its
 * cohort quartiles disagreed with the dataset (it claimed a 60 / 120 pickup
 * range against a real 51 / 115). Everything left in this file is copy, so it
 * cannot drift into being wrong about the data.
 */

import type { ModelInfo, ModelType, RuleCategory, SeverityBand } from '../types';

export const BAND_ORDER: SeverityBand[] = ['Normal', 'Moderate', 'Addicted', 'Severe'];

export const BAND_COLORS: Record<SeverityBand, string> = {
  Normal: '#10b981',
  Moderate: '#3b82f6',
  Addicted: '#f59e0b',
  Severe: '#ef4444',
};

/** Tailwind classes per band, used by every badge in the UI. */
export const BAND_CLASSES: Record<SeverityBand, string> = {
  Normal: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Moderate: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Addicted: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Severe: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

/**
 * Display copy for each of the 14 calibrated rules, keyed by the feature name
 * the API returns. Deliberately no threshold and no direction - both are served
 * by `/api/rules`, and duplicating them here is what created the drift above.
 */
export const RULE_DISPLAY: Record<
  string,
  { label: string; unit: string; category: RuleCategory; description: string }
> = {
  Daily_Usage_Hours: {
    label: 'Daily Usage Hours',
    unit: 'hrs/day',
    category: 'Time',
    description: 'Total hours of smartphone engagement per day.',
  },
  Leisure_Ratio: {
    label: 'Leisure to Total Ratio',
    unit: 'ratio',
    category: 'Time',
    description:
      'Gaming plus social media as a share of daily phone time. Ranks correctly; the absolute scale is unreliable because the component times exceed the stated total in half the source rows.',
  },
  Education_Ratio: {
    label: 'Educational Utility Ratio',
    unit: 'ratio',
    category: 'Time',
    description: 'Share of mobile activity spent on educational or productive apps.',
  },
  Weekend_Escalation: {
    label: 'Weekend Surge Delta',
    unit: 'hrs spike',
    category: 'Habit',
    description: 'Weekend daily hours minus regular daily usage.',
  },
  Weekend_Ratio: {
    label: 'Weekend Escalation Ratio',
    unit: 'x weekday',
    category: 'Habit',
    description: 'Weekend phone hours relative to the weekday average.',
  },
  Minutes_Per_Check: {
    label: 'Interval Between Checks',
    unit: 'min/pickup',
    category: 'Habit',
    description: 'Average span between consecutive screen unlocks.',
  },
  Hours_Per_App: {
    label: 'Time Per App',
    unit: 'hrs/app',
    category: 'Habit',
    description: 'Average time spent per distinct app opened daily.',
  },
  Sleep_Deficit: {
    label: 'Adolescent Sleep Deficit',
    unit: 'hrs lost',
    category: 'Sleep',
    description: 'Shortfall against the recommended 9 hours of teen sleep.',
  },
  Screen_To_Sleep_Ratio: {
    label: 'Screen-to-Sleep Ratio',
    unit: 'ratio',
    category: 'Sleep',
    description: 'Daily screen hours divided by hours slept.',
  },
  Bedtime_Screen_Share: {
    label: 'Late-Night Bedtime Share',
    unit: 'share',
    category: 'Sleep',
    description: 'Fraction of daily screen time occurring directly before sleep.',
  },
  Online_To_Offline_Ratio: {
    label: 'Online vs Offline Balance',
    unit: 'ratio',
    category: 'Social',
    description: 'Screen hours against combined exercise and in-person socialising.',
  },
  Family_To_Screen_Ratio: {
    label: 'Family Time vs Phone Time',
    unit: 'ratio',
    category: 'Social',
    description: 'Family communication score divided by daily screen hours.',
  },
  Academic_Per_Usage: {
    label: 'Academic Yield per Hour',
    unit: 'yield',
    category: 'Mental Health',
    description: 'Academic performance index relative to daily phone time.',
  },
  Unsupervised_Usage: {
    label: 'Unsupervised Daily Time',
    unit: 'hrs unmonitored',
    category: 'Habit',
    description: 'Screen hours consumed while the parental monitoring flag is off.',
  },
};

export const RULE_CATEGORIES: RuleCategory[] = [
  'Time',
  'Sleep',
  'Habit',
  'Social',
  'Mental Health',
];

/**
 * Model cards. The metrics are the held-out test scores recorded in
 * `PROJECT_STATUS.md` for the committed artifacts - the train-only tuned fit
 * written by `python main.py train --save`.
 *
 * Only the three names with a pickle in `models/`. `GET /api/models` reports
 * which of them this deployment can actually serve, so a card is greyed out
 * rather than offered when e.g. xgboost is not installed.
 */
export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: 'gb',
    name: 'Gradient Boosting Regressor',
    type: 'Tuned Ensemble (Default)',
    testMse: 0.2675,
    testR2: 0.894,
    description:
      'Balanced sklearn ensemble. The service default because it needs no training dependency at inference time.',
    bestUse: 'General screening and any deployment without xgboost installed.',
  },
  {
    id: 'xgb',
    name: 'XGBoost Regressor',
    type: 'Extreme Gradient Boosting',
    testMse: 0.2478,
    testR2: 0.902,
    description:
      'Best held-out score of the three. Requires xgboost on the server; the API answers 503 where it is absent.',
    bestUse: 'Highest-precision scoring where the dependency is available.',
  },
  {
    id: 'rf',
    name: 'Random Forest Regressor',
    type: 'Bagged Decision Ensemble',
    testMse: 0.5113,
    testR2: 0.797,
    description:
      'Bagged ensemble, noticeably weaker here than either boosted model but less sensitive to a single odd input.',
    bestUse: 'A robustness cross-check against volatile self-reported entries.',
  },
];

/**
 * Cohort context for the benchmarks tab.
 *
 * Quantiles are the real ones, measured on the 3,000-row raw dataset. The band
 * shares are the calibrated distribution of *predictions* documented in
 * `CLAUDE.md`: the top band holds 63% because the target is ceiling-censored -
 * 1,524 rows sit exactly at 10.0 - not because the cut points are wrong. That
 * is why the UI shows a percentile next to every band.
 */
export const COHORT = {
  totalCount: 3000,
  meanScore: 8.88,
  ceilingCount: 1524,
  ceilingPercentage: 50.8,
  bandDistribution: [
    { name: 'Normal' as SeverityBand, percentage: 11.3, range: '< 6.7' },
    { name: 'Moderate' as SeverityBand, percentage: 11.9, range: '6.7 - 7.9' },
    { name: 'Addicted' as SeverityBand, percentage: 13.8, range: '8.0 - 8.9' },
    { name: 'Severe' as SeverityBand, percentage: 63.0, range: '9.0 - 10.0' },
  ].map((b) => ({
    ...b,
    count: Math.round((b.percentage / 100) * 3000),
    color: BAND_COLORS[b.name],
  })),
  featureDistributions: [
    { feature: 'Daily_Usage_Hours', label: 'Daily Screen Time', p25: 3.7, median: 5.0, p75: 6.4, unit: 'hrs/day' },
    { feature: 'Sleep_Hours', label: 'Sleep Duration', p25: 5.5, median: 6.5, p75: 7.5, unit: 'hrs/night' },
    { feature: 'Phone_Checks_Per_Day', label: 'Phone Pickups', p25: 51, median: 82, p75: 115.2, unit: 'times/day' },
    { feature: 'Time_on_Social_Media', label: 'Social Media Use', p25: 1.8, median: 2.5, p75: 3.2, unit: 'hrs/day' },
    { feature: 'Time_on_Gaming', label: 'Mobile Gaming', p25: 0.8, median: 1.5, p75: 2.2, unit: 'hrs/day' },
    { feature: 'Screen_Time_Before_Bed', label: 'Bedtime Phone Use', p25: 0.7, median: 1.0, p75: 1.4, unit: 'hrs/night' },
    { feature: 'Weekend_Usage_Hours', label: 'Weekend Usage', p25: 4.7, median: 6.0, p75: 7.4, unit: 'hrs/day' },
    { feature: 'Academic_Performance', label: 'Academic Grades', p25: 62, median: 75, p75: 88, unit: 'points (0-100)' },
  ],
};

export const bandClass = (band: SeverityBand): string =>
  BAND_CLASSES[band] ?? BAND_CLASSES.Normal;

export const modelInfo = (id: ModelType): ModelInfo | undefined =>
  MODEL_CATALOG.find((m) => m.id === id);
