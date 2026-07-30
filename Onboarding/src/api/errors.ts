/**
 * One error type for every API failure, so screens branch on a `kind` instead
 * of each guessing at status codes.
 *
 * The kinds exist because the UI genuinely does something different for each:
 *   auth     -> the session is gone; send them back to the site to sign in
 *   network  -> nothing reached the server; "check your connection", retryable
 *   timeout  -> it reached the server and we stopped waiting; retryable
 *   validation -> the server rejected the input; show the field messages
 *   conflict -> someone/something else changed it (409); reload and retry
 *   rateLimit -> 429; back off, tell them when to try again
 *   server   -> 5xx; not the user's fault, retryable
 *   unknown  -> anything unclassified
 */

export type ApiErrorKind =
  | 'auth'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'conflict'
  | 'rateLimit'
  | 'timeout'
  | 'network'
  | 'server'
  | 'unknown';

/**
 * The error envelope we expect from FastAPI. FastAPI's own default is
 * `{ "detail": ... }`, which is accepted here as a fallback so the client works
 * before the backend adopts the richer shape.
 */
export interface ApiErrorBody {
  /** Stable machine-readable code, e.g. "invalid_credentials". */
  code?: string;
  /** Human-readable, already localised where the backend can manage it. */
  message?: string;
  /** Field-level messages for form validation: { email: "Already in use" }. */
  fields?: Record<string, string>;
  /** FastAPI's default key — string, or its 422 validation array. */
  detail?: unknown;
  /** Correlation id for tracing a report back to a server log. */
  requestId?: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  readonly requestId?: string;
  /** True when retrying the identical request could plausibly succeed. */
  readonly retryable: boolean;

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    message: string;
    code?: string;
    fields?: Record<string, string>;
    requestId?: string;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.requestId = init.requestId;
    this.retryable = init.kind === 'network' || init.kind === 'timeout'
      || init.kind === 'server' || init.kind === 'rateLimit';
  }

  static kindForStatus(status: number): ApiErrorKind {
    if (status === 401) return 'auth';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'notFound';
    if (status === 409) return 'conflict';
    if (status === 422 || status === 400) return 'validation';
    if (status === 429) return 'rateLimit';
    if (status >= 500) return 'server';
    return 'unknown';
  }

  /** Builds an ApiError from a response body, tolerating FastAPI's `detail`. */
  static fromResponse(status: number, body: ApiErrorBody | null, fallback: string): ApiError {
    const kind = ApiError.kindForStatus(status);
    // FastAPI 422 returns detail as an array of {loc, msg, type}; flatten it
    // into field messages so forms can show them inline.
    let fields = body?.fields;
    if (!fields && Array.isArray(body?.detail)) {
      fields = {};
      for (const d of body.detail as Array<{ loc?: unknown[]; msg?: string }>) {
        const name = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : undefined;
        if (name && d.msg) fields[name] = d.msg;
      }
    }
    const message = body?.message
      ?? (typeof body?.detail === 'string' ? body.detail : undefined)
      ?? fallback;
    return new ApiError({ kind, status, message, code: body?.code, fields, requestId: body?.requestId });
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
/** The session is gone — the only error the app reacts to globally. */
export const isAuthError = (e: unknown): boolean => isApiError(e) && e.kind === 'auth';
