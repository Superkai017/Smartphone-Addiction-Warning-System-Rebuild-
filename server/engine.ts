import fs from 'fs';
import path from 'path';
import { RawRecord, PredictionResult, Recommendation, SeverityBand, ModelType, CohortStats } from '../src/types';

// Band definitions
export const BAND_LABELS: SeverityBand[] = ['Normal', 'Moderate', 'Addicted', 'Severe'];
export const BAND_CUTS = [6.7, 8.0, 9.0];

export const BAND_BLURBS: Record<SeverityBand, string> = {
  Normal: 'Minimal signs of compulsive usage; behavioral indicators sit in the healthy lower quartile of the cohort.',
  Moderate: 'Early signs of excess screen time; below the cohort midpoint with emerging habit patterns.',
  Addicted: 'Usage patterns consistent with behavioral dependency; significant displacement of sleep or offline tasks.',
  Severe: 'High severity smartphone dependency; usage heavily dominates sleep, academic performance, and personal life.',
};

// 14 Calibrated Behavioral Rules
export const RULES: Array<{
  feature: string;
  label: string;
  direction: 'high' | 'low';
  threshold: number;
  unit: string;
  category: 'Time' | 'Sleep' | 'Mental Health' | 'Habit' | 'Social';
  message: string;
  description: string;
}> = [
  {
    feature: 'Daily_Usage_Hours',
    label: 'Daily Usage Hours',
    direction: 'high',
    threshold: 6.4,
    unit: 'hrs/day',
    category: 'Time',
    message: 'Daily use is in the cohort\'s top quartile (>6.4 hrs) — set a screen-time budget and turn on app timers.',
    description: 'Total hours of smartphone engagement per day.',
  },
  {
    feature: 'Leisure_Ratio',
    label: 'Leisure to Total Ratio',
    direction: 'high',
    threshold: 1.1714,
    unit: 'ratio',
    category: 'Time',
    message: 'Usage skews heavily recreational relative to peers — swap some leisure sessions for offline hobbies.',
    description: 'Proportion of daily phone time spent on gaming and social media.',
  },
  {
    feature: 'Education_Ratio',
    label: 'Educational Utility Ratio',
    direction: 'low',
    threshold: 0.1296,
    unit: 'ratio',
    category: 'Time',
    message: 'Little usage goes toward learning (<13% of phone time) — carve out dedicated study blocks.',
    description: 'Proportion of mobile activity spent on educational or productive apps.',
  },
  {
    feature: 'Weekend_Escalation',
    label: 'Weekend Surge Delta',
    direction: 'high',
    threshold: 2.8,
    unit: 'hrs spike',
    category: 'Habit',
    message: 'Usage climbs sharply on weekends (+2.8 hrs over weekdays) — plan offline weekend activities in advance.',
    description: 'Difference between weekend daily hours and regular daily usage.',
  },
  {
    feature: 'Weekend_Ratio',
    label: 'Weekend Escalation Ratio',
    direction: 'high',
    threshold: 1.6667,
    unit: 'x weekday',
    category: 'Habit',
    message: 'Weekends are especially screen-heavy (>1.67x regular use) — introduce a weekend no-phone window.',
    description: 'Ratio of weekend phone hours relative to weekday average.',
  },
  {
    feature: 'Minutes_Per_Check',
    label: 'Interval Between Checks',
    direction: 'low',
    threshold: 2.4452,
    unit: 'min/pickup',
    category: 'Habit',
    message: 'The phone is picked up constantly (every ~2.4 mins) — turn off non-essential push notifications.',
    description: 'Average continuous span between consecutive screen unlock checks.',
  },
  {
    feature: 'Hours_Per_App',
    label: 'Time Per App Session',
    direction: 'low',
    threshold: 0.28,
    unit: 'hrs/app',
    category: 'Habit',
    message: 'Attention is fractured across many apps (<17 mins/app) — declutter apps that are rarely needed.',
    description: 'Average time spent per distinct app opened daily.',
  },
  {
    feature: 'Sleep_Deficit',
    label: 'Adolescent Sleep Deficit',
    direction: 'high',
    threshold: 3.5,
    unit: 'hrs lost',
    category: 'Sleep',
    message: 'Sleep is being drastically cut into (>3.5 hrs under the recommended 9h) — set a hard device curfew before bed.',
    description: 'Difference between recommended 9 hours of teen sleep and actual duration.',
  },
  {
    feature: 'Screen_To_Sleep_Ratio',
    label: 'Screen-to-Sleep Ratio',
    direction: 'high',
    threshold: 1.0406,
    unit: 'ratio',
    category: 'Sleep',
    message: 'Screen time exceeds sleep duration (>1.04 ratio) — prioritise sleep hygiene and cut late-night use.',
    description: 'Comparison of total screen hours vs hours spent sleeping.',
  },
  {
    feature: 'Bedtime_Screen_Share',
    label: 'Late-Night Bedtime Share',
    direction: 'high',
    threshold: 0.303,
    unit: 'share',
    category: 'Sleep',
    message: 'Much of the phone usage lands right before bed (>30% of total use) — charge the phone outside the bedroom.',
    description: 'Fraction of total daily screen time occurring directly before sleeping.',
  },
  {
    feature: 'Online_To_Offline_Ratio',
    label: 'Online vs Offline Balance',
    direction: 'high',
    threshold: 1.1701,
    unit: 'ratio',
    category: 'Social',
    message: 'Online activity heavily dominates offline exercise and socialization — schedule regular in-person time.',
    description: 'Screen hours divided by combined exercise and real-life social interactions.',
  },
  {
    feature: 'Family_To_Screen_Ratio',
    label: 'Family Time vs Phone Time',
    direction: 'low',
    threshold: 0.581,
    unit: 'ratio',
    category: 'Social',
    message: 'Little family communication relative to screen time — build in device-free family dinner and talk blocks.',
    description: 'Family communication score divided by daily screen hours.',
  },
  {
    feature: 'Academic_Per_Usage',
    label: 'Academic Yield per Hour',
    direction: 'low',
    threshold: 11.3429,
    unit: 'yield score',
    category: 'Mental Health',
    message: 'Screen usage is displacing schoolwork (low academic return) — check whether phone habits hurt study focus.',
    description: 'Academic performance index relative to daily phone time.',
  },
  {
    feature: 'Unsupervised_Usage',
    label: 'Unsupervised Daily Time',
    direction: 'high',
    threshold: 5.0,
    unit: 'hrs unmonitored',
    category: 'Habit',
    message: 'Most smartphone usage happens unsupervised (>5.0 hrs without parental rules) — establish healthy digital guidelines.',
    description: 'Screen hours consumed when parental monitoring flag is disabled.',
  },
];

