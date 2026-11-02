export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export type TokenProvider = (opts?: { force?: boolean }) => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | string[] | undefined>;
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : '/api';

  let url = base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);

  if (!params) return url;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, String(value));
    }
  }
  const queryString = qs.toString();
  if (queryString) url += '?' + queryString;
  return url;
}

async function getToken(force = false): Promise<string | null> {
  if (!tokenProvider) return null;
  return tokenProvider({ force });
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, init);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;
  const url = buildUrl(path, params);

  const token = await getToken();
  const headers: Record<string, string> = {
    'X-Request-ID': crypto.randomUUID(),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let response: Response;
  try {
    response = await doFetch(url, init);
  } catch (err) {
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
  }

  // 401: refresh token and retry once
  if (response.status === 401 && tokenProvider) {
    const freshToken = await getToken(true);
    if (freshToken && freshToken !== token) {
      headers['Authorization'] = `Bearer ${freshToken}`;
      headers['X-Request-ID'] = crypto.randomUUID();
      try {
        response = await doFetch(url, { ...init, headers });
      } catch (err) {
        throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
      }
      if (response.status === 401) {
        throw new ApiError(401, 'Phiên đăng nhập hết hạn');
      }
    } else {
      throw new ApiError(401, 'Phiên đăng nhập hết hạn');
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.ok) {
    return response.json() as Promise<T>;
  }

  // Error response: try to get detail from JSON body
  let detail: string = response.statusText || 'Unknown error';
  try {
    const errorBody = await response.json();
    if (errorBody?.detail) detail = String(errorBody.detail);
  } catch {
    // non-JSON error body — keep statusText
  }
  throw new ApiError(response.status, detail);
}
