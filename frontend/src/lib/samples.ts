/**
 * Fixture records for the form presets and the batch tab.
 *
 * Inputs only. They used to sit inline in three components and, in the deleted
 * Express layer, a fourth copy behind `GET /api/preset-samples` - four lists
 * that had already drifted apart. One list here, scored by the API like any
 * other input.
 */

import type { RawRecord } from '../types';

export const DEFAULT_RECORD: RawRecord = {
  Age: 15,
  Gender: 'Female',
  School_Grade: '9th',
  Daily_Usage_Hours: 5.5,
  Sleep_Hours: 6.0,
  Academic_Performance: 75,
  Social_Interactions: 4,
  Exercise_Hours: 0.8,
  Anxiety_Level: 6,
  Depression_Level: 5,
  Self_Esteem: 5,
  Parental_Control: 0,
  Screen_Time_Before_Bed: 1.2,
  Phone_Checks_Per_Day: 95,
  Apps_Used_Daily: 14,
  Time_on_Social_Media: 2.8,
  Time_on_Gaming: 1.8,
  Time_on_Education: 0.9,
  Family_Communication: 4,
  Weekend_Usage_Hours: 7.2,
};

export type PresetKey = 'severe' | 'moderate' | 'academic' | 'healthy';

export const PRESETS: Record<PresetKey, RawRecord> = {
  severe: {
    ...DEFAULT_RECORD,
    Age: 14,
    School_Grade: '9th',
    Daily_Usage_Hours: 7.5,
    Sleep_Hours: 4.8,
    Academic_Performance: 62,
    Social_Interactions: 2,
    Exercise_Hours: 0.1,
    Anxiety_Level: 9,
    Depression_Level: 8,
    Self_Esteem: 2,
    Screen_Time_Before_Bed: 2.2,
    Phone_Checks_Per_Day: 140,
    Apps_Used_Daily: 20,
    Time_on_Social_Media: 4.2,
    Time_on_Gaming: 2.8,
    Time_on_Education: 0.5,
    Family_Communication: 2,
    Weekend_Usage_Hours: 9.8,
  },
  moderate: {
    ...DEFAULT_RECORD,
    Age: 16,
    Gender: 'Male',
    School_Grade: '10th',
    Daily_Usage_Hours: 4.8,
    Sleep_Hours: 6.8,
    Academic_Performance: 76,
    Social_Interactions: 5,
    Exercise_Hours: 1.0,
    Anxiety_Level: 4,
    Depression_Level: 4,
    Self_Esteem: 6,
    Screen_Time_Before_Bed: 0.9,
    Phone_Checks_Per_Day: 80,
    Apps_Used_Daily: 11,
    Time_on_Social_Media: 2.2,
    Time_on_Gaming: 1.8,
    Time_on_Education: 0.8,
    Family_Communication: 5,
    Weekend_Usage_Hours: 6.2,
  },
  academic: {
    ...DEFAULT_RECORD,
    Gender: 'Other',
    School_Grade: '10th',
    Daily_Usage_Hours: 3.8,
    Sleep_Hours: 7.5,
    Academic_Performance: 94,
    Social_Interactions: 7,
    Exercise_Hours: 1.2,
    Anxiety_Level: 3,
    Depression_Level: 2,
    Self_Esteem: 8,
    Screen_Time_Before_Bed: 0.4,
    Phone_Checks_Per_Day: 60,
    Apps_Used_Daily: 9,
    Time_on_Social_Media: 0.8,
    Time_on_Gaming: 0.6,
    Time_on_Education: 2.4,
    Family_Communication: 7,
    Weekend_Usage_Hours: 4.2,
  },
  healthy: {
    ...DEFAULT_RECORD,
    School_Grade: '10th',
    Daily_Usage_Hours: 2.0,
    Sleep_Hours: 8.5,
    Academic_Performance: 92,
    Social_Interactions: 8,
    Exercise_Hours: 2.0,
    Anxiety_Level: 2,
    Depression_Level: 1,
    Self_Esteem: 9,
    Parental_Control: 1,
    Screen_Time_Before_Bed: 0.2,
    Phone_Checks_Per_Day: 35,
    Apps_Used_Daily: 6,
    Time_on_Social_Media: 0.8,
    Time_on_Gaming: 0.4,
    Time_on_Education: 0.8,
    Family_Communication: 8,
    Weekend_Usage_Hours: 2.5,
  },
};

