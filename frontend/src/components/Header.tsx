import React from 'react';
import {
  Smartphone,
  Activity,
  Sparkles,
  Sliders,
  Database,
  Cpu,
  History,
  type LucideIcon,
} from 'lucide-react';
import type { ModelType } from '../types';

export type TabKey =
  | 'assessment'
  | 'simulator'
  | 'benchmarks'
  | 'models'
  | 'batch'
  | 'history';

interface HeaderProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  activeModel: ModelType;
  apiHealthy: boolean;
}

/** One source for the nav, so adding a tab is one entry rather than a block of JSX. */
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'assessment', label: 'Risk Assessment', icon: Activity },
  { key: 'simulator', label: 'What-If Simulator', icon: Sliders },
  { key: 'benchmarks', label: 'Cohort Rules', icon: Database },
  { key: 'models', label: 'ML Models', icon: Cpu },
  { key: 'batch', label: 'Batch Scorer', icon: Sparkles },
  { key: 'history', label: 'History', icon: History },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeModel,
  apiHealthy,
}) => {
  const statusDot = apiHealthy ? 'bg-emerald-400' : 'bg-amber-400';

  return (
    <header
      id="main-header"
      className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3.5 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-white font-display">
                    Smartphone Addiction Warning System
                  </h1>
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ML Calibrated
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time behavioural risk scoring &amp; habit intervention engine
                </p>
              </div>
            </div>

            {/* Status badge, mobile */}
            <div className="flex sm:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${statusDot} animate-pulse`} />
              <span className="text-slate-300 font-mono text-[10px] uppercase">
                {activeModel}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <nav
              aria-label="Views"
              className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-medium w-full sm:w-auto"
            >
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  id={`nav-tab-${key}`}
                  type="button"
                  aria-current={activeTab === key ? 'page' : undefined}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === key
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {/* Status badge, desktop */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800"
                title={
                  apiHealthy
                    ? 'The scoring API is serving the committed model artifacts'
                    : 'The scoring API is unreachable or its artifacts failed to load'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full ${statusDot} shadow-sm animate-pulse`}
                />
                <span className="text-slate-300 font-mono text-[11px]">
                  {apiHealthy ? 'Serving: ' : 'Offline: '}
                  <strong className="text-emerald-400 uppercase">{activeModel}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
