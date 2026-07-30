/**
 * Environment configuration — the single place the app learns where the
 * backend is and how long it may take.
 *
 * Vite inlines `import.meta.env.*` at build time, so these are compile-time
 * constants per deployment, not runtime lookups. Every value has a working
 * default so a fresh clone runs with no .env file at all.
 *
 * Set these in Vercel per environment (Development / Preview / Production),
 * or in `.env.local` for a local backend. See .env.example.
 */

export type Environment = 'local' | 'staging' | 'production';

const raw = import.meta.env as Record<string, string | undefined>;

/** Trailing slashes are stripped so callers can always write `${API_BASE}/path`. */
const trimSlash = (s: string) => s.replace(/\/+$/, '');

/**
 * Where the FastAPI backend lives.
 *
 * Default `/api` means "same origin", which is what makes the session cookie
 * readable without any CORS configuration. Point it at an absolute URL only
 * when the backend is genuinely on another origin — and if you do, the backend
 * MUST send `Access-Control-Allow-Credentials: true` and an explicit
 * `Access-Control-Allow-Origin` (never `*`), or the auth cookies are dropped
 * silently and every request comes back 401.
 */
export const API_BASE = trimSlash(raw.VITE_API_BASE_URL ?? '/api');

/** Which deployment this build is for. Only affects logging and diagnostics. */
export const ENVIRONMENT: Environment =
  (raw.VITE_ENVIRONMENT as Environment | undefined)
  ?? (import.meta.env.DEV ? 'local' : 'production');

export const IS_PRODUCTION = ENVIRONMENT === 'production';

/**
 * How long a normal request may take before the client gives up (ms).
 * Generous enough for a cold serverless start, short enough that a hung
 * request does not leave a spinner on screen forever.
 */
export const REQUEST_TIMEOUT_MS = Number(raw.VITE_REQUEST_TIMEOUT_MS ?? 20_000);

/**
 * How long the SYNCHRONOUS analysis request may take (ms).
 *
 * This is separate and much larger because it is the one request that runs the
 * whole A -> C -> E pipeline inline: OCR, several LLM calls, embedding
 * retrieval and set-cover selection. Two minutes is the working assumption.
 *
 * WARNING FOR OPS: the client timeout is the *last* limit that applies. Every
 * proxy in front of FastAPI has its own, and most default to 60s — Vercel
 * serverless functions, nginx `proxy_read_timeout`, AWS ALB idle timeout,
 * Cloudflare. If the pipeline can exceed those, raising this number alone will
 * not help; the gateway will cut the connection first. See the timeout section
 * of BACKEND_INTEGRATION.md.
 */
export const ANALYSIS_TIMEOUT_MS = Number(raw.VITE_ANALYSIS_TIMEOUT_MS ?? 120_000);

/** Where the marketing site lives (it owns log in and sign up). */
export const SITE_URL = trimSlash(raw.VITE_SITE_URL ?? 'https://itqan-site.vercel.app');

/** Surfaced in diagnostics so a bug report can name the exact build. */
export const config = {
  apiBase: API_BASE,
  environment: ENVIRONMENT,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  analysisTimeoutMs: ANALYSIS_TIMEOUT_MS,
  siteUrl: SITE_URL,
} as const;