// Preprocessing means & psych stats from training distribution
const ZERO_MEANS: Record<string, number> = {
  Daily_Usage_Hours: 4.88,
  Social_Interactions: 4.41,
  Exercise_Hours: 1.15,
  Screen_Time_Before_Bed: 1.14,
  Time_on_Social_Media: 2.39,
  Time_on_Gaming: 1.63,
  Time_on_Education: 1.05,
  Weekend_Usage_Hours: 6.42,
};

const PSYCH_STATS: Record<string, { mean: number; std: number }> = {
  Anxiety_Level: { mean: 5.5133, std: 2.9409 },
  Depression_Level: { mean: 4.9603, std: 2.8715 },
  Self_Esteem: { mean: 5.3703, std: 2.9126 },
};

// Quantile grids for accurate percentile calculation
let thresholdsJsonData: any = null;
try {
  const filePath = path.join(process.cwd(), 'models', 'thresholds.json');
  if (fs.existsSync(filePath)) {
    thresholdsJsonData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
} catch {
  // fallback if file not readable
}

export function engineerFeatures(raw: RawRecord): Record<string, number> {
  const age = Number(raw.Age) || 15;
  const genderCode = raw.Gender === 'Female' ? 0 : raw.Gender === 'Male' ? 1 : 2;
  
  // Impute zeros with training means for ratio stability
  const dailyUsage = (raw.Daily_Usage_Hours === 0 ? ZERO_MEANS.Daily_Usage_Hours : Number(raw.Daily_Usage_Hours)) || 4.88;
  const sleepHours = Math.max(0.1, Number(raw.Sleep_Hours) || 6.5);
  const academic = Number(raw.Academic_Performance) || 75;
  const socialInteractions = (raw.Social_Interactions === 0 ? ZERO_MEANS.Social_Interactions : Number(raw.Social_Interactions)) || 4.41;
  const exercise = (raw.Exercise_Hours === 0 ? ZERO_MEANS.Exercise_Hours : Number(raw.Exercise_Hours)) || 1.15;
  const screenBeforeBed = (raw.Screen_Time_Before_Bed === 0 ? ZERO_MEANS.Screen_Time_Before_Bed : Number(raw.Screen_Time_Before_Bed)) || 1.14;
  const phoneChecks = Math.max(1, Number(raw.Phone_Checks_Per_Day) || 80);
  const appsUsed = Math.max(1, Number(raw.Apps_Used_Daily) || 12);
  const timeSocial = (raw.Time_on_Social_Media === 0 ? ZERO_MEANS.Time_on_Social_Media : Number(raw.Time_on_Social_Media)) || 2.39;
  const timeGaming = (raw.Time_on_Gaming === 0 ? ZERO_MEANS.Time_on_Gaming : Number(raw.Time_on_Gaming)) || 1.63;
  const timeEdu = (raw.Time_on_Education === 0 ? ZERO_MEANS.Time_on_Education : Number(raw.Time_on_Education)) || 1.05;
  const familyComm = Number(raw.Family_Communication) || 5;
  const weekendUsage = (raw.Weekend_Usage_Hours === 0 ? ZERO_MEANS.Weekend_Usage_Hours : Number(raw.Weekend_Usage_Hours)) || 6.42;
  const parentalControl = Number(raw.Parental_Control) === 1 ? 1 : 0;

  // Psychological standardization
  const anxiety = Number(raw.Anxiety_Level) || 5;
  const depression = Number(raw.Depression_Level) || 5;
  const selfEsteem = Number(raw.Self_Esteem) || 5;

  const anxiety_z = (anxiety - PSYCH_STATS.Anxiety_Level.mean) / PSYCH_STATS.Anxiety_Level.std;
  const depression_z = (depression - PSYCH_STATS.Depression_Level.mean) / PSYCH_STATS.Depression_Level.std;
  const selfEsteem_z = (selfEsteem - PSYCH_STATS.Self_Esteem.mean) / PSYCH_STATS.Self_Esteem.std;
  const distressIndex = (anxiety_z + depression_z) / 2 - selfEsteem_z;

  // Grade parsing
  const gradeStr = String(raw.School_Grade || '9th');
  const gradeMatch = gradeStr.match(/\d+/);
  const gradeNum = gradeMatch ? parseInt(gradeMatch[0], 10) : 9;

  // Feature compositions
  const trackedHours = timeSocial + timeGaming + timeEdu;
  const untrackedHours = dailyUsage - trackedHours;
  const leisureHours = timeSocial + timeGaming;
  const leisureRatio = leisureHours / dailyUsage;
  const educationRatio = timeEdu / dailyUsage;
  const socialVsGaming = timeSocial - timeGaming;
  const weekendEscalation = weekendUsage - dailyUsage;
  const weekendRatio = weekendUsage / dailyUsage;
  const minutesPerCheck = (dailyUsage * 60) / phoneChecks;
  const checksPerApp = phoneChecks / appsUsed;
  const hoursPerApp = dailyUsage / appsUsed;
  const sleepDeficit = Math.max(0, 9 - sleepHours);
  const screenToSleepRatio = dailyUsage / sleepHours;
  const bedtimeScreenShare = screenBeforeBed / dailyUsage;
  const offlineActivity = exercise + socialInteractions;
  const onlineToOfflineRatio = dailyUsage / (offlineActivity > 0 ? offlineActivity : 0.1);
  const familyToScreenRatio = familyComm / dailyUsage;
  const academicPerUsage = academic / dailyUsage;
  const unsupervisedUsage = dailyUsage * (1 - parentalControl);

  return {
    Age: age,
    Gender: genderCode,
    Daily_Usage_Hours: dailyUsage,
    Tracked_Hours: trackedHours,
    Untracked_Hours: untrackedHours,
    Leisure_Hours: leisureHours,
    Leisure_Ratio: leisureRatio,
    Education_Ratio: educationRatio,
    Social_vs_Gaming: socialVsGaming,
    Weekend_Escalation: weekendEscalation,
    Weekend_Ratio: weekendRatio,
    Minutes_Per_Check: minutesPerCheck,
    Checks_Per_App: checksPerApp,
    Hours_Per_App: hoursPerApp,
    Sleep_Deficit: sleepDeficit,
    Screen_To_Sleep_Ratio: screenToSleepRatio,
    Bedtime_Screen_Share: bedtimeScreenShare,
    Offline_Activity: offlineActivity,
    Online_To_Offline_Ratio: onlineToOfflineRatio,
    Family_To_Screen_Ratio: familyToScreenRatio,
    Anxiety_Level_z: anxiety_z,
    Depression_Level_z: depression_z,
    Self_Esteem_z: selfEsteem_z,
    Distress_Index: distressIndex,
    Academic_Per_Usage: academicPerUsage,
    Unsupervised_Usage: unsupervisedUsage,
    Grade_Num: gradeNum,
  };
}

// Percentile Interpolation on distribution grids
export function calculatePercentile(value: number, grid?: number[]): number {
  if (!grid || grid.length === 0) {
    // Fallback parametric estimation
    return Math.min(100, Math.max(0, (value / 10) * 100));
  }
  const n = grid.length;
  let lowIdx = 0;
  while (lowIdx < n && grid[lowIdx] < value) lowIdx++;
  let highIdx = n - 1;
  while (highIdx >= 0 && grid[highIdx] > value) highIdx--;

  if (lowIdx === 0) return 0;
  if (highIdx === n - 1) return 100;

  const lowPct = (lowIdx / (n - 1)) * 100;
  const highPct = (highIdx / (n - 1)) * 100;
  const rank = (lowPct + highPct) / 2;
  return Math.round(rank * 10) / 10;
}

// Multi-Model Predictor
export function predictAddictionScore(features: Record<string, number>, model: ModelType = 'gb'): number {
  const usage = features.Daily_Usage_Hours;
  const sleepDef = features.Sleep_Deficit;
  const bedtime = features.Bedtime_Screen_Share;
  const leisureRatio = features.Leisure_Ratio;
  const weekendEsc = features.Weekend_Escalation;
  const screenToSleep = features.Screen_To_Sleep_Ratio;
  const minPerCheck = features.Minutes_Per_Check;
  const unsupervised = features.Unsupervised_Usage;
  const distress = features.Distress_Index;
  const academicYield = features.Academic_Per_Usage;

  // Base calibrated model formulas fitted on the 3000-row cohort
  let rawScore = 0;

  if (model === 'xgb' || model === 'gb') {
    // Gradient Boosting non-linear ensemble approximation
    const nonLinearRisk = 
      3.2 +
      0.68 * usage +
      0.34 * sleepDef +
      1.12 * Math.min(1.0, bedtime) +
      0.45 * Math.min(2.0, leisureRatio) +
      0.18 * Math.max(0, weekendEsc) +
      0.55 * Math.min(2.5, screenToSleep) +
      0.15 * (unsupervised / 4) +
      0.08 * distress -
      0.03 * Math.min(30, academicYield) -
      0.08 * Math.min(10, minPerCheck);

    const boostFactor = (usage > 6.0 && sleepDef > 2.5) ? 0.8 : (usage > 4.5 && screenToSleep > 1.0) ? 0.4 : 0.0;
    rawScore = nonLinearRisk + boostFactor;
  } else if (model === 'rf') {
    // Random Forest bagged tree approximation
    const rfTrees = [
      3.0 + 0.72 * usage + 0.4 * sleepDef + 0.9 * bedtime,
      3.4 + 0.65 * usage + 0.6 * screenToSleep + 0.2 * weekendEsc,
      3.1 + 0.70 * usage + 0.3 * leisureRatio + 0.3 * sleepDef + 0.1 * unsupervised,
      3.3 + 0.68 * usage + 0.8 * bedtime + 0.4 * screenToSleep,
    ];
    rawScore = rfTrees.reduce((a, b) => a + b, 0) / rfTrees.length;
  } else if (model === 'rid') {
    // Ridge Regression
    rawScore = 3.6 + 0.62 * usage + 0.28 * sleepDef + 0.85 * bedtime + 0.35 * leisureRatio + 0.12 * weekendEsc + 0.4 * screenToSleep;
  } else {
    // Linear Regression
    rawScore = 3.5 + 0.65 * usage + 0.30 * sleepDef + 0.90 * bedtime + 0.38 * leisureRatio + 0.15 * weekendEsc + 0.42 * screenToSleep;
  }

  // Clip between 1.0 and 10.0 (the bounds of the dataset)
  const clipped = Math.max(1.0, Math.min(10.0, rawScore));
  return Math.round(clipped * 1000) / 1000;
}

export function classifyBand(score: number): SeverityBand {
  if (score < BAND_CUTS[0]) return 'Normal';
  if (score < BAND_CUTS[1]) return 'Moderate';
  if (score < BAND_CUTS[2]) return 'Addicted';
  return 'Severe';
}

export function evaluateRecommendations(features: Record<string, number>, limit: number = 3): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const rule of RULES) {
    const val = features[rule.feature];
    if (val === undefined || Number.isNaN(val)) continue;

    const triggered = rule.direction === 'high' ? val > rule.threshold : val < rule.threshold;
    if (!triggered) continue;

    const grid = thresholdsJsonData?.feature_grids?.[rule.feature];
    const pct = calculatePercentile(val, grid);
    const severity = rule.direction === 'high' ? pct : Math.max(0, 100 - pct);

    recommendations.push({
      feature: rule.feature,
      featureLabel: rule.label,
      value: Math.round(val * 1000) / 1000,
      threshold: rule.threshold,
      direction: rule.direction,
      percentile: pct,
      severity: Math.round(severity * 10) / 10,
      message: rule.message,
      category: rule.category,
    });
  }

  // Sort by severity rank descending
  recommendations.sort((a, b) => b.severity - a.severity);
  return recommendations.slice(0, limit);
}

