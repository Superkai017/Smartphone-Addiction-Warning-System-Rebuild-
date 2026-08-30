import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { Database, Info, Layers, ShieldAlert, TrendingUp, Loader2 } from 'lucide-react';
import { getRules } from '../lib/api';
import { COHORT, RULE_CATEGORIES, RULE_DISPLAY } from '../lib/catalog';
import type { DisplayRule, RuleMeta } from '../types';

/**
 * The cohort and the calibrated rule set.
 *
 * Thresholds are fetched from `GET /api/rules`, which reads
 * `models/thresholds.json`. They are deliberately not stored in the frontend:
 * they move whenever a preprocessing formula changes and
 * `python main.py calibrate --save` is re-run, and a stale copy here would show
 * a cut the model is not actually applying. Only the labels, units and
 * categories - pure copy - come from `lib/catalog`.
 */
export const CohortBenchmarkView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [rules, setRules] = useState<RuleMeta[]>([]);
  const [bandCuts, setBandCuts] = useState<number[]>([6.7, 8.0, 9.0]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    getRules()
      .then((response) => {
        if (cancelled) return;
        setRules(response.rules);
        setBandCuts(response.band_cuts);
      })
      .catch(() => {
        if (!cancelled) setRules([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Join the served rules to their display copy. A rule with no entry in the
  // catalog still renders, under its raw feature name.
  const displayRules: DisplayRule[] = useMemo(
    () =>
      rules.map((rule) => ({
        ...rule,
        label: RULE_DISPLAY[rule.feature]?.label ?? rule.feature,
        unit: RULE_DISPLAY[rule.feature]?.unit ?? '',
        category: RULE_DISPLAY[rule.feature]?.category ?? 'Habit',
        description: RULE_DISPLAY[rule.feature]?.description ?? '',
      })),
    [rules],
  );

  const bandDistributionData = COHORT.bandDistribution.map((band) => ({
    name: band.name,
    count: band.count,
    pct: `${band.percentage}%`,
    scoreRange: band.range,
    color: band.color,
  }));

  const categories = ['All', ...RULE_CATEGORIES];

  const filteredRules =
    selectedCategory === 'All'
      ? displayRules
      : displayRules.filter((r) => r.category === selectedCategory);

  return (
    <div id="cohort-benchmarks-view" className="space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">
              3,000-teen cohort &amp; 14 calibrated behavioural rules
            </h2>
            <p className="text-xs text-slate-400">
              A synthetic Kaggle dataset with quantile-derived thresholds. The target is close to a deterministic function of usage and sleep, so treat these as calibrated screening rules, not clinical findings.
            </p>
          </div>
        </div>
      </div>

      {/* Dataset & Banding Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Band breakdown card */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-300 uppercase tracking-wider">Predicted severity bands</span>
              <span className="text-slate-400">N = {COHORT.totalCount.toLocaleString()}</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bandDistributionData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                  >
                    {bandDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs shadow-lg">
                          <div className="font-bold text-white">{data.name} Risk</div>
                          <div className="text-slate-400">{data.count} teens ({data.pct})</div>
                          <div className="text-slate-400">Score: {data.scoreRange}</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              {bandDistributionData.map((band) => (
                <div key={band.name} className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: band.color }} />
                    <span>{band.name}</span>
                    <span className="ml-auto text-slate-400 font-mono">{band.pct}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">Score {band.scoreRange}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ceiling Censoring Architectural Explanation */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>Statistical & Preprocessing Architecture</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Target Ceiling-Censoring (50.8% Saturation at 10.0)
                </h4>
                <p className="text-slate-400 text-[11px]">
                  {COHORT.ceilingCount.toLocaleString()} of {COHORT.totalCount.toLocaleString()} rows ({COHORT.ceilingPercentage}%) sit exactly at the 10.0 ceiling, which puts the median there too - so naive quartiles collapse to [8.0, 10.0, 10.0]. The band cuts (<strong>{bandCuts.join(', ')}</strong>) are calibrated on the uncensored rows instead. That fixes the lower bands but cannot move the top one off ~63%: the data really is that saturated, which is why every result carries a percentile beside its band.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Quantile-Calibrated Rules vs Hardcoded Guesses
                </h4>
                <p className="text-slate-400 text-[11px]">
                  All 14 thresholds shown below are served live from <code className="font-mono text-slate-200">models/thresholds.json</code>, derived from the training cohort&rsquo;s empirical 75th / 25th percentiles. The prototype they replaced guessed its numbers and was wrong in both directions &mdash; one rule could never fire at all, another fired on 90.6% of the cohort. Quantile-derived, each now fires on 23.5&ndash;25.6%.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>24 Engineered Predictors</span>
            <span>k=18 SelectKBest + StandardScaler</span>
            <span>R² ~ 0.90 Ensemble Fit</span>
          </div>
        </div>
      </div>

      {/* 14 Calibrated Rules Explorer */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>The 14 calibrated behavioural warning rules</span>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium ${
                  selectedCategory === cat
                    ? 'bg-emerald-500 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Rules Table / Cards */}
        {!loading && displayRules.length === 0 && (
          <p className="text-xs text-slate-400 py-6 text-center">
            Could not load the calibrated rules from the API.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRules.map((rule, idx) => (
            <div
              key={rule.feature}
              className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-3.5 text-xs hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200 text-[13px]">{rule.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {rule.threshold === null
                      ? 'uncalibrated'
                      : `${rule.direction === 'high' ? '>' : '<'} ${rule.threshold} ${rule.unit}`}
                  </span>
                </div>

                <p className="text-slate-400 text-[11px] mb-2 leading-relaxed">
                  {rule.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg">
                <strong className="text-emerald-400">Advice:</strong> {rule.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
