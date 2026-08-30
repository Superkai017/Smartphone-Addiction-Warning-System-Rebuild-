import React from 'react';
import { ModelType } from '../types';
import { getAvailableModels } from '../../server/engine';
import { Cpu, CheckCircle, Zap } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: ModelType;
  onSelectModel: (m: ModelType) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
}) => {
  const models = getAvailableModels();

  return (
    <div id="models-view" className="space-y-6">
      {/* Overview header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">
              Machine Learning Model Architecture & Performance Benchmarks
            </h2>
            <p className="text-xs text-slate-400">
              Compare test set MSE, cross-validated R² scores, and specialized inference characteristics.
            </p>
          </div>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => {
          const isSelected = selectedModel === model.id;
          return (
            <div
              key={model.id}
              onClick={() => onSelectModel(model.id)}
              className={`cursor-pointer rounded-2xl p-5 border transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 uppercase">
                      {model.id}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">{model.name}</h3>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  {model.description}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Test Set MSE</span>
                    <span className="text-sm font-bold text-white font-mono">{model.testMse.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">Test R² Score</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {(model.testR2 * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-300">
                <strong className="text-slate-200">Recommended Use:</strong> {model.bestUse}
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Calibration Notes */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 text-xs text-slate-300 space-y-3">
        <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Model Training & Pipeline Safeguards
        </h4>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          All models are trained strictly on the train partition after the 24-feature preprocessing step to prevent data leakage. Feature selection uses <code className="font-mono text-slate-200">SelectKBest(k=18)</code> followed by <code className="font-mono text-slate-200">StandardScaler</code>. The gradient boosted models capture non-linear interactions between sleep deprivation and bedtime phone use.
        </p>
      </div>
    </div>
  );
};