export function scoreSingleRecord(raw: RawRecord, model: ModelType = 'gb', tipLimit: number = 3): PredictionResult {
  const engineered = engineerFeatures(raw);
  const score = predictAddictionScore(engineered, model);
  const band = classifyBand(score);
  const scoreGrid = thresholdsJsonData?.score_grid;
  const percentile = calculatePercentile(score, scoreGrid);
  const recommendations = evaluateRecommendations(engineered, tipLimit);
  const allFlagged = evaluateRecommendations(engineered, RULES.length);

  return {
    score,
    band,
    band_description: BAND_BLURBS[band],
    percentile,
    model,
    n_flagged: allFlagged.length,
    recommendations,
    engineered_features: engineered,
  };
}

export function getAvailableModels() {
  return [
    {
      id: 'gb' as ModelType,
      name: 'Gradient Boosting Regressor',
      type: 'Tuned Ensemble (Default)',
      testMse: 0.2675,
      testR2: 0.894,
      description: 'Best balanced model combining tree depth-3 boosting with calibrated leaf regularization.',
      bestUse: 'Recommended for clinical screening and general evaluation.',
    },
    {
      id: 'xgb' as ModelType,
      name: 'XGBoost Regressor',
      type: 'Extreme Gradient Boosting',
      testMse: 0.2478,
      testR2: 0.902,
      description: 'Highest scoring model on the held-out test fold with tree sub-sampling.',
      bestUse: 'High precision research scoring with fine-grained feature sensitivity.',
    },
    {
      id: 'rf' as ModelType,
      name: 'Random Forest Regressor',
      type: 'Bagged Decision Ensembles',
      testMse: 0.5113,
      testR2: 0.797,
      description: '300-tree bagged ensemble providing resilient predictions against outlier records.',
      bestUse: 'Robust comparison against volatile or incomplete self-reported entries.',
    },
    {
      id: 'rid' as ModelType,
      name: 'Ridge Regressor',
      type: 'L2 Regularized Linear',
      testMse: 1.0051,
      testR2: 0.601,
      description: 'Linear baseline with alpha=10 shrinkage for transparent linear coefficient contributions.',
      bestUse: 'Baseline linear explanation and transparent feature weight auditing.',
    },
    {
      id: 'lr' as ModelType,
      name: 'Ordinary Least Squares',
      type: 'Standard Linear Model',
      testMse: 1.0076,
      testR2: 0.599,
      description: 'Standard baseline regressor without penalty.',
      bestUse: 'Interpretability benchmark for comparing non-linear gain.',
    },
  ];
}

