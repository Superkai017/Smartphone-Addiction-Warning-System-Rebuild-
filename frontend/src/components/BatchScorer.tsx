import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { predict } from '../lib/api';
import { bandClass } from '../lib/catalog';
import { BATCH_PROFILES } from '../lib/samples';
import type { ModelType, PredictionResult, RawRecord } from '../types';

interface BatchScorerProps {
  selectedModel: ModelType;
  onLoadRecord: (record: RawRecord) => void;
}

/**
 * Scores all five sample profiles in a single request.
 *
 * `/api/predict` takes a list, and `preprocess_new` engineers the whole batch as
 * one frame - so one call is both faster than five and produces exactly the
 * same numbers. Results are positional with the records sent, which is what
 * lets them be zipped back onto the profiles below.
 *
 * Persisted like any other assessment: these are real runs against the real
 * model, and they belong in the history.
 */
export const BatchScorer: React.FC<BatchScorerProps> = ({
  selectedModel,
  onLoadRecord,
}) => {
  const [results, setResults] = useState<PredictionResult[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    predict(
      BATCH_PROFILES.map((p) => p.record),
      selectedModel,
      2,
    )
      .then((response) => {
        if (cancelled) return;
        setResults(response.results);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setResults(null);
        setError(err.message || 'Could not score the batch.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel]);

  return (
    <div id="batch-scorer-view" className="space-y-6">
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Multi-profile batch scorer
            </h2>
            <p className="text-xs text-slate-400">
              Five cohort profiles, scored side by side in one request with the active{' '}
              <strong className="text-emerald-400">{selectedModel.toUpperCase()}</strong>{' '}
              model.
            </p>
          </div>
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Scoring&hellip;
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Teen profile</th>
                <th className="p-3.5">Daily / sleep</th>
                <th className="p-3.5">Checks / bedtime</th>
                <th className="p-3.5">Predicted risk</th>
                <th className="p-3.5">Cohort percentile</th>
                <th className="p-3.5">Flagged rules</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {BATCH_PROFILES.map((profile, index) => {
                const prediction = results?.[index];
                const { record } = profile;

                return (
                  <tr
                    key={profile.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">{profile.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {profile.tag}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div>{record.Daily_Usage_Hours}h phone</div>
                      <div className="text-slate-400 text-[10px]">
                        {record.Sleep_Hours}h sleep
                      </div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div>{record.Phone_Checks_Per_Day} checks</div>
                      <div className="text-slate-400 text-[10px]">
                        {record.Screen_Time_Before_Bed}h bedtime
                      </div>
                    </td>
                    <td className="p-3.5">
                      {prediction ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-sm">
                            {prediction.score.toFixed(2)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bandClass(prediction.band)}`}
                          >
                            {prediction.band}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {prediction ? (
                        <strong>{prediction.percentile}%</strong>
                      ) : (
                        <span className="text-slate-600">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-amber-400 font-bold">
                      {prediction ? (
                        `${prediction.n_flagged} / 14`
                      ) : (
                        <span className="text-slate-600 font-normal">&mdash;</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onLoadRecord(record)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-semibold transition-all"
                      >
                        Inspect form
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
