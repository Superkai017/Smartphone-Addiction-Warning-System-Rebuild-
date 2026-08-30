import React from 'react';
import { RawRecord, GenderType, SchoolGradeType } from '../types';
import { Clock, Moon, BookOpen, User, Shield, Gamepad2, Sparkles, Heart } from 'lucide-react';

interface AssessmentFormProps {
  record: RawRecord;
  onChange: (updated: RawRecord) => void;
  onApplyPreset: (presetName: string) => void;
  tipLimit: number;
  setTipLimit: (limit: number) => void;
}

export const AssessmentForm: React.FC<AssessmentFormProps> = ({
  record,
  onChange,
  onApplyPreset,
  tipLimit,
  setTipLimit,
}) => {
  const updateField = <K extends keyof RawRecord>(key: K, value: RawRecord[K]) => {
    onChange({
      ...record,
      [key]: value,
    });
  };

  return (
    <div id="assessment-form-container" className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-5 shadow-xl">
      {/* Quick Profile Loaders */}
      <div className="mb-6 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Quick Cohort Presets
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Load sample profiles from dataset</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onApplyPreset('severe')}
            className="px-2.5 py-2 text-left rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-red-500/30 transition-all text-xs group"
          >
            <div className="font-semibold text-slate-200 group-hover:text-red-400 flex items-center justify-between">
              <span>Severe Risk</span>
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">High screen & sleep debt</p>
          </button>

          <button
            type="button"
            onClick={() => onApplyPreset('moderate')}
            className="px-2.5 py-2 text-left rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-amber-500/30 transition-all text-xs group"
          >
            <div className="font-semibold text-slate-200 group-hover:text-amber-400 flex items-center justify-between">
              <span>Moderate Skew</span>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">Excess gaming & checks</p>
          </button>

          <button
            type="button"
            onClick={() => onApplyPreset('academic')}
            className="px-2.5 py-2 text-left rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-blue-500/30 transition-all text-xs group"
          >
            <div className="font-semibold text-slate-200 group-hover:text-blue-400 flex items-center justify-between">
              <span>Study Focused</span>
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">High edu app ratio</p>
          </button>

          <button
            type="button"
            onClick={() => onApplyPreset('healthy')}
            className="px-2.5 py-2 text-left rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-emerald-500/30 transition-all text-xs group"
          >
            <div className="font-semibold text-slate-200 group-hover:text-emerald-400 flex items-center justify-between">
              <span>Healthy Balance</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">8.5h sleep & active</p>
          </button>
        </div>
      </div>

      {/* Form Sections */}
      <div className="space-y-6">
        {/* 1. Demographics & Context */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Demographics & School Profile</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Age</label>
              <input
                type="number"
                min="10"
                max="19"
                value={record.Age}
                onChange={(e) => updateField('Age', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Gender</label>
              <select
                value={record.Gender}
                onChange={(e) => updateField('Gender', e.target.value as GenderType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">School Grade</label>
              <select
                value={record.School_Grade}
                onChange={(e) => updateField('School_Grade', e.target.value as SchoolGradeType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="7th">7th Grade</option>
                <option value="8th">8th Grade</option>
                <option value="9th">9th Grade</option>
                <option value="10th">10th Grade</option>
                <option value="11th">11th Grade</option>
                <option value="12th">12th Grade</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Parental Control</label>
              <button
                type="button"
                onClick={() => updateField('Parental_Control', record.Parental_Control === 1 ? 0 : 1)}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  record.Parental_Control === 1
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{record.Parental_Control === 1 ? 'Enforced (1)' : 'None (0)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Device Usage & Frequency */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Usage Duration & Compulsivity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Daily Phone Time</label>
                <span className="text-xs font-bold text-emerald-400">{record.Daily_Usage_Hours} hrs</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="14"
                step="0.1"
                value={record.Daily_Usage_Hours}
                onChange={(e) => updateField('Daily_Usage_Hours', parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Cohort 75th percentile cut: 6.4h</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Weekend Phone Time</label>
                <span className="text-xs font-bold text-emerald-400">{record.Weekend_Usage_Hours} hrs</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="16"
                step="0.1"
                value={record.Weekend_Usage_Hours}
                onChange={(e) => updateField('Weekend_Usage_Hours', parseFloat(e.target.value))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Spike vs weekday check</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Daily Screen Unlocks</label>
                <span className="text-xs font-bold text-emerald-400">{record.Phone_Checks_Per_Day} checks</span>
              </div>
              <input
                type="range"
                min="10"
                max="220"
                step="1"
                value={record.Phone_Checks_Per_Day}
                onChange={(e) => updateField('Phone_Checks_Per_Day', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Measures check frequency</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Apps Used Daily</label>
                <span className="text-xs font-bold text-emerald-400">{record.Apps_Used_Daily} apps</span>
              </div>
              <input
                type="range"
                min="1"
                max="35"
                step="1"
                value={record.Apps_Used_Daily}
                onChange={(e) => updateField('Apps_Used_Daily', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Fractured app attention</span>
            </div>
          </div>
        </div>

        {/* 3. Usage Composition */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <Gamepad2 className="w-4 h-4 text-emerald-400" />
            <span>Category Breakdown (Hours)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Social Media Time</label>
                <span className="text-xs font-bold text-indigo-400">{record.Time_on_Social_Media}h</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.1"
                value={record.Time_on_Social_Media}
                onChange={(e) => updateField('Time_on_Social_Media', parseFloat(e.target.value))}
                className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Mobile Gaming Time</label>
                <span className="text-xs font-bold text-purple-400">{record.Time_on_Gaming}h</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="0.1"
                value={record.Time_on_Gaming}
                onChange={(e) => updateField('Time_on_Gaming', parseFloat(e.target.value))}
                className="w-full accent-purple-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Educational / Study Time</label>
                <span className="text-xs font-bold text-teal-400">{record.Time_on_Education}h</span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.1"
                value={record.Time_on_Education}
                onChange={(e) => updateField('Time_on_Education', parseFloat(e.target.value))}
                className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* 4. Sleep & Lifestyle Displacement */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <Moon className="w-4 h-4 text-emerald-400" />
            <span>Sleep, Health & Social Balance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Nightly Sleep</label>
                <span className="text-xs font-bold text-sky-400">{record.Sleep_Hours} hrs</span>
              </div>
              <input
                type="range"
                min="3"
                max="11"
                step="0.1"
                value={record.Sleep_Hours}
                onChange={(e) => updateField('Sleep_Hours', parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Rec: 9.0h for teens</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Bedtime Phone Use</label>
                <span className="text-xs font-bold text-rose-400">{record.Screen_Time_Before_Bed} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={record.Screen_Time_Before_Bed}
                onChange={(e) => updateField('Screen_Time_Before_Bed', parseFloat(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">High circadian impact</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Exercise Duration</label>
                <span className="text-xs font-bold text-amber-400">{record.Exercise_Hours} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="0.1"
                value={record.Exercise_Hours}
                onChange={(e) => updateField('Exercise_Hours', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">Offline health buffer</span>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-300">Real-life Socializing</label>
                <span className="text-xs font-bold text-emerald-400">{record.Social_Interactions} (0-10)</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={record.Social_Interactions}
                onChange={(e) => updateField('Social_Interactions', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">In-person peer index</span>
            </div>
          </div>
        </div>

        {/* 5. Affect & Schooling */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-slate-200 text-xs font-semibold uppercase tracking-wider">
            <Heart className="w-4 h-4 text-emerald-400" />
            <span>Psychological & Academic Indicators</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Anxiety: <span className="text-slate-200 font-bold">{record.Anxiety_Level}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={record.Anxiety_Level}
                onChange={(e) => updateField('Anxiety_Level', parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Depression: <span className="text-slate-200 font-bold">{record.Depression_Level}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={record.Depression_Level}
                onChange={(e) => updateField('Depression_Level', parseInt(e.target.value, 10))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Self Esteem: <span className="text-slate-200 font-bold">{record.Self_Esteem}/10</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={record.Self_Esteem}
                onChange={(e) => updateField('Self_Esteem', parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Academic Score: <span className="text-slate-200 font-bold">{record.Academic_Performance}/100</span>
              </label>
              <input
                type="range"
                min="40"
                max="100"
                step="1"
                value={record.Academic_Performance}
                onChange={(e) => updateField('Academic_Performance', parseInt(e.target.value, 10))}
                className="w-full accent-blue-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Tip Cap control */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-300">Actionable recommendations cap:</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs">
            {[1, 3, 5, 14].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setTipLimit(num)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  tipLimit === num ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {num === 14 ? 'All' : num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
