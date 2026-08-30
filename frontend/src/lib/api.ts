/**
 * The only place this app talks to the backend.
 *
 * Every path is relative. In development Vite proxies `/api` to the FastAPI
 * process (see `vite.config.ts`); in production FastAPI serves the built bundle
 * from the same origin. Neither case needs a base URL, so there is none to get
 * wrong.
 *
 * The previous frontend imported a TypeScript `scoreSingleRecord` and computed
 * predictions in the browser from hand-written formulas. That module is gone:
 * scores now come from the serialized estimators in `models/` by way of
 * `Src/inference.py`, which is the same path `python main.py score` exercises.
 */

import type {
  DeleteResponse,
  HealthResponse,
  HistoryListResponse,
  HistoryRecord,
  ModelType,
  ModelsResponse,
  PredictResponse,
  RawRecord,
  RulesResponse,
} from '../types';

/** A non-2xx response, carrying the status so a caller can branch on 422 vs 503. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!response.ok) {
    // FastAPI puts the message in `detail` - a string for our HTTPExceptions,
    // a list of field errors for a pydantic validation failure.
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') {
        detail = body.detail;
      } else if (Array.isArray(body?.detail)) {
        detail = body.detail
          .map((e: { loc?: (string | number)[]; msg?: string }) =>
            `${e.loc?.slice(1).join('.') ?? 'body'}: ${e.msg ?? 'invalid'}`,
          )
          .join('; ');
      }
    } catch {
      // Non-JSON error body - keep the status line.
    }
    throw new ApiError(response.status, detail);
  }

  return (await response.json()) as T;
}

export const getHealth = () => request<HealthResponse>('/health');

export const getModels = () => request<ModelsResponse>('/models');

export const getRules = () => request<RulesResponse>('/rules');

/**
 * Score one or more records.
 *
 * `persist` defaults to true, so an assessment lands in the history table. The
 * what-if simulator passes false: it re-scores on every slider drag, and those
 * intermediate states are not runs anyone wants to see listed.
 */
export function predict(
  records: RawRecord[],
  model: ModelType,
  tips: number,
  persist = true,
): Promise<PredictResponse> {
  return request<PredictResponse>(`/predict?persist=${persist}`, {
    method: 'POST',
    body: JSON.stringify({ records, model, tips }),
  });
}

/** Convenience for the single-record case, which is most of the UI. */
export async function predictOne(
  record: RawRecord,
  model: ModelType,
  tips: number,
  persist = true,
) {
  const response = await predict([record], model, tips, persist);
  return {
    result: response.results[0],
    historyId: response.history_ids[0] ?? null,
  };
}

export function listHistory(params: {
  limit?: number;
  offset?: number;
  band?: string;
  model_name?: string;
} = {}): Promise<HistoryListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString();
  return request<HistoryListResponse>(`/history${suffix ? `?${suffix}` : ''}`);
}

export const getHistoryRecord = (id: number) =>
  request<HistoryRecord>(`/history/${id}`);

export const deleteHistoryRecord = (id: number) =>
  request<DeleteResponse>(`/history/${id}`, { method: 'DELETE' });

export const clearHistory = () =>
  request<DeleteResponse>('/history?confirm=true', { method: 'DELETE' });
