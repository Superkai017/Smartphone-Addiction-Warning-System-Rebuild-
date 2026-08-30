export type GenderType = 'Female' | 'Male' | 'Other';
export type SchoolGradeType = '7th' | '8th' | '9th' | '10th' | '11th' | '12th';
export type SeverityBand = 'Normal' | 'Moderate' | 'Addicted' | 'Severe';
export type ModelType = 'gb' | 'rf' | 'xgb' | 'rid' | 'lr';

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
  featureLabel: string;
  value: number;
  threshold: number;
  direction: 'high' | 'low';
  percentile: number;
  severity: number;
  message: string;
  category: 'Time' | 'Sleep' | 'Mental Health' | 'Habit' | 'Social';
}

export interface PredictionResult {
  score: number;
  band: SeverityBand;
  band_description: string;
  percentile: number;
  model: string;
  n_flagged: number;
  recommendations: Recommendation[];
  engineered_features: Record<string, number>;
}

export interface PredictResponse {
  results: PredictionResult[];
  count: number;
  model_used: string;
  tips: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  model_loaded: boolean;
  default_model: string;
  version: string;
}

export interface ModelInfo {
  id: ModelType;
  name: string;
  type: string;
  testMse: number;
  testR2: number;
  description: string;
  bestUse: string;
}

export interface RuleMeta {
  feature: string;
  label: string;
  direction: 'high' | 'low';
  threshold: number;
  unit: string;
  message: string;
  description: string;
}

export interface CohortStats {
  totalCount: number;
  meanScore: number;
  ceilingPercentage: number;
  bandDistribution: {
    name: SeverityBand;
    percentage: number;
    count: number;
    range: string;
    color: string;
  }[];
  featureDistributions: {
    feature: string;
    label: string;
    p25: number;
    median: number;
    p75: number;
    unit: string;
  }[];
}
