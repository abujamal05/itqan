/**
 * The transport. Every request in the app goes through `request()` — there are
 * no bare `fetch` calls anywhere else, which is what makes auth, timeouts and
 * error shape uniform instead of per-call habits.
 *
 * AUTH MODEL — JWT in httpOnly cookies.
 * The tokens are never visible to JavaScript, so there is nothing here that
 * reads or stores them; the browser attaches them and the backend reads them.
 * That is the point: a token this file could read is a token an XSS could
 * steal. What this file DOES own is the refresh dance:
 *
 *   request -> 401 -> POST /auth/refresh (once, shared) -> replay the request
 *                  -> refresh also fails -> surface an auth error and log out
 *
 * The refresh is single-flight. Six screens mounting at once will produce six
 * 401s; without the shared promise below that is six refresh calls racing, and
 * with refresh-token rotation five of them lose and invalidate the session that
 * the sixth just established. This is the classic way cookie auth "randomly"
 * logs people out, so it is handled here once rather than per caller.
 *
 * CSRF. Cookie auth is ambient, so a state-changing request needs proof it came
 * from our own page. The backend sets a NON-httpOnly `csrf_token` cookie; this
 * file echoes it in `X-CSRF-Token` on every mutation (double-submit). An
 * attacker's page can cause the cookie to be sent but cannot read it to set the
 * header.
 */
import { API_BASE, REQUEST_TIMEOUT_MS } from '../config/env';
import { ApiError, type ApiErrorBody } from './errors';

/* ------------------------------------------------------------- plumbing -- */

const MUTATING = /^(POST|PUT|PATCH|DELETE)$/i;
const CSRF_COOKIE = 'csrf_token';

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** Listeners notified once when the session is definitively gone. */
type AuthLostHandler = () => void;
const authLostHandlers = new Set<AuthLostHandler>();

/** The auth provider subscribes so a dead session clears app state exactly once. */
export function onAuthLost(fn: AuthLostHandler): () => void {
  authLostHandlers.add(fn);
  return () => authLostHandlers.delete(fn);
}

let notifiedAuthLost = false;
function fireAuthLost() {
  if (notifiedAuthLost) return;      // one notification per dead session
  notifiedAuthLost = true;
  authLostHandlers.forEach((fn) => { try { fn(); } catch { /* never let a listener break the chain */ } });
}

/** Called after a successful sign-in/refresh so the next 401 notifies again. */
export function resetAuthState() { notifiedAuthLost = false; }

/* -------------------------------------------------------------- refresh -- */

/** In-flight refresh, shared by every 401 that arrives while it runs. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: csrfHeader(),
      });
      return res.ok;
    } catch {
      return false;                  // offline: treat as "could not refresh"
    } finally {
      // Cleared on the microtask after settling so concurrent callers all read
      // the same result before a new attempt can start.
      queueMicrotask(() => { refreshInFlight = null; });
    }
  })();
  return refreshInFlight;
}

function csrfHeader(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE);
  return token ? { 'X-CSRF-Token': token } : {};
}

/* -------------------------------------------------------------- request -- */

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Overrides the default per-request timeout — used by the analysis call. */
  timeoutMs?: number;
  /** Set false for endpoints where a 401 is a normal answer (e.g. /session). */
  retryOnAuthFailure?: boolean;
  signal?: AbortSignal;
}

async function parseError(res: Response, path: string): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try { body = (await res.json()) as ApiErrorBody; } catch { /* empty or HTML */ }
  return ApiError.fromResponse(res.status, body, `${res.status} on ${path}`);
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const { body, timeoutMs = REQUEST_TIMEOUT_MS, signal, headers, ...rest } = opts;
  const method = (rest.method ?? 'GET').toUpperCase();

  // Our own timeout, combined with any caller signal, so an abort from either
  // side cancels the request rather than leaking it.
  const timer = AbortSignal.timeout(timeoutMs);
  const composed = signal ? AbortSignal.any([signal, timer]) : timer;

  const isForm = body instanceof FormData;
  return fetch(`${API_BASE}${path}`, {
    ...rest,
    method,
    // `include` rather than `same-origin`: identical behaviour on one origin,
    // and it keeps working if the backend is ever moved to its own domain.
    credentials: 'include',
    signal: composed,
    headers: {
      Accept: 'application/json',
      ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(MUTATING.test(method) ? csrfHeader() : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Performs a request and returns parsed JSON, converting every failure mode
 * into an ApiError. On 401 it refreshes once and replays.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { retryOnAuthFailure = true } = opts;
  let res: Response;

  try {
    res = await send(path, opts);
  } catch (e) {
    // fetch only rejects for network failure or abort — never for HTTP status.
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
    if (opts.signal?.aborted) throw e;                    // caller cancelled: propagate
    throw new ApiError({
      kind: timedOut || aborted ? 'timeout' : 'network',
      status: 0,
      message: timedOut || aborted ? `Timed out on ${path}` : `Network error on ${path}`,
    });
  }

  if (res.status === 401 && retryOnAuthFailure) {
    const refreshed = await refreshSession();
    if (refreshed) {
      resetAuthState();
      res = await send(path, opts);                       // replay once, never twice
    }
    if (!refreshed || res.status === 401) {
      fireAuthLost();
      throw await parseError(res, path);
    }
  }

  if (!res.ok) throw await parseError(res, path);
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------ upload XHR -- */

/**
 * Upload with progress. XHR rather than fetch because fetch still cannot report
 * upload progress in any browser, and this is the one request where the user
 * watches a bar move.
 */
export function upload<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`);
    xhr.withCredentials = true;
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) xhr.setRequestHeader('X-CSRF-Token', csrf);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as T); }
        catch { reject(new ApiError({ kind: 'server', status: xhr.status, message: 'Malformed upload response' })); }
        return;
      }
      if (xhr.status === 401) fireAuthLost();
      let body: ApiErrorBody | null = null;
      try { body = JSON.parse(xhr.responseText) as ApiErrorBody; } catch { /* non-JSON */ }
      reject(ApiError.fromResponse(xhr.status, body, 'Upload failed'));
    });
    xhr.addEventListener('error', () =>
      reject(new ApiError({ kind: 'network', status: 0, message: 'Network error during upload' })));
    xhr.addEventListener('abort', () =>
      reject(new ApiError({ kind: 'timeout', status: 0, message: 'Upload cancelled' })));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