export interface BatchProfile {
  id: string;
  name: string;
  tag: string;
  record: RawRecord;
}

/** Five cohort-shaped profiles for the batch tab, scored in one request. */
export const BATCH_PROFILES: BatchProfile[] = [
  {
    id: '1',
    name: 'Shannon Francis (9th Grade)',
    tag: 'High anxiety, heavy weekend spike',
    record: {
      Age: 13, Gender: 'Female', School_Grade: '9th',
      Daily_Usage_Hours: 4.0, Sleep_Hours: 6.1, Academic_Performance: 78,
      Social_Interactions: 5, Exercise_Hours: 0.1, Anxiety_Level: 10,
      Depression_Level: 3, Self_Esteem: 8, Parental_Control: 0,
      Screen_Time_Before_Bed: 1.4, Phone_Checks_Per_Day: 86, Apps_Used_Daily: 19,
      Time_on_Social_Media: 3.6, Time_on_Gaming: 1.7, Time_on_Education: 1.2,
      Family_Communication: 4, Weekend_Usage_Hours: 8.7,
    },
  },
  {
    id: '2',
    name: 'Scott Rodriguez (7th Grade)',
    tag: 'Heavy mobile gaming, zero exercise',
    record: {
      Age: 17, Gender: 'Female', School_Grade: '7th',
      Daily_Usage_Hours: 5.5, Sleep_Hours: 6.5, Academic_Performance: 70,
      Social_Interactions: 5, Exercise_Hours: 0.0, Anxiety_Level: 3,
      Depression_Level: 7, Self_Esteem: 3, Parental_Control: 0,
      Screen_Time_Before_Bed: 0.9, Phone_Checks_Per_Day: 96, Apps_Used_Daily: 9,
      Time_on_Social_Media: 1.1, Time_on_Gaming: 4.0, Time_on_Education: 1.8,
      Family_Communication: 2, Weekend_Usage_Hours: 5.3,
    },
  },
  {
    id: '3',
    name: 'Adrian Knox (11th Grade)',
    tag: 'Frequent pickups (137/day)',
    record: {
      Age: 13, Gender: 'Other', School_Grade: '11th',
      Daily_Usage_Hours: 5.8, Sleep_Hours: 5.5, Academic_Performance: 93,
      Social_Interactions: 8, Exercise_Hours: 0.8, Anxiety_Level: 2,
      Depression_Level: 3, Self_Esteem: 10, Parental_Control: 0,
      Screen_Time_Before_Bed: 0.5, Phone_Checks_Per_Day: 137, Apps_Used_Daily: 8,
      Time_on_Social_Media: 0.3, Time_on_Gaming: 1.5, Time_on_Education: 0.4,
      Family_Communication: 6, Weekend_Usage_Hours: 5.7,
    },
  },
  {
    id: '4',
    name: 'Brittany Hamilton (12th Grade)',
    tag: 'Extreme sleep deficit (3.9h)',
    record: {
      Age: 18, Gender: 'Female', School_Grade: '12th',
      Daily_Usage_Hours: 3.1, Sleep_Hours: 3.9, Academic_Performance: 78,
      Social_Interactions: 8, Exercise_Hours: 1.6, Anxiety_Level: 9,
      Depression_Level: 10, Self_Esteem: 3, Parental_Control: 0,
      Screen_Time_Before_Bed: 1.4, Phone_Checks_Per_Day: 128, Apps_Used_Daily: 7,
      Time_on_Social_Media: 3.1, Time_on_Gaming: 1.6, Time_on_Education: 0.8,
      Family_Communication: 8, Weekend_Usage_Hours: 3.0,
    },
  },
  {
    id: '5',
    name: 'Elena Vance (10th Grade)',
    tag: 'Healthy balance, parental limits on',
    record: {
      Age: 15, Gender: 'Female', School_Grade: '10th',
      Daily_Usage_Hours: 2.0, Sleep_Hours: 8.5, Academic_Performance: 92,
      Social_Interactions: 8, Exercise_Hours: 2.0, Anxiety_Level: 2,
      Depression_Level: 1, Self_Esteem: 9, Parental_Control: 1,
      Screen_Time_Before_Bed: 0.2, Phone_Checks_Per_Day: 35, Apps_Used_Daily: 6,
      Time_on_Social_Media: 0.8, Time_on_Gaming: 0.4, Time_on_Education: 0.8,
      Family_Communication: 8, Weekend_Usage_Hours: 2.5,
    },
  },
];
