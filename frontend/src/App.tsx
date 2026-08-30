import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header, type TabKey } from './components/Header';
import { AssessmentForm } from './components/AssessmentForm';
import { RiskResultCard } from './components/RiskResultCard';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { CohortBenchmarkView } from './components/CohortBenchmarkView';
import { ModelSelector } from './components/ModelSelector';
import { BatchScorer } from './components/BatchScorer';
import { HistoryPanel } from './components/HistoryPanel';
import { ApiError, getHealth, getModels, predictOne } from './lib/api';
import { DEFAULT_RECORD, PRESETS, type PresetKey } from './lib/samples';
import type { ModelType, PredictionResult, RawRecord } from './types';

/**
 * How long the form sits still before the app scores it.
 *
 * Every keystroke used to run a prediction in the browser, which was free
 * because the prediction was fake. It is now a round trip to a model, so edits
 * are coalesced. 400ms is comfortably under the threshold where a form feels
 * unresponsive and comfortably over a fast typist's inter-key gap.
 */
const DEBOUNCE_MS = 400;

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('assessment');
  const [record, setRecord] = useState<RawRecord>(DEFAULT_RECORD);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gb');
  const [tipLimit, setTipLimit] = useState<number>(3);

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [apiHealthy, setApiHealthy] = useState<boolean>(true);
  const [availableModels, setAvailableModels] = useState<ModelType[]>(['gb']);

  /**
   * Bumped whenever a prediction is persisted, so the history tab refetches
   * instead of showing a list that is one assessment stale.
   */
  const [historyVersion, setHistoryVersion] = useState<number>(0);

  // Which request is current. A slow response for an older record must not
  // overwrite the result of a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getHealth(), getModels()])
      .then(([health, models]) => {
        if (cancelled) return;
        setApiHealthy(health.status === 'ok' && health.model_loaded);
        setAvailableModels(models.available);
        // Fall back to whatever the server can actually serve if the default
        // model has no artifact in this deployment.
        setSelectedModel((current) =>
          models.available.includes(current) ? current : models.default,
        );
      })
      .catch(() => {
        if (!cancelled) setApiHealthy(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Score the current record, debounced. Assessment results are persisted -
  // this is the tab whose runs the history tab is meant to list.
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { result: scored, historyId } = await predictOne(
          record,
          selectedModel,
          tipLimit,
        );
        if (id !== requestId.current) return; // superseded
        setResult(scored);
        setError(null);
        setApiHealthy(true);
        if (historyId !== null) setHistoryVersion((v) => v + 1);
      } catch (err) {
        if (id !== requestId.current) return;
        const message =
          err instanceof ApiError
            ? err.message
            : 'Cannot reach the scoring API. Is the FastAPI backend running on :8000?';
        setError(message);
        if (!(err instanceof ApiError)) setApiHealthy(false);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [record, selectedModel, tipLimit]);

  const handleApplyPreset = useCallback((preset: string) => {
    const next = PRESETS[preset as PresetKey];
    if (next) setRecord(next);
  }, []);

  /** Shared by the batch table and the history list: load inputs into the form. */
  const handleLoadRecord = useCallback((next: RawRecord) => {
    setRecord(next);
    setActiveTab('assessment');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModel={selectedModel}
        apiHealthy={apiHealthy}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!apiHealthy && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
          >
            <strong className="font-semibold">Scoring API unreachable.</strong>{' '}
            Start it from the repo root with{' '}
            <code className="font-mono text-amber-100">
              .venv/Scripts/python -m uvicorn App.Api:app --reload --port 8000
            </code>
            . Nothing is scored in the browser, so no results can be shown until it
            answers.
          </div>
        )}

        {activeTab === 'assessment' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-6">
              <AssessmentForm
                record={record}
                onChange={setRecord}
                onApplyPreset={handleApplyPreset}
                tipLimit={tipLimit}
                setTipLimit={setTipLimit}
              />
            </div>

            <div className="lg:col-span-5 lg:sticky lg:top-20">
              <RiskResultCard
                result={result}
                loading={loading}
                error={error}
                selectedModel={selectedModel}
                availableModels={availableModels}
                onSelectModel={setSelectedModel}
              />
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <WhatIfSimulator baseRecord={record} selectedModel={selectedModel} />
        )}

        {activeTab === 'benchmarks' && <CohortBenchmarkView />}

        {activeTab === 'models' && (
          <ModelSelector
            selectedModel={selectedModel}
            availableModels={availableModels}
            onSelectModel={setSelectedModel}
          />
        )}

        {activeTab === 'batch' && (
          <BatchScorer
            selectedModel={selectedModel}
            onLoadRecord={handleLoadRecord}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPanel version={historyVersion} onLoadRecord={handleLoadRecord} />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-400 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Smartphone Addiction Warning System &middot; scored by the committed{' '}
            <code className="font-mono text-slate-300">models/*.pkl</code> on a
            3,000-teen synthetic cohort
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            FastAPI &middot; SQLite &middot; React 19 &middot; Vite
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
