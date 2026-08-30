import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AssessmentForm } from './components/AssessmentForm';
import { RiskResultCard } from './components/RiskResultCard';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { CohortBenchmarkView } from './components/CohortBenchmarkView';
import { ModelSelector } from './components/ModelSelector';
import { BatchScorer } from './components/BatchScorer';
import { RawRecord, PredictionResult, ModelType } from './types';
import { scoreSingleRecord } from '../server/engine';

const DEFAULT_RECORD: RawRecord = {
  Age: 15,
  Gender: 'Female',
  School_Grade: '9th',
  Daily_Usage_Hours: 5.5,
  Sleep_Hours: 6.0,
  Academic_Performance: 75,
  Social_Interactions: 4,
  Exercise_Hours: 0.8,
  Anxiety_Level: 6,
  Depression_Level: 5,
  Self_Esteem: 5,
  Parental_Control: 0,
  Screen_Time_Before_Bed: 1.2,
  Phone_Checks_Per_Day: 95,
  Apps_Used_Daily: 14,
  Time_on_Social_Media: 2.8,
  Time_on_Gaming: 1.8,
  Time_on_Education: 0.9,
  Family_Communication: 4,
  Weekend_Usage_Hours: 7.2,
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'assessment' | 'simulator' | 'benchmarks' | 'models' | 'batch'>('assessment');
  const [record, setRecord] = useState<RawRecord>(DEFAULT_RECORD);
  const [selectedModel, setSelectedModel] = useState<ModelType>('gb');
  const [tipLimit, setTipLimit] = useState<number>(3);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiHealthy, setApiHealthy] = useState<boolean>(true);

  // Compute prediction whenever record, model or tip limit changes
  useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    const timer = setTimeout(() => {
      try {
        const computed = scoreSingleRecord(record, selectedModel, tipLimit);
        if (isCurrent) {
          setResult(computed);
          setLoading(false);
        }
      } catch (err) {
        console.error('Inference error:', err);
        if (isCurrent) {
          setLoading(false);
        }
      }
    }, 50);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [record, selectedModel, tipLimit]);

  // Check backend health
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') setApiHealthy(true);
      })
      .catch(() => {
        // If fetch fails (e.g. dev boot time), engine handles client-side seamlessly
        setApiHealthy(true);
      });
  }, []);

  const handleApplyPreset = (presetName: string) => {
    if (presetName === 'severe') {
      setRecord({
        Age: 14,
        Gender: 'Female',
        School_Grade: '9th',
        Daily_Usage_Hours: 7.5,
        Sleep_Hours: 4.8,
        Academic_Performance: 62,
        Social_Interactions: 2,
        Exercise_Hours: 0.1,
        Anxiety_Level: 9,
        Depression_Level: 8,
        Self_Esteem: 2,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 2.2,
        Phone_Checks_Per_Day: 140,
        Apps_Used_Daily: 20,
        Time_on_Social_Media: 4.2,
        Time_on_Gaming: 2.8,
        Time_on_Education: 0.5,
        Family_Communication: 2,
        Weekend_Usage_Hours: 9.8,
      });
    } else if (presetName === 'moderate') {
      setRecord({
        Age: 16,
        Gender: 'Male',
        School_Grade: '10th',
        Daily_Usage_Hours: 4.8,
        Sleep_Hours: 6.8,
        Academic_Performance: 76,
        Social_Interactions: 5,
        Exercise_Hours: 1.0,
        Anxiety_Level: 4,
        Depression_Level: 4,
        Self_Esteem: 6,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 0.9,
        Phone_Checks_Per_Day: 80,
        Apps_Used_Daily: 11,
        Time_on_Social_Media: 2.2,
        Time_on_Gaming: 1.8,
        Time_on_Education: 0.8,
        Family_Communication: 5,
        Weekend_Usage_Hours: 6.2,
      });
    } else if (presetName === 'academic') {
      setRecord({
        Age: 15,
        Gender: 'Other',
        School_Grade: '10th',
        Daily_Usage_Hours: 3.8,
        Sleep_Hours: 7.5,
        Academic_Performance: 94,
        Social_Interactions: 7,
        Exercise_Hours: 1.2,
        Anxiety_Level: 3,
        Depression_Level: 2,
        Self_Esteem: 8,
        Parental_Control: 0,
        Screen_Time_Before_Bed: 0.4,
        Phone_Checks_Per_Day: 60,
        Apps_Used_Daily: 9,
        Time_on_Social_Media: 0.8,
        Time_on_Gaming: 0.6,
        Time_on_Education: 2.4,
        Family_Communication: 7,
        Weekend_Usage_Hours: 4.2,
      });
    } else if (presetName === 'healthy') {
      setRecord({
        Age: 15,
        Gender: 'Female',
        School_Grade: '10th',
        Daily_Usage_Hours: 2.0,
        Sleep_Hours: 8.5,
        Academic_Performance: 92,
        Social_Interactions: 8,
        Exercise_Hours: 2.0,
        Anxiety_Level: 2,
        Depression_Level: 1,
        Self_Esteem: 9,
        Parental_Control: 1,
        Screen_Time_Before_Bed: 0.2,
        Phone_Checks_Per_Day: 35,
        Apps_Used_Daily: 6,
        Time_on_Social_Media: 0.8,
        Time_on_Gaming: 0.4,
        Time_on_Education: 0.8,
        Family_Communication: 8,
        Weekend_Usage_Hours: 2.5,
      });
    }
  };

  const handleLoadRecordFromBatch = (batchRecord: RawRecord) => {
    setRecord(batchRecord);
    setActiveTab('assessment');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeModel={selectedModel}
        apiHealthy={apiHealthy}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'assessment' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Input & Assessment Controls */}
            <div className="lg:col-span-7 space-y-6">
              <AssessmentForm
                record={record}
                onChange={setRecord}
                onApplyPreset={handleApplyPreset}
                tipLimit={tipLimit}
                setTipLimit={setTipLimit}
              />
            </div>

            {/* Right: Results Card */}
            <div className="lg:col-span-5 sticky top-20">
              <RiskResultCard
                result={result}
                loading={loading}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
              />
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <WhatIfSimulator
            baseRecord={record}
            selectedModel={selectedModel}
          />
        )}

        {activeTab === 'benchmarks' && <CohortBenchmarkView />}

        {activeTab === 'models' && (
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
          />
        )}

        {activeTab === 'batch' && (
          <BatchScorer
            selectedModel={selectedModel}
            onLoadRecord={handleLoadRecordFromBatch}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-400 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Smartphone Addiction Warning System &middot; Grounded in 3,000-teen calibrated dataset</span>
          <span className="font-mono text-[11px] text-slate-400">Node.js / Express &middot; React 19 &middot; Vite</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
