import React from 'react';
import { PredictionResult, ModelType } from '../types';
import { AlertTriangle, CheckCircle, ShieldAlert, Zap, TrendingUp, Info, Moon, Clock, HeartHandshake } from 'lucide-react';

interface RiskResultCardProps {
  result: PredictionResult | null;
  loading: boolean;
  selectedModel: ModelType;
  onSelectModel: (m: ModelType) => void;
}

export const RiskResultCard: React.FC<RiskResultCardProps> = ({
  result,
  loading,
  selectedModel,
  onSelectModel,
}) => {
  if (loading || !result) {
    return (
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-slate-400">Evaluating behavioral regression tensors...</p>
      </div>
    );
  }

  const { score, band, band_description, percentile, n_flagged, recommendations, engineered_features } = result;

  // Band styles
  const bandConfig: Record<string, { bg: string; text: string; border: string; icon: any; badgeBg: string }> = {
    Normal: {
      bg: 'from-emerald-950/40 via-slate-900 to-slate-900',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      icon: CheckCircle,
    },
    Moderate: {
      bg: 'from-blue-950/40 via-slate-900 to-slate-900',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      badgeBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      icon: TrendingUp,
    },
    Addicted: {
      bg: 'from-amber-950/40 via-slate-900 to-slate-900',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      icon: AlertTriangle,
    },
    Severe: {
      bg: 'from-rose-950/50 via-slate-900 to-slate-900',
      text: 'text-rose-400',
      border: 'border-rose-500/40',
      badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
      icon: ShieldAlert,
    },
  };

  const currentBand = bandConfig[band] || bandConfig.Normal;
  const BandIcon = currentBand.icon;

  return (
    <div id="risk-result-card" className={`bg-gradient-to-b ${currentBand.bg} rounded-2xl border ${currentBand.border} p-6 shadow-2xl space-y-6 transition-all duration-300`}>
      {/* Top Banner: Score & Band */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Smartphone Addiction Index
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentBand.badgeBg}`}>
              <BandIcon className="w-3.5 h-3.5" />
              <span>{band} Risk</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-md">
            {band_description}
          </p>
        </div>

        {/* Continuous Score Gauge */}
        <div className="flex items-baseline gap-2 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-white">
              {score.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">out of 10.00</span>
          </div>
        </div>
      </div>

      {/* Cohort Percentile Bar */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Cohort Standing: <strong className="text-white">{percentile}th Percentile</strong>
          </span>
          <span className="text-[11px] text-slate-400">3,000 Teen Cohort</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              score >= 9.0 ? 'bg-rose-500' : score >= 8.0 ? 'bg-amber-500' : score >= 6.7 ? 'bg-blue-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, percentile))}%` }}
          />
          {/* Quartile markers */}
          <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-slate-900/60" title="25th percentile (Normal/Moderate)" />
          <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-slate-900/60" title="50th percentile (Median)" />
          <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-slate-900/60" title="75th percentile (Severe)" />
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 font-mono">
          <span>0% (Low)</span>
          <span>25% (6.7)</span>
          <span>50% (8.0)</span>
          <span>75% (9.0+)</span>
          <span>100% (Ceiling)</span>
        </div>
      </div>

      {/* High-Impact Behavioral Ratios Grid */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          <span>Key Behavioral Markers</span>
          <span className="text-[11px] text-slate-400 lowercase">{n_flagged} of 14 rules triggered</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Moon className="w-3.5 h-3.5 text-sky-400" />
              <span>Sleep Deficit</span>
            </div>
            <div className="text-base font-bold text-white">
              {engineered_features.Sleep_Deficit?.toFixed(1) || '0.0'} hrs
            </div>
            <span className="text-[10px] text-slate-400">below 9h requirement</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span>Bedtime Share</span>
            </div>
            <div className="text-base font-bold text-white">
              {((engineered_features.Bedtime_Screen_Share || 0) * 100).toFixed(0)}%
            </div>
            <span className="text-[10px] text-slate-400">of daily screen time</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Screen / Sleep</span>
            </div>
            <div className="text-base font-bold text-white">
              {engineered_features.Screen_To_Sleep_Ratio?.toFixed(2) || '0.00'}x
            </div>
            <span className="text-[10px] text-slate-400">phone vs sleep ratio</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
              <span>Check Interval</span>
            </div>
            <div className="text-base font-bold text-white">
              {engineered_features.Minutes_Per_Check?.toFixed(1) || '0.0'} min
            </div>
            <span className="text-[10px] text-slate-400">average between unlocks</span>
          </div>
        </div>
      </div>

      {/* Actionable Advice & Calibrated Warnings */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            Ranked Actionable Interventions ({recommendations.length})
          </span>
          <span className="text-[11px] text-slate-400">Calibrated against cohort</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-200">No high-risk behavioral rules flagged!</p>
              <p className="text-emerald-400/80 mt-0.5">Current digital habits, sleep balance, and phone intervals are within healthy cohort limits.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recommendations.map((rec, idx) => (
              <div
                key={rec.feature}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all text-xs"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">{rec.featureLabel}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                      {rec.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-amber-400 font-mono">
                      {rec.value} vs cut {rec.threshold}
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 pl-7 text-[12px] leading-relaxed">
                  {rec.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Model Selection Footer */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Active Estimator:</span>
          <strong className="text-slate-200 font-mono uppercase">{selectedModel}</strong>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
          {(['gb', 'xgb', 'rf', 'rid', 'lr'] as ModelType[]).map((m) => (
            <button
              key={m}
              onClick={() => onSelectModel(m)}
              className={`px-2 py-0.5 rounded font-mono font-semibold transition-all ${
                selectedModel === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
