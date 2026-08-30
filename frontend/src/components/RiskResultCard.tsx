import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Zap,
  TrendingUp,
  Info,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { RULE_DISPLAY } from '../lib/catalog';
import type { ModelType, PredictionResult, SeverityBand } from '../types';

interface RiskResultCardProps {
  result: PredictionResult | null;
  loading: boolean;
  error: string | null;
  selectedModel: ModelType;
  availableModels: ModelType[];
  onSelectModel: (m: ModelType) => void;
}

const BAND_STYLE: Record<
  SeverityBand,
  { bg: string; border: string; badge: string; icon: LucideIcon }
> = {
  Normal: {
    bg: 'from-emerald-950/40 via-slate-900 to-slate-900',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle,
  },
  Moderate: {
    bg: 'from-blue-950/40 via-slate-900 to-slate-900',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    icon: TrendingUp,
  },
  Addicted: {
    bg: 'from-amber-950/40 via-slate-900 to-slate-900',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: AlertTriangle,
  },
  Severe: {
    bg: 'from-rose-950/50 via-slate-900 to-slate-900',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    icon: ShieldAlert,
  },
};

/** Compact number formatting for a rule's value and its calibrated cut. */
const fmt = (n: number): string =>
  Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);

export const RiskResultCard: React.FC<RiskResultCardProps> = ({
  result,
  loading,
  error,
  selectedModel,
  availableModels,
  onSelectModel,
}) => {
  if (error && !result) {
    return (
      <div
        role="alert"
        className="bg-slate-900/90 rounded-2xl border border-rose-500/30 p-6 flex flex-col items-center justify-center min-h-[420px] text-center gap-3"
      >
        <AlertCircle className="w-8 h-8 text-rose-400" />
        <p className="text-sm font-semibold text-rose-200">Could not score this record</p>
        <p className="text-xs text-slate-400 max-w-sm">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-3" />
        <p className="text-sm text-slate-400">Scoring against the trained ensemble&hellip;</p>
      </div>
    );
  }

  const { score, band, band_description, percentile, n_flagged, recommendations } =
    result;
  const style = BAND_STYLE[band] ?? BAND_STYLE.Normal;
  const BandIcon = style.icon;

  return (
    <div
      id="risk-result-card"
      className={`bg-gradient-to-b ${style.bg} rounded-2xl border ${style.border} p-6 shadow-2xl space-y-6 transition-all duration-300 ${
        loading ? 'opacity-60' : ''
      }`}
      aria-busy={loading}
    >
      {/* Score & band */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              Smartphone Addiction Index
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${style.badge}`}
            >
              <BandIcon className="w-3.5 h-3.5" />
              <span>{band} Risk</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-md">{band_description}</p>
        </div>

        <div className="flex items-baseline gap-2 bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800">
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-white">
              {score.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">out of 10.00</span>
          </div>
        </div>
      </div>

      {/* Cohort percentile */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            Cohort standing:{' '}
            <strong className="text-white">{percentile}th percentile</strong>
          </span>
          <span className="text-[11px] text-slate-400">3,000-teen cohort</span>
        </div>

        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              band === 'Severe'
                ? 'bg-rose-500'
                : band === 'Addicted'
                  ? 'bg-amber-500'
                  : band === 'Moderate'
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, percentile))}%` }}
          />
          <div className="absolute inset-y-0 left-1/4 w-0.5 bg-slate-900/60" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-slate-900/60" />
          <div className="absolute inset-y-0 left-3/4 w-0.5 bg-slate-900/60" />
        </div>

        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
          Read this alongside the band, not instead of it. The target is
          ceiling-censored &mdash; half the cohort sits exactly at 10.0 &mdash; so
          roughly 63% of predictions land in the top band, and a &ldquo;Severe&rdquo;
          can sit anywhere from the 37th percentile upward.
        </p>
      </div>

      {/* Ranked interventions */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            Ranked interventions ({recommendations.length})
          </span>
          <span className="text-[11px] text-slate-400 normal-case">
            {n_flagged} of 14 rules triggered
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-200">
                No behavioural rules flagged
              </p>
              <p className="text-emerald-400/80 mt-0.5">
                Every calibrated marker sits inside the cohort&rsquo;s healthy range.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recommendations.map((rec, idx) => {
              const display = RULE_DISPLAY[rec.feature];
              return (
                <div
                  key={rec.feature}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all text-xs"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-200">
                        {display?.label ?? rec.feature}
                      </span>
                      {display && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          {display.category}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-amber-400 font-mono">
                        {fmt(rec.value)} {rec.direction === 'high' ? '>' : '<'}{' '}
                        {fmt(rec.threshold)}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {display?.unit ?? ''} &middot; {rec.percentile}th pct
                      </div>
                    </div>
                  </div>

                  <p className="text-slate-300 pl-7 text-[12px] leading-relaxed">
                    {rec.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model switch */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Info className="w-3.5 h-3.5" />
          <span>Active estimator:</span>
          <strong className="text-slate-200 font-mono uppercase">{selectedModel}</strong>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
          {(['gb', 'xgb', 'rf'] as ModelType[]).map((m) => {
            const servable = availableModels.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSelectModel(m)}
                disabled={!servable}
                title={
                  servable
                    ? `Score with ${m.toUpperCase()}`
                    : `${m.toUpperCase()} has no artifact on this deployment`
                }
                className={`px-2 py-0.5 rounded font-mono font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  selectedModel === m
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
