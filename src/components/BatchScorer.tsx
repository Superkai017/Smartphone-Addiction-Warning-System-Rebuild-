import React from 'react';
import { RawRecord, ModelType } from '../types';
import { scoreSingleRecord } from '../../server/engine';
import { Sparkles } from 'lucide-react';

interface BatchScorerProps {
  selectedModel: ModelType;
  onLoadRecord: (record: RawRecord) => void;
}

export const BatchScorer: React.FC<BatchScorerProps> = ({
  selectedModel,
  onLoadRecord,
}) => {
  const sampleProfiles: Array<{ id: string; name: string; tag: string; record: RawRecord }> = [
    {
      id: '1',
      name: 'Shannon Francis (9th Grade)',
      tag: 'Severe Screen Time & Spikes',
      record: {
        Age: 13,
        Gender: 'Female',
        School_Grade: '9th',
        Daily_Usage_Hours: 4.0,
        Sleep_Hours: 6.1,
        Academic_Performance: 78,
        Social_Interactions: 5,
        Exercise_Hours: 0.1,
        Anxiety_Level: 10,
        Depression_Level: 3,
        Self_Esteem: 8,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 1.4,
        Phone_Checks_Per_Day: 86,
        Apps_Used_Daily: 19,
        Time_on_Social_Media: 3.6,
        Time_on_Gaming: 1.7,
        Time_on_Education: 1.2,
        Family_Communication: 4,
        Weekend_Usage_Hours: 8.7,
      },
    },
    {
      id: '2',
      name: 'Scott Rodriguez (7th Grade)',
      tag: 'Heavy Mobile Gaming & Zero Exercise',
      record: {
        Age: 17,
        Gender: 'Female',
        School_Grade: '7th',
        Daily_Usage_Hours: 5.5,
        Sleep_Hours: 6.5,
        Academic_Performance: 70,
        Social_Interactions: 5,
        Exercise_Hours: 0.0,
        Anxiety_Level: 3,
        Depression_Level: 7,
        Self_Esteem: 3,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 0.9,
        Phone_Checks_Per_Day: 96,
        Apps_Used_Daily: 9,
        Time_on_Social_Media: 1.1,
        Time_on_Gaming: 4.0,
        Time_on_Education: 1.8,
        Family_Communication: 2,
        Weekend_Usage_Hours: 5.3,
      },
    },
    {
      id: '3',
      name: 'Adrian Knox (11th Grade)',
      tag: 'Frequent Pickups (137/day)',
      record: {
        Age: 13,
        Gender: 'Other',
        School_Grade: '11th',
        Daily_Usage_Hours: 5.8,
        Sleep_Hours: 5.5,
        Academic_Performance: 93,
        Social_Interactions: 8,
        Exercise_Hours: 0.8,
        Anxiety_Level: 2,
        Depression_Level: 3,
        Self_Esteem: 10,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 0.5,
        Phone_Checks_Per_Day: 137,
        Apps_Used_Daily: 8,
        Time_on_Social_Media: 0.3,
        Time_on_Gaming: 1.5,
        Time_on_Education: 0.4,
        Family_Communication: 6,
        Weekend_Usage_Hours: 5.7,
      },
    },
    {
      id: '4',
      name: 'Brittany Hamilton (12th Grade)',
      tag: 'Extreme Sleep Deficit (3.9h Sleep)',
      record: {
        Age: 18,
        Gender: 'Female',
        School_Grade: '12th',
        Daily_Usage_Hours: 3.1,
        Sleep_Hours: 3.9,
        Academic_Performance: 78,
        Social_Interactions: 8,
        Exercise_Hours: 1.6,
        Anxiety_Level: 9,
        Depression_Level: 10,
        Self_Esteem: 3,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 1.4,
        Phone_Checks_Per_Day: 128,
        Apps_Used_Daily: 7,
        Time_on_Social_Media: 3.1,
        Time_on_Gaming: 1.6,
        Time_on_Education: 0.8,
        Family_Communication: 8,
        Weekend_Usage_Hours: 3.0,
      },
    },
    {
      id: '5',
      name: 'Elena Vance (10th Grade)',
      tag: 'Healthy Balance & Parental Limits',
      record: {
        Age: 15,
        Gender: 'Female',
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
    },
  ];

  const results = sampleProfiles.map((p) => ({
    ...p,
    prediction: scoreSingleRecord(p.record, selectedModel, 2),
  }));

  return (
    <div id="batch-scorer-view" className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Multi-Profile Batch Scorer & Cohort Comparisons
            </h2>
            <p className="text-xs text-slate-400">
              Evaluate and compare real cohort records side-by-side using the active {selectedModel.toUpperCase()} model.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Teen Profile</th>
                <th className="p-3.5">Daily / Sleep</th>
                <th className="p-3.5">Checks / Bedtime</th>
                <th className="p-3.5">Predicted Risk</th>
                <th className="p-3.5">Cohort Percentile</th>
                <th className="p-3.5">Flagged Rules</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {results.map((item) => {
                const { prediction, record } = item;
                const bandColor =
                  prediction.band === 'Severe'
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    : prediction.band === 'Addicted'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : prediction.band === 'Moderate'
                    ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.tag}</div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div>{record.Daily_Usage_Hours}h phone</div>
                      <div className="text-slate-400 text-[10px]">{record.Sleep_Hours}h sleep</div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div>{record.Phone_Checks_Per_Day} checks</div>
                      <div className="text-slate-400 text-[10px]">{record.Screen_Time_Before_Bed}h bedtime</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">
                          {prediction.score.toFixed(2)}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bandColor}`}>
                          {prediction.band}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      <strong>{prediction.percentile}%</strong>
                    </td>
                    <td className="p-3.5 font-mono text-amber-400 font-bold">
                      {prediction.n_flagged} / 14
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onLoadRecord(record)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-semibold transition-all"
                      >
                        Inspect Form
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