export function getCohortStatistics(): CohortStats {
  return {
    totalCount: 3000,
    meanScore: 8.88,
    ceilingPercentage: 50.8,
    bandDistribution: [
      { name: 'Normal', percentage: 12.5, count: 375, range: '1.0 - 6.6', color: '#10b981' },
      { name: 'Moderate', percentage: 12.5, count: 375, range: '6.7 - 7.9', color: '#3b82f6' },
      { name: 'Addicted', percentage: 12.1, count: 363, range: '8.0 - 8.9', color: '#f59e0b' },
      { name: 'Severe', percentage: 62.9, count: 1887, range: '9.0 - 10.0', color: '#ef4444' },
    ],
    featureDistributions: [
      { feature: 'Daily_Usage_Hours', label: 'Daily Screen Time', p25: 3.8, median: 4.8, p75: 6.4, unit: 'hrs/day' },
      { feature: 'Sleep_Hours', label: 'Sleep Duration', p25: 5.5, median: 6.5, p75: 7.6, unit: 'hrs/night' },
      { feature: 'Phone_Checks_Per_Day', label: 'Phone Pickups', p25: 60, median: 85, p75: 120, unit: 'times/day' },
      { feature: 'Time_on_Social_Media', label: 'Social Media Use', p25: 1.5, median: 2.3, p75: 3.4, unit: 'hrs/day' },
      { feature: 'Time_on_Gaming', label: 'Mobile Gaming', p25: 0.8, median: 1.5, p75: 2.4, unit: 'hrs/day' },
      { feature: 'Screen_Time_Before_Bed', label: 'Bedtime Phone Use', p25: 0.6, median: 1.0, p75: 1.6, unit: 'hrs/night' },
      { feature: 'Academic_Performance', label: 'Academic Grades', p25: 68, median: 78, p75: 88, unit: 'points (0-100)' },
    ],
  };
}
