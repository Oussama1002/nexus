const TOKEN_KEY = 'nexus_token';
const BRAND_ID_KEY = 'nexus_active_brand_id';

export type ApiEnvelopeSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiEnvelopeError = {
  success: false;
  message: string;
  errors: Record<string, string[] | string> | Record<string, unknown>;
};

export type NormalizedSuccess<T> = {
  ok: true;
  status: number;
  message: string;
  data: T;
};

export type NormalizedError = {
  ok: false;
  status: number;
  message: string;
  errors: ApiEnvelopeError['errors'];
};

export type NormalizedResponse<T> = NormalizedSuccess<T> | NormalizedError;

function baseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  // Default to IPv4 loopback: on Windows, `localhost` often hits IPv6/Apache while
  // `php artisan serve` binds 127.0.0.1 — wrong host = no Nexus CORS / wrong app.
  return (raw ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '');
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function readActiveBrandId(): string | null {
  try {
    const v = localStorage.getItem(BRAND_ID_KEY);
    if (v) return v;
    const legacy = localStorage.getItem('nexus.activeBrandId');
    return legacy;
  } catch {
    return null;
  }
}

function handleUnauthorized(): void {
  setStoredToken(null);
  try {
    localStorage.removeItem(BRAND_ID_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { success: false, message: 'Invalid JSON response.', errors: {} };
  }
}

function normalize<T>(status: number, body: unknown): NormalizedResponse<T> {
  if (body && typeof body === 'object' && 'success' in body) {
    const b = body as Partial<ApiEnvelopeSuccess<T>> & Partial<ApiEnvelopeError>;
    if (b.success === true) {
      return {
        ok: true,
        status,
        message: typeof b.message === 'string' ? b.message : 'OK',
        data: (b.data ?? null) as T,
      };
    }
    if (b.success === false) {
      return {
        ok: false,
        status,
        message: typeof b.message === 'string' ? b.message : 'Request failed',
        errors: (b.errors && typeof b.errors === 'object' ? b.errors : {}) as ApiEnvelopeError['errors'],
      };
    }
  }
  // Laravel `abort(422, '…')` / some exceptions return `{ message }` without `success`
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message?: unknown }).message === 'string'
  ) {
    const b = body as { message: string; errors?: unknown };
    return {
      ok: false,
      status,
      message: b.message,
      errors: (b.errors && typeof b.errors === 'object' ? b.errors : {}) as ApiEnvelopeError['errors'],
    };
  }
  return {
    ok: false,
    status,
    message: 'Unexpected response format.',
    errors: {},
  };
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** If set, sends this value as X-Brand-Id (overrides stored active brand). */
  brandId?: string;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<NormalizedResponse<T>> {
  const url = `${baseUrl()}/${path.replace(/^\//, '')}`;
  const token = getStoredToken();
  const { brandId: optBrand, ...fetchOpts } = options;
  const brandHeader = optBrand !== undefined ? optBrand : readActiveBrandId();

  const headers = new Headers(fetchOpts.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (fetchOpts.body !== undefined && !(fetchOpts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (brandHeader) headers.set('X-Brand-Id', brandHeader);

  let res: Response;
  const bodyInit: BodyInit | undefined =
    fetchOpts.body instanceof FormData || fetchOpts.body === undefined
      ? (fetchOpts.body as FormData | undefined)
      : JSON.stringify(fetchOpts.body);
  try {
    res = await fetch(url, {
      ...fetchOpts,
      headers,
      body: bodyInit,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, status: 0, message: msg, errors: {} };
  }

  const body = await parseJson(res);

  if (res.status === 401) {
    handleUnauthorized();
    const err = normalize<T>(res.status, body);
    if (err.ok) {
      return { ok: false, status: 401, message: 'Unauthenticated.', errors: {} };
    }
    return err;
  }

  return normalize<T>(res.status, body);
}

export function get<T>(path: string, init?: RequestOptions): Promise<NormalizedResponse<T>> {
  return apiRequest<T>(path, { ...init, method: 'GET' });
}

export function post<T>(path: string, body?: unknown, init?: RequestOptions): Promise<NormalizedResponse<T>> {
  return apiRequest<T>(path, { ...init, method: 'POST', body });
}

export function put<T>(path: string, body?: unknown, init?: RequestOptions): Promise<NormalizedResponse<T>> {
  return apiRequest<T>(path, { ...init, method: 'PUT', body });
}

export function patch<T>(path: string, body?: unknown, init?: RequestOptions): Promise<NormalizedResponse<T>> {
  return apiRequest<T>(path, { ...init, method: 'PATCH', body });
}

export function del<T>(path: string, init?: RequestOptions): Promise<NormalizedResponse<T>> {
  return apiRequest<T>(path, { ...init, method: 'DELETE' });
}
