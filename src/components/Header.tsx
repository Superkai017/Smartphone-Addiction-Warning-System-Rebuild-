import React from 'react';
import { Smartphone, Activity, Sparkles, Sliders, Database, Cpu } from 'lucide-react';
import { ModelType } from '../types';

interface HeaderProps {
  activeTab: 'assessment' | 'simulator' | 'benchmarks' | 'models' | 'batch';
  setActiveTab: (tab: 'assessment' | 'simulator' | 'benchmarks' | 'models' | 'batch') => void;
  activeModel: ModelType;
  apiHealthy: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeModel,
  apiHealthy,
}) => {
  return (
    <header id="main-header" className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3.5 gap-4">
          {/* Brand Info */}
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
                  Real-time behavioral risk scoring & habit intervention engine
                </p>
              </div>
            </div>

            {/* Health status badge for mobile */}
            <div className="flex sm:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${apiHealthy ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
              <span className="text-slate-300 font-mono text-[10px] uppercase">{activeModel}</span>
            </div>
          </div>

          {/* Navigation Controls & Status */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-medium w-full sm:w-auto">
              <button
                id="nav-tab-assessment"
                onClick={() => setActiveTab('assessment')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'assessment'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Risk Assessment</span>
              </button>

              <button
                id="nav-tab-simulator"
                onClick={() => setActiveTab('simulator')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'simulator'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>What-If Simulator</span>
              </button>

              <button
                id="nav-tab-benchmarks"
                onClick={() => setActiveTab('benchmarks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'benchmarks'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Cohort Rules</span>
              </button>

              <button
                id="nav-tab-models"
                onClick={() => setActiveTab('models')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'models'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>ML Models</span>
              </button>

              <button
                id="nav-tab-batch"
                onClick={() => setActiveTab('batch')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'batch'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Batch Scorer</span>
              </button>
            </div>

            {/* Desktop Status Badge */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className={`w-2 h-2 rounded-full ${apiHealthy ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-slate-300 font-mono text-[11px]">Serving: <strong className="text-emerald-400 uppercase">{activeModel}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
