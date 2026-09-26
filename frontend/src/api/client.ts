import { API_BASE_URL } from '../lib/env';
import { ApiError, type ApiFailure } from '../lib/errors';
import { createSingleFlight } from './single-flight';
import type { Envelope, PageInfo } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON body (ignored when `formData` is provided). */
  body?: unknown;
  /** Query string values; undefined/null entries are dropped. */
  query?: Record<string, QueryValue>;
  /** multipart/form-data payload (POST /upload/image). */
  formData?: FormData;
  /** Attach `Authorization: Bearer` (default true). */
  auth?: boolean;
}

/** Bridge to the session — registered by <AuthProvider> to avoid a circular import. */
export interface AuthBridge {
  getAccessToken(): string | null;
  /** Rotates the refresh token and stores the new pair. Resolves false when it fails. */
  refresh(): Promise<boolean>;
}

let bridge: AuthBridge | null = null;

export function setAuthBridge(next: AuthBridge | null): void {
  bridge = next;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function toFailure(res: Response): Promise<ApiFailure> {
  const body = (await res.json().catch(() => null)) as Envelope<never> | ApiFailure | null;
  if (body && 'success' in body && body.success === false) return body;
  return {
    success: false,
    statusCode: res.status,
    code:
      res.status === 401
        ? 'UNAUTHORIZED'
        : res.status >= 500
          ? 'INTERNAL_ERROR'
          : 'VALIDATION_ERROR',
    message: `HTTP ${res.status}`,
  };
}

async function doRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<{ data: T; meta?: PageInfo }> {
  const { method = 'GET', body, query, formData, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (auth && bridge) {
    const token = bridge.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(buildUrl(path, query), { ...init, signal: controller.signal });
    if (!res.ok) throw new ApiError(await toFailure(res));

    if (res.status === 204) return { data: undefined as T };
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!json || json.success !== true || !('data' in json)) {
      throw new ApiError({
        success: false,
        statusCode: res.status,
        code: 'INVALID_RESPONSE',
        message: 'پاسخ نامعتبر از سرور دریافت شد.',
      });
    }
    return { data: json.data, meta: json.meta };
  } catch (error) {
    if (controller.signal.aborted) throw new TypeError('NETWORK_TIMEOUT', { cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envelope-aware request with 401 → refresh → retry-once semantics.
 * Parallel 401s share one refresh call (single-flight, see refreshOnce).
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: PageInfo }> {
  try {
    return await doRequest<T>(path, options);
  } catch (error) {
    const needsAuth = options.auth !== false;
    const is401 = error instanceof ApiError && error.statusCode === 401;
    if (!is401 || !needsAuth || !bridge) throw error;

    const ok = await refreshOnce();
    if (!ok) throw error;
    return doRequest<T>(path, options);
  }
}

/** Convenience: return only `data`. */
export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await request<T>(path, options)).data;
}

const flightRefresh = createSingleFlight(async () => {
  if (!bridge) return false;
  try {
    return await bridge.refresh();
  } catch {
    return false;
  }
});

function refreshOnce(): Promise<boolean> {
  return flightRefresh();
}
