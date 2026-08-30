import React, { useEffect, useMemo, useState } from 'react';
import {
  Sliders,
  TrendingDown,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { predict } from '../lib/api';
import type { ModelType, PredictionResult, RawRecord } from '../types';

interface WhatIfSimulatorProps {
  baseRecord: RawRecord;
  selectedModel: ModelType;
}

/** Sliders fire continuously; coalesce them into one request per pause. */
const DEBOUNCE_MS = 350;

const DEFAULTS = {
  screenTimeReduction: 1.5,
  sleepIncrease: 1.5,
  bedtimeReduction: 0.8,
  reduceGaming: 1.0,
  increaseExercise: 1.0,
  parentalControl: true,
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Baseline vs projected, both scored by the real model.
 *
 * The two records go up in a single `/api/predict` call with `persist=false`.
 * One call because the comparison is only meaningful if both sides came from
 * the same model load; `persist=false` because dragging a slider is not a run
 * anyone wants listed in the history tab.
 */
export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  baseRecord,
  selectedModel,
}) => {
  const [screenTimeReduction, setScreenTimeReduction] = useState(
    DEFAULTS.screenTimeReduction,
  );
  const [sleepIncrease, setSleepIncrease] = useState(DEFAULTS.sleepIncrease);
  const [bedtimeReduction, setBedtimeReduction] = useState(DEFAULTS.bedtimeReduction);
  const [enableParentalControl, setEnableParentalControl] = useState(
    DEFAULTS.parentalControl,
  );
  const [reduceGaming, setReduceGaming] = useState(DEFAULTS.reduceGaming);
  const [increaseExercise, setIncreaseExercise] = useState(DEFAULTS.increaseExercise);

  const [baseResult, setBaseResult] = useState<PredictionResult | null>(null);
  const [simulatedResult, setSimulatedResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const simulatedRecord: RawRecord = useMemo(() => {
    // `Sleep_Hours`, `Phone_Checks_Per_Day` and `Apps_Used_Daily` are divisors
    // the pipeline does not zero-impute, so every floor below is >= a positive
    // minimum rather than 0 - a 0 would be a 422 from the API.
    const newDaily = Math.max(0.5, baseRecord.Daily_Usage_Hours - screenTimeReduction);
    const newSleep = Math.min(10.5, baseRecord.Sleep_Hours + sleepIncrease);
    const newBedtime = Math.max(0, baseRecord.Screen_Time_Before_Bed - bedtimeReduction);
    const newGaming = Math.max(0, baseRecord.Time_on_Gaming - reduceGaming);
    const newExercise = Math.min(4, baseRecord.Exercise_Hours + increaseExercise);
    const newWeekend = Math.max(
      0.5,
      baseRecord.Weekend_Usage_Hours - screenTimeReduction * 1.2,
    );
    const newChecks = Math.max(20, Math.round(baseRecord.Phone_Checks_Per_Day * 0.7));

    return {
      ...baseRecord,
      Daily_Usage_Hours: round1(newDaily),
      Sleep_Hours: Math.max(0.5, round1(newSleep)),
      Screen_Time_Before_Bed: round1(newBedtime),
      Time_on_Gaming: round1(newGaming),
      Exercise_Hours: round1(newExercise),
      Weekend_Usage_Hours: round1(newWeekend),
      Phone_Checks_Per_Day: newChecks,
      Parental_Control: enableParentalControl ? 1 : 0,
    };
  }, [
    baseRecord,
    screenTimeReduction,
    sleepIncrease,
    bedtimeReduction,
    enableParentalControl,
    reduceGaming,
    increaseExercise,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        // tips=14 so `n_flagged` reflects every rule, which is what the
        // "risk factors cleared" figure below counts.
        const response = await predict(
          [baseRecord, simulatedRecord],
          selectedModel,
          14,
          false,
        );
        if (cancelled) return;
        setBaseResult(response.results[0]);
        setSimulatedResult(response.results[1]);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || 'Could not run the simulation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [baseRecord, simulatedRecord, selectedModel]);

  const scoreDiff =
    baseResult && simulatedResult ? simulatedResult.score - baseResult.score : 0;
  const percentileDiff =
    baseResult && simulatedResult
      ? simulatedResult.percentile - baseResult.percentile
      : 0;
  const rulesResolved =
    baseResult && simulatedResult
      ? Math.max(0, baseResult.n_flagged - simulatedResult.n_flagged)
      : 0;

  const resetInterventions = () => {
    setScreenTimeReduction(DEFAULTS.screenTimeReduction);
    setSleepIncrease(DEFAULTS.sleepIncrease);
    setBedtimeReduction(DEFAULTS.bedtimeReduction);
    setEnableParentalControl(DEFAULTS.parentalControl);
    setReduceGaming(DEFAULTS.reduceGaming);
    setIncreaseExercise(DEFAULTS.increaseExercise);
  };

  const dash = <span className="text-slate-600">&mdash;</span>;

  return (
    <div id="what-if-simulator-view" className="space-y-6">
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Intervention what-if simulator
              </h2>
              <p className="text-xs text-slate-400">
                Adjust habits and re-score against the same model. Simulated runs are
                not saved to history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Re-scoring
              </span>
            )}
            <button
              type="button"
              onClick={resetInterventions}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset sliders</span>
            </button>
          </div>
        </div>
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

      {/* Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Baseline */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">
              Current baseline
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
              {baseResult?.band ?? '…'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-3xl font-extrabold text-white font-display">
                {baseResult ? baseResult.score.toFixed(2) : dash}
              </div>
              <span className="text-xs text-slate-400">
                {baseResult ? `${baseResult.percentile}th cohort percentile` : ' '}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Daily screen time:</span>
                <strong className="text-white">{baseRecord.Daily_Usage_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Nightly sleep:</span>
                <strong className="text-white">{baseRecord.Sleep_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Bedtime phone use:</span>
                <strong className="text-white">
                  {baseRecord.Screen_Time_Before_Bed} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Flagged risk rules:</span>
                <strong className="text-rose-400">
                  {baseResult ? `${baseResult.n_flagged} of 14` : dash}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Projected */}
        <div className="bg-slate-900/80 rounded-2xl border border-emerald-500/30 p-5 bg-gradient-to-b from-emerald-950/20 to-slate-900">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Projected
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
              {simulatedResult?.band ?? '…'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-3xl font-extrabold text-emerald-400 font-display">
                {simulatedResult ? simulatedResult.score.toFixed(2) : dash}
              </div>
              <span className="text-xs text-slate-400">
                {simulatedResult
                  ? `${simulatedResult.percentile}th cohort percentile`
                  : ' '}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Simulated screen time:</span>
                <strong className="text-emerald-400">
                  {simulatedRecord.Daily_Usage_Hours} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Simulated sleep:</span>
                <strong className="text-emerald-400">
                  {simulatedRecord.Sleep_Hours} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Simulated bedtime:</span>
                <strong className="text-emerald-400">
                  {simulatedRecord.Screen_Time_Before_Bed} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Remaining risk rules:</span>
                <strong className="text-emerald-400">
                  {simulatedResult ? `${simulatedResult.n_flagged} of 14` : dash}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Delta */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span>Net impact</span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">
                  Addiction score change
                </span>
                <div
                  className={`text-2xl font-bold ${scoreDiff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {baseResult && simulatedResult
                    ? `${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(2)} pts`
                    : dash}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">
                  Cohort percentile shift
                </span>
                <div
                  className={`text-2xl font-bold ${percentileDiff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {baseResult && simulatedResult
                    ? `${percentileDiff > 0 ? '+' : ''}${percentileDiff.toFixed(1)}%`
                    : dash}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>{rulesResolved} risk factors</strong> cleared by this plan
            </span>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Targeted habit modifications
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label htmlFor="sim-screen" className="font-medium text-slate-300">
                Cut daily phone time
              </label>
              <span className="font-bold text-emerald-400">-{screenTimeReduction} hrs</span>
            </div>
            <input
              id="sim-screen"
              type="range"
              min="0"
              max="5"
              step="0.25"
              value={screenTimeReduction}
              onChange={(e) => setScreenTimeReduction(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Replaces screen time with study or hobbies.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label htmlFor="sim-sleep" className="font-medium text-slate-300">
                Increase sleep duration
              </label>
              <span className="font-bold text-sky-400">+{sleepIncrease} hrs</span>
            </div>
            <input
              id="sim-sleep"
              type="range"
              min="0"
              max="4"
              step="0.25"
              value={sleepIncrease}
              onChange={(e) => setSleepIncrease(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Restores the teen circadian rhythm.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label htmlFor="sim-bedtime" className="font-medium text-slate-300">
                Eliminate bedtime screen
              </label>
              <span className="font-bold text-rose-400">-{bedtimeReduction} hrs</span>
            </div>
            <input
              id="sim-bedtime"
              type="range"
              min="0"
              max={Math.min(3, baseRecord.Screen_Time_Before_Bed || 1.5)}
              step="0.1"
              value={bedtimeReduction}
              onChange={(e) => setBedtimeReduction(parseFloat(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Stops late-night blue light and scrolling.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label htmlFor="sim-gaming" className="font-medium text-slate-300">
                Reduce mobile gaming
              </label>
              <span className="font-bold text-purple-400">-{reduceGaming} hrs</span>
            </div>
            <input
              id="sim-gaming"
              type="range"
              min="0"
              max={Math.min(4, baseRecord.Time_on_Gaming || 2)}
              step="0.25"
              value={reduceGaming}
              onChange={(e) => setReduceGaming(parseFloat(e.target.value))}
              className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Limits compulsive gaming sessions.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <label htmlFor="sim-exercise" className="font-medium text-slate-300">
                Add daily exercise
              </label>
              <span className="font-bold text-amber-400">+{increaseExercise} hrs</span>
            </div>
            <input
              id="sim-exercise"
              type="range"
              min="0"
              max="3"
              step="0.25"
              value={increaseExercise}
              onChange={(e) => setIncreaseExercise(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Offline activity buffer against screen time.
            </p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-300 text-xs block">
                Enable parental control
              </span>
              <span className="text-[10px] text-slate-400">
                Drives the unsupervised-usage rule
              </span>
            </div>
            <button
              type="button"
              aria-pressed={enableParentalControl}
              onClick={() => setEnableParentalControl(!enableParentalControl)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                enableParentalControl
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <ShieldCheck className="w-4 h-4 inline mr-1" />
              {enableParentalControl ? 'Active' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
