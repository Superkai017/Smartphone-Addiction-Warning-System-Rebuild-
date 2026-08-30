import React, { useCallback, useEffect, useState } from 'react';
import {
  History,
  RotateCcw,
  Trash2,
  AlertCircle,
  Filter,
  Loader2,
  Inbox,
} from 'lucide-react';
import { clearHistory, deleteHistoryRecord, listHistory } from '../lib/api';
import { BAND_ORDER, bandClass } from '../lib/catalog';
import type { HistoryRecord, ModelType, RawRecord, SeverityBand } from '../types';

interface HistoryPanelProps {
  /** Bumped by App when a new prediction is persisted, to trigger a refetch. */
  version: number;
  onLoadRecord: (record: RawRecord) => void;
}

const PAGE_SIZE = 25;

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

/**
 * The history tab: every run `/api/predict` persisted, newest first.
 *
 * Rows come from SQLite through `GET /api/history`. Because the stored inputs
 * are the raw feature columns, "Reload" is a straight hand-off of
 * `item.record` back into the assessment form - no field mapping, and the
 * re-scored result is identical to the one listed.
 */
export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  version,
  onLoadRecord,
}) => {
  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [bandFilter, setBandFilter] = useState<SeverityBand | ''>('');
  const [modelFilter, setModelFilter] = useState<ModelType | ''>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listHistory({
        limit: PAGE_SIZE,
        offset,
        band: bandFilter || undefined,
        model_name: modelFilter || undefined,
      });
      setItems(page.items);
      setTotal(page.total);
      setError(null);
    } catch {
      setError('Could not load history. Is the API running?');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, bandFilter, modelFilter]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage, version]);

  // A filter change invalidates the current page number.
  useEffect(() => {
    setOffset(0);
  }, [bandFilter, modelFilter]);

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await deleteHistoryRecord(id);
      // Refetch rather than splice: the page needs backfilling from the server
      // anyway, and `total` has to come down.
      await fetchPage();
    } catch {
      setError(`Could not delete record ${id}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`Delete all ${total} saved predictions? This cannot be undone.`)) {
      return;
    }
    try {
      await clearHistory();
      setOffset(0);
      await fetchPage();
    } catch {
      setError('Could not clear history.');
    }
  };

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, total);

  return (
    <div id="history-view" className="space-y-6">
      {/* Header + filters */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Prediction History
              </h2>
              <p className="text-xs text-slate-400">
                Every scored assessment, persisted to{' '}
                <code className="font-mono text-slate-300">app.db</code>. Reload any
                run&rsquo;s inputs back into the form.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />

            <select
              aria-label="Filter by severity band"
              value={bandFilter}
              onChange={(e) => setBandFilter(e.target.value as SeverityBand | '')}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All bands</option>
              {BAND_ORDER.map((band) => (
                <option key={band} value={band}>
                  {band}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by model"
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value as ModelType | '')}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All models</option>
              <option value="gb">gb</option>
              <option value="xgb">xgb</option>
              <option value="rf">rf</option>
            </select>

            <button
              type="button"
              onClick={handleClearAll}
              disabled={total === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:hover:bg-rose-500/10 text-rose-300 border border-rose-500/25 font-semibold transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading history&hellip;
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Inbox className="w-8 h-8 text-slate-700" />
            <p className="text-sm font-semibold text-slate-300">No saved predictions</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {bandFilter || modelFilter
                ? 'No runs match these filters.'
                : 'Score a record on the Risk Assessment tab and it will appear here.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Scored at</th>
                  <th className="p-3.5">Profile</th>
                  <th className="p-3.5">Usage / Sleep</th>
                  <th className="p-3.5">Model</th>
                  <th className="p-3.5">Risk</th>
                  <th className="p-3.5">Percentile</th>
                  <th className="p-3.5">Flagged</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {formatTimestamp(item.timestamp)}
                      <div className="text-[10px] text-slate-500">#{item.id}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">
                        Age {item.record.Age} &middot; {item.record.School_Grade}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.record.Gender}
                        {item.record.Parental_Control === 1
                          ? ' · parental limits on'
                          : ' · unsupervised'}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div>{item.record.Daily_Usage_Hours}h phone</div>
                      <div className="text-slate-400 text-[10px]">
                        {item.record.Sleep_Hours}h sleep
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                        {item.model_name}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">
                          {item.prediction_score.toFixed(2)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bandClass(item.band)}`}
                        >
                          {item.band}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      <strong>{item.percentile}%</strong>
                    </td>
                    <td className="p-3.5 font-mono text-amber-400 font-bold">
                      {item.n_flagged} / 14
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onLoadRecord(item.record)}
                          title="Load these inputs back into the assessment form"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-semibold transition-all"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reload
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={busyId === item.id}
                          title="Delete this record"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-all disabled:opacity-40"
                        >
                          {busyId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paging */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
            <span className="font-mono">
              {pageStart}&ndash;{pageEnd} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0 || loading}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-medium transition-all"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={pageEnd >= total || loading}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 font-medium transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
