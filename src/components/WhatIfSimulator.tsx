import React, { useState, useMemo } from 'react';
import { RawRecord, ModelType, PredictionResult } from '../types';
import { scoreSingleRecord } from '../../server/engine';
import { Sliders, TrendingDown, CheckCircle2, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

interface WhatIfSimulatorProps {
  baseRecord: RawRecord;
  selectedModel: ModelType;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({
  baseRecord,
  selectedModel,
}) => {
  // Intervention adjustments state (delta or absolute overrides)
  const [screenTimeReduction, setScreenTimeReduction] = useState<number>(1.5);
  const [sleepIncrease, setSleepIncrease] = useState<number>(1.5);
  const [bedtimeReduction, setBedtimeReduction] = useState<number>(0.8);
  const [enableParentalControl, setEnableParentalControl] = useState<boolean>(true);
  const [reduceGaming, setReduceGaming] = useState<number>(1.0);
  const [increaseExercise, setIncreaseExercise] = useState<number>(1.0);

  // Compute base result
  const baseResult: PredictionResult = useMemo(() => {
    return scoreSingleRecord(baseRecord, selectedModel, 14);
  }, [baseRecord, selectedModel]);

  // Compute simulated record
  const simulatedRecord: RawRecord = useMemo(() => {
    const newDaily = Math.max(0.5, baseRecord.Daily_Usage_Hours - screenTimeReduction);
    const newSleep = Math.min(10.5, baseRecord.Sleep_Hours + sleepIncrease);
    const newBedtime = Math.max(0, baseRecord.Screen_Time_Before_Bed - bedtimeReduction);
    const newGaming = Math.max(0, baseRecord.Time_on_Gaming - reduceGaming);
    const newExercise = Math.min(4, baseRecord.Exercise_Hours + increaseExercise);
    const newWeekend = Math.max(0.5, baseRecord.Weekend_Usage_Hours - screenTimeReduction * 1.2);
    const newChecks = Math.max(20, Math.round(baseRecord.Phone_Checks_Per_Day * 0.7));

    return {
      ...baseRecord,
      Daily_Usage_Hours: Math.round(newDaily * 10) / 10,
      Sleep_Hours: Math.round(newSleep * 10) / 10,
      Screen_Time_Before_Bed: Math.round(newBedtime * 10) / 10,
      Time_on_Gaming: Math.round(newGaming * 10) / 10,
      Exercise_Hours: Math.round(newExercise * 10) / 10,
      Weekend_Usage_Hours: Math.round(newWeekend * 10) / 10,
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

  // Compute simulated result
  const simulatedResult: PredictionResult = useMemo(() => {
    return scoreSingleRecord(simulatedRecord, selectedModel, 14);
  }, [simulatedRecord, selectedModel]);

  const scoreDiff = simulatedResult.score - baseResult.score;
  const percentileDiff = simulatedResult.percentile - baseResult.percentile;
  const rulesResolved = Math.max(0, baseResult.n_flagged - simulatedResult.n_flagged);

  const resetInterventions = () => {
    setScreenTimeReduction(1.5);
    setSleepIncrease(1.5);
    setBedtimeReduction(0.8);
    setEnableParentalControl(true);
    setReduceGaming(1.0);
    setIncreaseExercise(1.0);
  };

  return (
    <div id="what-if-simulator-view" className="space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Intervention & Habit What-If Simulator
              </h2>
              <p className="text-xs text-slate-400">
                Simulate targeted digital hygiene adjustments and measure the projected drop in addiction risk.
              </p>
            </div>
          </div>

          <button
            onClick={resetInterventions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Sliders</span>
          </button>
        </div>
      </div>

      {/* Comparison Scoreboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Baseline State */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Current Baseline</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[11px]">
              {baseResult.band}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-3xl font-extrabold text-white font-display">
                {baseResult.score.toFixed(2)}
              </div>
              <span className="text-xs text-slate-400">{baseResult.percentile}th Cohort Percentile</span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Daily Screen Time:</span>
                <strong className="text-white">{baseRecord.Daily_Usage_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Nightly Sleep:</span>
                <strong className="text-white">{baseRecord.Sleep_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Bedtime Phone Use:</span>
                <strong className="text-white">{baseRecord.Screen_Time_Before_Bed} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Flagged Risk Rules:</span>
                <strong className="text-rose-400">{baseResult.n_flagged} of 14</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Projected State */}
        <div className="bg-slate-900/80 rounded-2xl border border-emerald-500/30 p-5 bg-gradient-to-b from-emerald-950/20 to-slate-900">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Projected Post-Intervention
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
              {simulatedResult.band}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-3xl font-extrabold text-emerald-400 font-display">
                {simulatedResult.score.toFixed(2)}
              </div>
              <span className="text-xs text-slate-400">{simulatedResult.percentile}th Cohort Percentile</span>
            </div>

            <div className="pt-3 border-t border-slate-800/80 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Simulated Screen Time:</span>
                <strong className="text-emerald-400">{simulatedRecord.Daily_Usage_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Simulated Sleep:</span>
                <strong className="text-emerald-400">{simulatedRecord.Sleep_Hours} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Simulated Bedtime:</span>
                <strong className="text-emerald-400">{simulatedRecord.Screen_Time_Before_Bed} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span>Remaining Risk Rules:</span>
                <strong className="text-emerald-400">{simulatedResult.n_flagged} of 14</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Delta Impact Summary */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span>Net Impact Delta</span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Addiction Score Reduction</span>
                <div className="text-2xl font-bold text-emerald-400">
                  {scoreDiff <= 0 ? scoreDiff.toFixed(2) : `+${scoreDiff.toFixed(2)}`} pts
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Cohort Percentile Shift</span>
                <div className="text-2xl font-bold text-emerald-400">
                  {percentileDiff <= 0 ? `${percentileDiff.toFixed(1)}%` : `+${percentileDiff.toFixed(1)}%`}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>{rulesResolved} risk factors</strong> cleared by this intervention plan!
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Simulation Sliders */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Targeted Habit Modification Sliders
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-medium text-slate-300">Cut Daily Phone Time</span>
              <span className="font-bold text-emerald-400">-{screenTimeReduction} hrs</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.25"
              value={screenTimeReduction}
              onChange={(e) => setScreenTimeReduction(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">Replaces screen time with study or hobbies.</p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-medium text-slate-300">Increase Sleep Duration</span>
              <span className="font-bold text-sky-400">+{sleepIncrease} hrs</span>
            </div>
            <input
              type="range"
              min="0"
              max="4"
              step="0.25"
              value={sleepIncrease}
              onChange={(e) => setSleepIncrease(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">Restores natural teen circadian rhythm.</p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-medium text-slate-300">Eliminate Bedtime Screen</span>
              <span className="font-bold text-rose-400">-{bedtimeReduction} hrs</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.min(3, baseRecord.Screen_Time_Before_Bed || 1.5)}
              step="0.1"
              value={bedtimeReduction}
              onChange={(e) => setBedtimeReduction(parseFloat(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">Stops late-night dopamine & blue light.</p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-medium text-slate-300">Reduce Mobile Gaming</span>
              <span className="font-bold text-purple-400">-{reduceGaming} hrs</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.min(4, baseRecord.Time_on_Gaming || 2)}
              step="0.25"
              value={reduceGaming}
              onChange={(e) => setReduceGaming(parseFloat(e.target.value))}
              className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">Limits compulsive gaming sessions.</p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5 text-xs">
              <span className="font-medium text-slate-300">Add Daily Exercise</span>
              <span className="font-bold text-amber-400">+{increaseExercise} hrs</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.25"
              value={increaseExercise}
              onChange={(e) => setIncreaseExercise(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <p className="text-[10px] text-slate-400 mt-1">Physical activity offline buffer.</p>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-300 text-xs block">Enable Parental Control</span>
              <span className="text-[10px] text-slate-400">Provides automated device curfew</span>
            </div>
            <button
              type="button"
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
