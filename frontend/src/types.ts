/**
 * The wire format, mirroring `App/Schemas.py`.
 *
 * Nothing in this package computes a score. Every number the UI renders comes
 * from `POST /api/predict`, which runs the real serialized estimators through
 * `Src/inference.py`. The types below therefore describe *responses*, not a
 * local model.
 */

export type GenderType = 'Female' | 'Male' | 'Other';
export type SchoolGradeType = '7th' | '8th' | '9th' | '10th' | '11th' | '12th';
export type SeverityBand = 'Normal' | 'Moderate' | 'Addicted' | 'Severe';

/**
 * Only the three names that have an artifact in `models/`. `rid` and `lr` were
 * listed here before and had no pickle behind them - a request for either
 * would have been a 503.
 */
export type ModelType = 'gb' | 'rf' | 'xgb';

/** The 20 columns of `Src.Preprocessed.REQUIRED_RAW_COLUMNS`. */
export interface RawRecord {
  Age: number;
  Gender: GenderType;
  School_Grade: SchoolGradeType;
  Daily_Usage_Hours: number;
  Sleep_Hours: number;
  Academic_Performance: number;
  Social_Interactions: number;
  Exercise_Hours: number;
  Anxiety_Level: number;
  Depression_Level: number;
  Self_Esteem: number;
  Parental_Control: number;
  Screen_Time_Before_Bed: number;
  Phone_Checks_Per_Day: number;
  Apps_Used_Daily: number;
  Time_on_Social_Media: number;
  Time_on_Gaming: number;
  Time_on_Education: number;
  Family_Communication: number;
  Weekend_Usage_Hours: number;
}

export interface Recommendation {
  feature: string;
  value: number;
  threshold: number;
  direction: 'high' | 'low';
  percentile: number;
  severity: number;
  message: string;
}

export interface PredictionResult {
  score: number;
  band: SeverityBand;
  band_description: string;
  percentile: number;
  model: string;
  n_flagged: number;
  recommendations: Recommendation[];
}

export interface PredictResponse {
  results: PredictionResult[];
  count: number;
  model_used: string;
  tips: number;
  /** Primary keys of the rows this call wrote; empty when `persist=false`. */
  history_ids: number[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  model_loaded: boolean;
  default_model: string;
  version: string;
}

export interface ModelsResponse {
  available: ModelType[];
  default: ModelType;
}

/** One calibrated rule as `GET /api/rules` serves it, thresholds included. */
export interface RuleMeta {
  feature: string;
  direction: 'high' | 'low';
  message: string;
  threshold: number | null;
  quantile: number | null;
}

export interface RulesResponse {
  rules: RuleMeta[];
  band_labels: SeverityBand[];
  band_cuts: number[];
  score_range: [number, number];
  cohort_rows: number;
  ceiling_share: number;
  max_tips: number;
}

/** One persisted run from `prediction_history`. */
export interface HistoryRecord {
  id: number;
  timestamp: string;
  /** Re-postable to `/api/predict` verbatim - this is the "load into form" payload. */
  record: RawRecord;
  model_name: ModelType;
  tips: number;
  prediction_score: number;
  band: SeverityBand;
  band_description: string;
  percentile: number;
  n_flagged: number;
  recommendations: Recommendation[];
}

export interface HistoryListResponse {
  items: HistoryRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeleteResponse {
  deleted: number;
  id: number | null;
}

/** Presentation metadata for a model card. Not served by the API - see `catalog.ts`. */
export interface ModelInfo {
  id: ModelType;
  name: string;
  type: string;
  testMse: number;
  testR2: number;
  description: string;
  bestUse: string;
}

export type RuleCategory = 'Time' | 'Sleep' | 'Mental Health' | 'Habit' | 'Social';

/** A `RuleMeta` joined to its display label and category from `catalog.ts`. */
export interface DisplayRule extends RuleMeta {
  label: string;
  unit: string;
  category: RuleCategory;
  description: string;
}
