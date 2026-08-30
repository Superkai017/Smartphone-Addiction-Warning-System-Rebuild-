import React, { useState } from 'react';
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { RULES } from '../../server/engine';
import { Database, Info, Layers, ShieldAlert, TrendingUp } from 'lucide-react';

export const CohortBenchmarkView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const bandDistributionData = [
    { name: 'Normal', count: 375, pct: '12.5%', scoreRange: '1.0 - 6.6', color: '#10b981' },
    { name: 'Moderate', count: 375, pct: '12.5%', scoreRange: '6.7 - 7.9', color: '#3b82f6' },
    { name: 'Addicted', count: 363, pct: '12.1%', scoreRange: '8.0 - 8.9', color: '#f59e0b' },
    { name: 'Severe', count: 1887, pct: '62.9%', scoreRange: '9.0 - 10.0', color: '#ef4444' },
  ];

  const categories = ['All', 'Time', 'Sleep', 'Habit', 'Social', 'Mental Health'];

  const filteredRules = selectedCategory === 'All'
    ? RULES
    : RULES.filter((r) => r.category === selectedCategory);

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
              3,000 Teen Cohort Dataset & 14 Calibrated Behavioral Rules
            </h2>
            <p className="text-xs text-slate-400">
              Grounded in the Kaggle teen smartphone addiction dataset, featuring empirical quantile-derived threshold calibration.
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
              <span className="font-semibold text-slate-300 uppercase tracking-wider">Cohort Severity Bands</span>
              <span className="text-slate-400">N = 3,000 Teens</span>
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
                  In the 3,000-teen dataset, 1,524 rows (50.8%) sit exactly at the 10.0 score ceiling. Rather than naive quartiles (which would collapse due to the ceiling median), the severity band cut points (<strong>6.7, 8.0, 9.0</strong>) are calibrated from the uncensored cohort distribution, while the percentile curve carries high-resolution discriminative power.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-sky-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Quantile-Calibrated Rules vs Hardcoded Guesses
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Every one of the 14 behavioral thresholds in <code className="font-mono text-slate-200">thresholds.json</code> is derived strictly from the training cohort’s empirical 75th / 25th percentiles. This guarantees that each rule fires appropriately on exactly ~24–26% of at-risk teens rather than arbitrary false triggers.
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
            <span>The 14 Calibrated Behavioral Warning Rules</span>
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
                    {rule.direction === 'high' ? `> ${rule.threshold}` : `< ${rule.threshold}`} {rule.unit}
                  </span>
                </div>

                <p className="text-slate-400 text-[11px] mb-2 leading-relaxed">
                  {rule.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-300 bg-slate-900/50 p-2 rounded-lg">
                <strong className="text-emerald-400">Intervention Advice:</strong> {rule.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
