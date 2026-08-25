/**
 * Dev-only glue that makes the marketing site and this app one origin.
 *
 * It does two jobs and nothing else:
 *
 *  1. Serves the site's built output at the root, byte for byte. The site's
 *     source is never read, rewritten or patched — if it is stale, you rebuild
 *     it, you do not edit it here.
 *
 *  2. Implements the endpoints the site's forms ALREADY post to. Look at
 *     itqan-website/src/scripts/form.ts: the form does
 *     `fetch(form.action, {method:'POST', body:FormData})` and, on any ok
 *     response, navigates to `data-success-url`. So a 200 plus a session
 *     cookie is the entire contract. Nothing about the site has to change to
 *     satisfy it.
 *
 * In production these endpoints are the real API and this file does not ship.
 * It is deliberately not clever: no framework, no session store, no hashing,
 * because none of that would survive contact with the real backend anyway.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import { alternateCourses, analysisResult, courses, dashboard, jobs } from './data.js';
import { chatAnswer, chatAttachmentReply } from './chat-data.js';
import type { Locale } from './data.js';

const SITE_DIST = path.resolve(__dirname, '../../itqan-website/dist');
const COOKIE = 'itqan_session';
const LOCALE_COOKIE = 'itqan_locale';

/* ------------------------------------------------------------- accounts -- */

interface Account { id: string; fullName: string; email: string; password: string;
                    onboarded: boolean; emailVerified: boolean }

/**
 * Seeded test accounts live HERE, on the server side, and are never rendered
 * into any page. Credentials belong in the project's notes, not in the UI.
 */
const accounts: Account[] = [
  /**
   * The standing account. Onboarded, and seeded with a profile below, so a log
   * in always lands on a populated dashboard — no re-running the flow after
   * every dev-server restart.
   *
   * She used to be `onboarded: false` with no profile stored anywhere, which
   * meant the only way to see the dashboard was to complete onboarding by hand,
   * and the profile screen showed its empty state even afterwards because
   * nothing seeded `profiles`.
   */
  { id: 'u_maryam', fullName: 'Maryam Al Balushi', email: 'maryam@itqan.test', password: 'itqan1234', onboarded: true, emailVerified: true },
  { id: 'u_nasser', fullName: 'Nasser Al Hinai', email: 'nasser@itqan.test', password: 'itqan1234', onboarded: true, emailVerified: true },
  /**
   * The un-onboarded fixture, and the E2E suite's `ACCOUNTS.fresh` — the
   * onboarding.spec walk depends on this landing on /app/upload rather than the
   * dashboard. MUST stay `onboarded: false`. Maryam is deliberately NOT this
   * account any more: she is seeded onboarded for manual QA, and pointing the
   * fresh-flow tests at her is exactly what turned CI red.
   */
  { id: 'u_new', fullName: 'Salim Al Amri', email: 'new@itqan.test', password: 'itqan1234', onboarded: false, emailVerified: true },
];

/** Progress and profile per account, so a reload does not restart onboarding. */
const progress = new Map<string, unknown>();
/** Confirmed profiles, so the profile screen can read one back. */
const profiles = new Map<string, Record<string, unknown>>();
/* Every document an account has uploaded, newest first — production's
   `all_documents`. Kept per user rather than per onboarding attempt, because
   that is the difference the Documents screen depends on: a transcript added
   MONTHS after onboarding still belongs to the account, and a stub that forgets
   it would make "add a transcript to an existing profile" look broken here while
   working in production. */
const uploads = new Map<string, Record<string, unknown>[]>();

/** Hud's threads per account. */
interface ChatThreadRow {
  id: string;
  title: string;
  messages: { id: string; role: string; text: string; [k: string]: unknown }[];
  updatedAt: number;
}
const chatThreads = new Map<string, ChatThreadRow[]>();

/**
 * Recommendation feedback per account: likes, dislikes and why.
 *
 * A Map like everything else here, so it survives a reload and not a restart.
 * Production stores this on the account and FEEDS IT TO THE RANKER — that is
 * the whole reason the endpoint exists, and the part a stub cannot stand in
 * for. What it can prove is the contract: a verdict given here is still here
 * after a reload, which is what the screens are built against.
 */
interface FeedbackRow {
  subject: 'job' | 'course';
  itemId: string;
  verdict: 'like' | 'dislike';
  reason?: string | null;
  note?: string | null;
  replaced?: boolean;
  at: number;
}
const feedback = new Map<string, FeedbackRow[]>();

/** Latest verdict per item, which is what a card renders. */
const feedbackState = (rows: FeedbackRow[] = []) => {
  const out: { jobs: Record<string, string>; courses: Record<string, string> } =
    { jobs: {}, courses: {} };
  // Oldest first, so a later change of mind overwrites an earlier one.
  rows.forEach((r) => { out[r.subject === 'job' ? 'jobs' : 'courses'][r.itemId] = r.verdict; });
  return out;
};

/**
 * How long a chat turn takes to come back.
 *
 * Deliberate, for the same reason PHASE_ONE_MS is: a turn that resolves in
 * zero milliseconds lets the thinking state ship untested, and the thinking
 * state is the one place Hud actually animates on that screen.
 */
const CHAT_TURN_MS = 900;

/** One re-run a week, as production allows. Spent, it stops being offered. */
let rerunCredits = 1;

/**
 * The AI allowance, per account: ONE daily pool of tokens.
 *
 * 30 a day free, 90 paid, spent at published prices — a message costs 1 and a
 * document re-read costs 19, which is what the re-read was MEASURED to cost
 * against a message. There is no separate weekly rescan allowance any more.
 *
 * Counted here rather than faked, so the bar on the profile screen moves when
 * you actually use the thing — a stub that returned a constant would have let a
 * broken counter ship. And it moves by the RIGHT amount: a stub charging 1 for
 * a re-read would hide the only interesting behaviour the budget has.
 */
const PLAN_TOKENS = { free: 30, paid: 90 } as const;
const TOKEN_PRICES = { message: 1, documentReread: 19 } as const;

/**
 * How many job matches a free account sees. The rest are paid.
 *
 * Three, and they are the STRONGEST three rather than the first three that
 * happen to be in the array — the free tier is "your best matches, kept
 * current", not "a sample". The stub's fixture is already ranked, so slicing is
 * the right cut here; production must sort by score before it slices.
 */
const FREE_MATCHES = 3;

/**
 * Is the job cut switched on?
 *
 * OFF, because production does not do it yet (BACKEND.md §5). The stub matches
 * production rather than running ahead of it: a local build that gates while
 * the real API does not is a build that tests a screen nobody has. Flip it with
 * `POST /api/dev/gate {"on":true}` to exercise the locked cards.
 */
let jobGate = false;

/**
 * Which plan an account is on.
 *
 * In-memory and flipped by the dev-only upgrade route below, because there is
 * no Paddle webhook locally. Production reads this from the account.
 */
const plans = new Map<string, 'free' | 'paid'>();
const planFor = (id: string) => plans.get(id) ?? 'free';

/** One counter, because there is one pool. */
const tokensUsed = new Map<string, number>();
const spend = (id: string, amount: number) =>
  tokensUsed.set(id, (tokensUsed.get(id) ?? 0) + amount);

/**
 * The refusal body, when a spend does not fit.
 *
 * `needed` and `remaining` are here because the SCREEN renders them: the
 * Documents error path says "a re-read costs 19 and you have 8 left". Without
 * these fields in the stub that sentence could only ever be seen on a real
 * account with a genuinely spent budget, which is no way to develop it.
 *
 * Returns null when the spend fits, so a caller reads as `refuse ?? proceed`.
 */
function tokenRefusal(id: string, amount: number) {
  const used = tokensUsed.get(id) ?? 0;
  const limit = PLAN_TOKENS[planFor(id)];
  if (used + amount <= limit) return null;
  return {
    error: 'token_limit',
    needed: amount,
    remaining: Math.max(0, limit - used),
    resetsAt: resetsAt('day'),
  };
}

/** Midnight tonight, and next Monday — when each counter goes back to zero. */
function resetsAt(period: 'day' | 'week'): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (period === 'day' ? 1 : ((8 - d.getDay()) % 7) || 7));
  return d.toISOString();
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Every file part in a multipart body, as metadata.
 *
 * Its own scan rather than an extension of `parseBody`, which flattens a body to
 * one string per field and therefore keeps only the last file. Widening that
 * would change a return type the document-upload path also depends on, for the
 * sake of a dev stub.
 *
 * The bytes are read only to measure them. Nothing here stores a file, and
 * nothing should: a transcript dropped into a chat must not become the document
 * the pipeline runs on, because that route has a human confirmation screen and
 * this one does not.
 */
function chatAttachments(raw: Buffer, contentType: string) {
  if (!contentType.includes('multipart/form-data')) return [];
  const boundary = contentType.split('boundary=')[1]?.split(';')[0];
  if (!boundary) return [];
  const out: { id: string; fileName: string; mimeType: string; sizeBytes: number }[] = [];
  raw.toString('binary').split(`--${boundary}`).forEach((part, i) => {
    const filename = /filename="([^"]*)"/.exec(part);
    if (!filename || !filename[1]) return;
    const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
    out.push({
      id: `att${Date.now().toString(36)}${i}`,
      fileName: filename[1],
      mimeType: (/Content-Type:\s*([^\r\n]+)/i.exec(part)?.[1] ?? 'application/octet-stream').trim(),
      sizeBytes: Buffer.byteLength(value, 'binary'),
    });
  });
  return out;
}

/**
 * Finds the thread, or starts one.
 *
 * A new thread starts EMPTY. Hud's greeting is authored on the client so the
 * screen renders with no network call, and seeding a second copy here would give
 * the same sentence two sources that could drift apart.
 */
function openThread(accountId: string, threadId: string, title: string): ChatThreadRow {
  const threads = chatThreads.get(accountId) ?? [];
  const found = threads.find((t) => t.id === threadId);
  if (found) return found;
  const started: ChatThreadRow = {
    id: `t${Date.now().toString(36)}`,
    title: title.length > 48 ? `${title.slice(0, 48)}…` : title,
    messages: [],
    updatedAt: Date.now(),
  };
  threads.push(started);
  chatThreads.set(accountId, threads);
  return started;
}

/* ---- email verification state ----
 *
 * A stub cannot send mail, so it accepts one fixed code. The rest is modelled
 * for real, because this is what the verification screen is developed against:
 * an issue TIME rather than a flag, so the countdown the page shows is computed
 * the way production computes it. Hard-coding "600 seconds" here would let a
 * timer bug through that only appears on a reload.
 */
const DEV_CODE = '123456';
const VERIFY_CODE_MINUTES = 10;
const VERIFY_MAX_ATTEMPTS = 5;
const verifications = new Map<string, { expiresAt: number; attempts: number }>();

function issueCode(accountId: string) {
  const fresh = { expiresAt: Date.now() + VERIFY_CODE_MINUTES * 60_000, attempts: 0 };
  verifications.set(accountId, fresh);
  return fresh;
}

/**
 * Seed a profile for every already-onboarded account.
 *
 * Without this, `profiles` started empty and `GET /api/profile` answered 404 for
 * an account whose own `onboarded` flag said it had finished — so the profile
 * screen rendered its empty state on a user who demonstrably had data, and the
 * dashboard had nothing to read. The two facts have to agree at startup or the
 * seeded accounts are only half seeded.
 *
 * Shape is `StoredProfile` from src/api/types.ts. `avatarUrl` stays null because
 * the upload endpoint is not built yet and the UI is meant to fall back to
 * initials; `suggestedRole` carries its confidence and reasoning because the
 * contract requires every recommendation to.
 */
const seedProfile = (a: Account) => ({
  fullName: a.fullName,
  birthDate: '2001-04-17',
  graduationDate: '2024-06',
  phone: null,
  skills: ['SQL', 'Data cleaning', 'Statistics', 'Excel modelling', 'Report writing', 'Python'],
  preferences: {
    coursePricing: 'free',
    workArrangement: 'hybrid',
    preferredRole: 'Data Analyst',
    openToOtherRoles: 'yes',
  },
  documentId: 'doc_seed_cv',
  documents: [
    { id: 'doc_seed_cv', fileName: 'cv.pdf', mimeType: 'application/pdf', sizeBytes: 184320, kind: 'cv' },
    { id: 'doc_seed_tr', fileName: 'transcript.pdf', mimeType: 'application/pdf', sizeBytes: 262144, kind: 'transcript' },
  ],
  avatarUrl: null,
  suggestedRole: {
    title: 'Junior Data Analyst',
    confidence: 0.82,
    why: 'Your statistics and database coursework covers most of what these roles ask for, and your project work shows you have already cleaned and reported on real data.',
  },
  updatedAt: Date.now(),
});

accounts.filter((a) => a.onboarded).forEach((a) => profiles.set(a.id, seedProfile(a)));

/** How long the fake pipeline takes end to end, and the jobs in flight. */
/**
 * The stub emulates BOTH halves of the run, because the real backend pauses.
 *
 * `PHASE_ONE_MS` is Agent A reading the documents; the run then sits at
 * `awaiting_confirmation` until POST /api/profile, which is what starts Agent C
 * and Agent E (`PHASE_TWO_MS`). Emulating the pause matters: a stub that ran
 * straight through to `done` would hide the exact states the UI now has to
 * handle, and a dev stub that accepts what production does not has already
 * caused one bug in this codebase.
 */
const PHASE_ONE_MS = 5000;
const PHASE_TWO_MS = 6000;
const jobs_ = new Map<string, {
  started: number; bad: boolean; confirmedAt?: number;
}>();
/** Document ids the pipeline will refuse, so the failure path is reachable. */
const unreadable = new Set<string>();

const publicUser = ({ password, ...u }: Account) => u;
const tokenFor = (id: string) => `dev.${id}`;
const idFromToken = (t: string) => t.split('.')[1] ?? '';

/* --------------------------------------------------------------- helpers -- */

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function readCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((c) => {
      const i = c.indexOf('=');
      return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    }).filter(([k]) => k),
  ) as Record<string, string>;
}

function json(res: ServerResponse, status: number, body: unknown, cookies: string[] = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/** Parses a urlencoded or multipart FormData body into a flat object. */
function parseBody(raw: Buffer, contentType: string): Record<string, string> {
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  }
  if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.split('boundary=')[1]?.split(';')[0];
    if (!boundary) return {};
    const out: Record<string, string> = {};
    raw.toString('binary').split(`--${boundary}`).forEach((part) => {
      const name = /name="([^"]+)"/.exec(part);
      if (!name) return;
      const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
      // A file part carries a filename. Record its metadata rather than its
      // bytes: this dev backend has no reason to keep the contents.
      const filename = /filename="([^"]*)"/.exec(part);
      if (filename) {
        out.__filename = filename[1];
        out.__mimetype = (/Content-Type:\s*([^\r\n]+)/i.exec(part)?.[1] ?? '').trim();
        out.__size = String(Buffer.byteLength(value, 'binary'));
        return;
      }
      out[name[1]] = Buffer.from(value, 'binary').toString('utf8');
    });
    return out;
  }
  try { return JSON.parse(raw.toString('utf8')); } catch { return {}; }
}

const body = (req: Connect.IncomingMessage) =>
  new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

/** The site's locale is in its URL, so the referer says which one they used. */
const localeFromReferer = (ref = '') => (/\/en(\/|$)/.test(ref) ? 'en' : 'ar');

/* ---------------------------------------------------------------- plugin -- */

export interface ItqanSiteOptions {
  /**
   * When set, a real backend is serving /api behind Vite's proxy, so this stub
   * must not answer it. The plugin still serves the built marketing site at `/`,
   * which is where log in and sign up live — dropping the plugin entirely would
   * take the login form with it.
   */
  apiTarget?: string;
}

export function itqanSite(options: ItqanSiteOptions = {}): Plugin {
  return {
    name: 'itqan-site',
    configureServer(server) {
      /* ---- the endpoints the site's forms already post to ---- */
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/api/')) return next();
        // A real backend owns /api; yield rather than race it.
        if (options.apiTarget) return next();

        const cookies = readCookies(req.headers.cookie);
        const setLocale = `${LOCALE_COOKIE}=${localeFromReferer(req.headers.referer)}; Path=/; SameSite=Lax`;

        /* Sign up: the site posts name, email, password, consent.
           `/api/auth/signup` is the real path and the one `config.ts` builds
           against. `/api/placeholder/signup` is answered only because older
           deployed HTML still posts to it; production is dropping that alias,
           and this stub drops it on the same day. A stub that answers a route
           production no longer has is how a screen gets built against a
           fiction. */
        if ((url === '/api/auth/signup' || url === '/api/placeholder/signup') && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const email = (f.email ?? '').trim().toLowerCase();
          if (accounts.some((a) => a.email === email)) {
            return json(res, 409, { error: 'email_taken' });
          }
          // Same rule the deployed function enforces, so dev never accepts a
          // password production would reject.
          const pw = f.password ?? '';
          const strongEnough = pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw)
            && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
          if (!strongEnough) return json(res, 400, { error: 'invalid_input' });

          const account: Account = {
            id: `u_${Date.now().toString(36)}`,
            fullName: (f.name ?? '').trim(),
            email,
            password: pw,
            onboarded: false,
            // FALSE, as production leaves it. The stub previously had no such
            // field, and developing the app against a shape production cannot
            // produce is how `null 0` on a price and a fabricated birthDate both
            // reached a real screen unnoticed.
            emailVerified: false,
          };
          accounts.push(account);
          // Signup issues the code in production, and the countdown runs from
          // THAT moment rather than from when the verify page loads. Issuing it
          // here is what makes the stub reproduce that.
          issueCode(account.id);
          // The referer's language, not the `locale` further down — that one is
          // declared after this block and reading it here is a temporal dead
          // zone, i.e. a ReferenceError on every signup in dev.
          return json(res, 200,
                      { ok: true, verifyUrl: `/${localeFromReferer(req.headers.referer)}/verify-email/` }, [
            `${COOKIE}=${tokenFor(account.id)}; Path=/; SameSite=Lax`,
            setLocale,
          ]);
        }

        // Log in: the site posts email, password. Same alias rule as sign up.
        if ((url === '/api/auth/login' || url === '/api/placeholder/login') && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const hit = accounts.find(
            (a) => a.email === (f.email ?? '').trim().toLowerCase() && a.password === f.password,
          );
          // The site shows its own "could not log you in" message on any
          // non-ok response, so 401 needs no body it would have to understand.
          if (!hit) return json(res, 401, { error: 'invalid_credentials' });
          return json(res, 200, { ok: true }, [
            `${COOKIE}=${tokenFor(hit.id)}; Path=/; SameSite=Lax`,
            setLocale,
          ]);
        }

        /**
         * The site's forms navigate to /api/handoff on success — that value is
         * baked into the built HTML by itqan-website/src/config.ts. In
         * production it is the cross-domain bridge: it mints a short-lived
         * signed token and redirects to the app's own origin with it.
         *
         * Here there is only one origin and the session cookie already reaches
         * the app, so there is nothing to hand over. It still has to EXIST,
         * though: without it every local sign in ended on the site's 404 page,
         * and the whole flow could not be walked before deploying, which is the
         * one thing this plugin is for.
         */
        if (url === '/api/handoff') {
          res.statusCode = 302;
          res.setHeader('Location', cookies[COOKIE] ? '/app/' : '/');
          return res.end();
        }

        // Everything below is the app talking to its own backend.
        const token = cookies[COOKIE];
        const me = token ? accounts.find((a) => a.id === idFromToken(token)) : undefined;

        if (url === '/api/session') {
          if (!me) return json(res, 401, { error: 'no_session' });
          return json(res, 200, {
            token,
            user: publicUser(me),
            locale: cookies[LOCALE_COOKIE] ?? 'ar',
          });
        }

        if (url === '/api/logout' && req.method === 'POST') {
          return json(res, 200, { ok: true }, [`${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`]);
        }

        if (!me) return json(res, 401, { error: 'no_session' });

        /* ---- email verification ----
         *
         * The real flow mails a 6-digit code; a dev stub cannot, so it accepts a
         * FIXED one. Everything else is modelled honestly, because the screen is
         * developed against this: a wrong code counts down attempts, five
         * failures kill the code, and the countdown is seconds the STUB
         * computed from an issue time — not a constant — so a reload here
         * behaves the way it does in production rather than restarting at ten
         * minutes.
         */
        if (url === '/api/auth/verification') {
          if (me.emailVerified) {
            return json(res, 200, { verified: true, secondsRemaining: 0, attemptsRemaining: 0 });
          }
          const v = verifications.get(me.id) ?? issueCode(me.id);
          const left = Math.max(0, Math.round((v.expiresAt - Date.now()) / 1000));
          return json(res, 200, {
            verified: false,
            secondsRemaining: v.attempts >= VERIFY_MAX_ATTEMPTS ? 0 : left,
            attemptsRemaining: Math.max(0, VERIFY_MAX_ATTEMPTS - v.attempts),
          });
        }

        if (url === '/api/auth/verify-email' && req.method === 'POST') {
          if (me.emailVerified) return json(res, 200, { ok: true, alreadyVerified: true });
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const v = verifications.get(me.id) ?? issueCode(me.id);
          if (Date.now() > v.expiresAt || v.attempts >= VERIFY_MAX_ATTEMPTS) {
            return json(res, 410, { error: 'code_expired' });
          }
          v.attempts += 1;
          if ((f.code ?? '').trim() !== DEV_CODE) {
            const remaining = VERIFY_MAX_ATTEMPTS - v.attempts;
            if (remaining <= 0) return json(res, 410, { error: 'code_expired' });
            return json(res, 422, { error: 'invalid_code', attemptsRemaining: remaining });
          }
          me.emailVerified = true;
          verifications.delete(me.id);
          return json(res, 200, { ok: true });
        }

        if (url === '/api/auth/resend-verification' && req.method === 'POST') {
          if (!me.emailVerified) issueCode(me.id);
          return json(res, 200, { ok: true });
        }

        /* ---- the agent services ---- */
        const locale = (cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar') as Locale;

        if (url === '/api/documents' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const fileName = f.__filename ?? 'document.pdf';
          // Any file named "unreadable" fails the pipeline, so the recovery
          // path is reachable without breaking a real file.
          if (/unreadable/i.test(fileName)) unreadable.add(id);
          const doc = {
            id, fileName, mimeType: f.__mimetype ?? 'application/pdf',
            sizeBytes: Number(f.__size ?? 0), kind: f.kind ?? 'other',
          };
          uploads.set(me.id, [doc, ...(uploads.get(me.id) ?? [])]);
          return json(res, 200, doc);
        }

        /* Removing a document, and the rule the client only asks nicely for.
           THE LAST CV CANNOT GO. The UI hides the control on that row, but the
           client rule is a courtesy — a stale build of the app must not be a
           way in, so the refusal lives here as well and is the reason the front
           end can keep its own check simple. `409` with a machine-readable
           reason rather than a message, so the wording stays in the front end's
           two languages. This mirrors BACKEND.md §3; production still needs it.

           Removed from BOTH stores: `uploads` is this session's, `profiles` is
           what a confirmed profile carries, and a document left in the second
           would come straight back on the next fetch. */
        if (url.startsWith('/api/documents/') && req.method === 'DELETE') {
          const id = decodeURIComponent(url.slice('/api/documents/'.length));
          const mine = uploads.get(me.id) ?? [];
          const prof = profiles.get(me.id) as { documents?: Record<string, unknown>[] } | undefined;
          const onFile = [...mine, ...(prof?.documents ?? [])];

          const doomed = onFile.find((d) => d.id === id);
          if (!doomed) return json(res, 404, { error: 'not_found' });

          const cvs = onFile.filter((d) => d.kind === 'cv');
          if (doomed.kind === 'cv' && cvs.length <= 1) {
            return json(res, 409, { error: 'last_cv' });
          }

          uploads.set(me.id, mine.filter((d) => d.id !== id));
          if (prof?.documents) prof.documents = prof.documents.filter((d) => d.id !== id);
          return json(res, 200, { ok: true });
        }

        if (url === '/api/analysis' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const ids: string[] = Array.isArray((f as never as { documentIds: string[] }).documentIds)
            ? (f as never as { documentIds: string[] }).documentIds : [];
          /* The rule production enforces, mirrored so the screen is developed
             against it: a request without a CV is fine when the ACCOUNT has one,
             and refused only when there is no CV anywhere. Without this the stub
             accepted everything and the transcript-only path could not be tested
             here at all. */
          const onFile = [...(uploads.get(me.id) ?? []),
                          ...(((profiles.get(me.id)?.documents ?? []) as Record<string, unknown>[]))];
          const inRequest = onFile.filter((d) => ids.includes(d.id as string));
          const haveCv = inRequest.some((d) => d.kind === 'cv')
            || onFile.some((d) => d.kind === 'cv');
          if (!haveCv) return json(res, 400, { error: 'cv_required' });

          /* THE CHARGE, mirrored so the refusal is reachable locally.
             Production spends a re-read here only when the account ALREADY has
             a completed run — the first analysis is free, and a new user
             spending two thirds of their first day before seeing a single
             result would be the worst possible introduction. A confirmed
             profile is the nearest thing this stub has to "completed run".
             Charged after the validity check, like the chat route above. */
          if (profiles.has(me.id)) {
            const refused = tokenRefusal(me.id, TOKEN_PRICES.documentReread);
            if (refused) return json(res, 429, refused);
            spend(me.id, TOKEN_PRICES.documentReread);
          }

          const jobId = `job_${Date.now().toString(36)}`;
          jobs_.set(jobId, { started: Date.now(), bad: ids.some((d) => unreadable.has(d)) });
          return json(res, 200, { jobId });
        }

        if (url.startsWith('/api/analysis/')) {
          const jobId = decodeURIComponent(url.slice('/api/analysis/'.length));
          const job = jobs_.get(jobId);
          if (!job) return json(res, 404, { error: 'no_job' });
          if (job.bad) return json(res, 200, { jobId, stage: 'failed', progress: 0, error: 'unreadable' });

          // Phase one: reading -> translating -> the pause, at 0.75.
          //
          // The real backend reports a checkpoint per graph node — eleven of them
          // in Agent A — so the stub advances in comparable steps rather than one
          // smooth ramp, which would hide how the bar actually behaves. Quantised
          // to 20 notches: fine enough to look continuous, coarse enough to still
          // be visibly stepwise.
          const one = Math.min(1, (Date.now() - job.started) / PHASE_ONE_MS);
          if (one < 1) {
            const stepped = Math.floor(one * 20) / 20;
            return json(res, 200, {
              jobId, progress: 0.02 + stepped * 0.73,
              stage: stepped > 0.25 ? 'translating' : 'reading',
            });
          }
          if (job.confirmedAt === undefined) {
            // The extraction is attached AT THE PAUSE. That is what lets the
            // confirm screen show the details instead of a skeleton.
            return json(res, 200, {
              jobId, stage: 'awaiting_confirmation', progress: 0.75,
              result: analysisResult(locale),
            });
          }
          // Phase two: matching -> done.
          const two = Math.min(1, (Date.now() - job.confirmedAt) / PHASE_TWO_MS);
          return json(res, 200, {
            jobId, stage: two >= 1 ? 'done' : 'matching',
            progress: 0.75 + (Math.floor(two * 12) / 12) * 0.25,
            result: analysisResult(locale),
          });
        }

        if (url === '/api/dashboard') return json(res, 200, dashboard(locale));
        /* THE JOB CUT, MADE SERVER SIDE. A free account gets its three
           strongest matches and a COUNT of the rest; the locked ones are never
           serialised, so there is nothing in the response for an extension or
           devtools to reveal. The stub mirrors production deliberately — doing
           the cut in the client here would let a bypassable build pass local
           testing and ship. See BACKEND.md §5. */
        if (url === '/api/jobs') {
          const all = jobs(locale);
          const plan = planFor(me.id);
          if (!jobGate || plan === 'paid') {
            return json(res, 200, { matches: all, locked: 0, plan });
          }
          return json(res, 200, {
            matches: all.slice(0, FREE_MATCHES),
            locked: Math.max(0, all.length - FREE_MATCHES),
            plan,
          });
        }
        if (url === '/api/courses') return json(res, 200, courses(locale));

        /* DEV ONLY. Turns the job cut on so the locked cards can be seen; it
           is off by default because production does not cut yet. */
        if (url === '/api/dev/gate' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          jobGate = String(f.on) === 'true';
          return json(res, 200, { ok: true, gate: jobGate });
        }

        /* DEV ONLY, AND IT HAS NO PRODUCTION COUNTERPART. In production the
           plan flips when Paddle's webhook reaches the server; there is no
           Paddle here, so without this the paid state could not be rendered or
           tested at all. It is not in BACKEND.md because nothing should ever
           build against it. */
        if (url === '/api/dev/plan' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const next = f.plan === 'paid' ? 'paid' : 'free';
          plans.set(me.id, next);
          return json(res, 200, { ok: true, plan: next });
        }

        /* DEV ONLY, AND IT HAS NO PRODUCTION COUNTERPART. Production's budget
           resets at midnight; nothing here can wait for that.
           
           It exists because the E2E suite runs the SAME spec once per browser
           project against ONE dev server, and a spend test costs 20 of a
           30-token budget. The second project therefore met a 429 and spent
           nothing, which is exactly how the token spec passed on chromium and
           failed on the other four in CI. A test that can only run once is not
           a test; this is what makes it start from a known number every time. */
        if (url === '/api/dev/tokens' && req.method === 'POST') {
          tokensUsed.set(me.id, 0);
          rerunCredits = 1;
          return json(res, 200, { ok: true, used: 0 });
        }

        /* What this account has used of its AI allowance. */
        if (url === '/api/usage' && req.method === 'GET') {
          const plan = planFor(me.id);
          const used = tokensUsed.get(me.id) ?? 0;
          const limit = PLAN_TOKENS[plan];
          const tokens = {
            used, limit,
            remaining: Math.max(0, limit - used),
            period: 'day' as const,
            resetsAt: resetsAt('day'),
          };
          return json(res, 200, {
            plan,
            tokens,
            prices: TOKEN_PRICES,
            /* The aliases production still sends: the same pool under the two
               names the old contract used, so nothing vanished the day the
               budget deployed. They come off the wire a release after the app
               stops reading them — mirrored here so the stub keeps telling the
               truth about what the server sends, including the parts the app
               is supposed to ignore. */
            rescans: tokens,
            messages: tokens,
          });
        }

        /* Recommendation feedback. Append-only: the history is the signal, and
           the current verdict is derived from it rather than stored twice. */
        if (url === '/api/preferences/feedback') {
          if (req.method === 'POST') {
            const f = parseBody(await body(req), req.headers['content-type'] ?? '') as unknown as FeedbackRow;
            if (f.subject !== 'job' && f.subject !== 'course') return json(res, 400, { error: 'bad_subject' });
            if (f.verdict !== 'like' && f.verdict !== 'dislike') return json(res, 400, { error: 'bad_verdict' });
            const rows = feedback.get(me.id) ?? [];
            rows.push({ ...f, at: Date.now() });
            feedback.set(me.id, rows);
            return json(res, 200, { ok: true });
          }
          return json(res, 200, feedbackState(feedback.get(me.id)));
        }

        /* A different course closing the same gap.
           Ranked rather than picked at random: something sharing an `unlocks`
           entry with the rejected course comes first, because "similar" has to
           mean "same gap" or the replacement is just the next row down. */
        if (url === '/api/courses/similar' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '') as unknown as
            { courseId?: string; exclude?: string[] };
          const excluded = new Set([...(f.exclude ?? []), f.courseId ?? '']);
          const all = [...courses(locale), ...alternateCourses(locale)];
          const rejected = all.find((c) => c.id === f.courseId);
          const wanted = new Set(rejected?.unlocks ?? []);
          // Never hand back something this account has already turned down.
          const disliked = new Set((feedback.get(me.id) ?? [])
            .filter((r) => r.subject === 'course' && r.verdict === 'dislike')
            .map((r) => r.itemId));
          const pool = all.filter((c) => !excluded.has(c.id) && !disliked.has(c.id));
          const sameGap = pool.find((c) => c.unlocks.some((u) => wanted.has(u)));
          // `null`, never a random course: nothing else closing this gap is a
          // real answer, and the screen has copy for it.
          return json(res, 200, sameGap ?? pool[0] ?? null);
        }

        /* Hud's chat. Threads live in a Map keyed by account, like everything
           else here, so they survive a reload and not a restart.

           The deliberate delay is the same idea as PHASE_ONE_MS on the
           pipeline: a turn that answers in zero milliseconds lets a thinking
           state ship untested, and the thinking state is where Hud actually
           appears. Short enough not to be tedious, long enough to be real. */
        if (url === '/api/chat/threads' && req.method === 'GET') {
          return json(res, 200, (chatThreads.get(me.id) ?? []).map(
            ({ id, title, updatedAt }) => ({ id, title, updatedAt }),
          ));
        }

        if (url.startsWith('/api/chat/threads/')) {
          const id = decodeURIComponent(url.slice('/api/chat/threads/'.length));
          const thread = (chatThreads.get(me.id) ?? []).find((t) => t.id === id);
          if (!thread) return json(res, 404, { error: 'no_thread' });
          return json(res, 200, thread);
        }

        if (url === '/api/chat/ask' && req.method === 'POST') {
          const raw = await body(req);
          const contentType = req.headers['content-type'] ?? '';
          const sent = parseBody(raw, contentType);
          const attachments = chatAttachments(raw, contentType);
          const question = String(sent.question ?? '').trim();
          /* A question OR a file is enough. Requiring text alongside an
             attachment would make "here, read this" impossible to express. */
          if (!question && !attachments.length) return json(res, 400, { error: 'empty_question' });

          /* Counted after the validity check, before the answer: a rejected
             empty question costs nothing, and a question that was asked costs
             one whether or not the user likes the answer. */
          spend(me.id, TOKEN_PRICES.message);

          await pause(CHAT_TURN_MS);

          const thread = openThread(me.id, String(sent.threadId ?? ''), question || attachments[0].fileName);
          /* Both turns are stored, the user's included, because a thread read
             back on another device has to contain the questions as well as the
             answers. The client shows its own copy of the question immediately
             and does not wait for this. */
          thread.messages.push({
            id: `m${Date.now().toString(36)}u`,
            role: 'user',
            text: question,
            ...(attachments.length ? { attachments } : {}),
            createdAt: Date.now(),
          });
          const message: Record<string, unknown> = attachments.length
            ? chatAttachmentReply(locale, attachments.map((a) => a.fileName))
            : chatAnswer(locale, question);

          /* The re-run proposal, so the confirm step is developed against
             something. Keyword-triggered and obviously dumb, like the rest of
             this file — what it reproduces faithfully is the SHAPE: a proposal
             is data on a message, never an action, and only the client's
             confirm calls the endpoint that spends the credit. */
          if (/again|new|جديد|أعد/i.test(question) && rerunCredits > 0) {
            message.proposedRerun = {
              reason: locale === 'ar'
                ? 'ظهرت وظائف جديدة منذ آخر مطابقة.'
                : 'New postings have appeared since your last match.',
              credits: { used: 1 - rerunCredits, limit: 1, remaining: rerunCredits,
                         resetsAt: '2026-08-24T00:00:00+04:00' },
            };
          }
          thread.messages.push(message as never);
          thread.updatedAt = Date.now();
          return json(res, 200, { threadId: thread.id, message });
        }

        /* Ratings have nowhere to go without a store, and that is fine: the
           client never waits on this and never surfaces a failure. Accepting it
           keeps the shape exercised so the real implementation has something to
           replace. */
        if (url === '/api/chat/rate' && req.method === 'POST') {
          await body(req);
          return json(res, 204, { ok: true });
        }

        /* Spending the weekly credit. Requires `confirm: true` exactly as the
           real route does, so a client that forgets it fails HERE rather than in
           production — and the credit is decremented so the proposal stops
           being offered, which is the behaviour that would otherwise only show
           up on a real account a week later. */
        if (url === '/api/assistant/rerun' && req.method === 'POST') {
          const sent = parseBody(await body(req), req.headers['content-type'] ?? '');
          if (String(sent.confirm) !== 'true') {
            return json(res, 400, { error: 'confirmation_required' });
          }
          /* `token_limit`, not `rerun_limit_reached`: the same id production
             returns at BOTH doors, because one budget whichever door should
             mean one reason whichever door. `rerunCredits` stays only to gate
             whether the chat OFFERS the proposal. */
          const refused = tokenRefusal(me.id, TOKEN_PRICES.documentReread);
          if (refused) return json(res, 429, refused);
          rerunCredits = Math.max(0, rerunCredits - 1);
          spend(me.id, TOKEN_PRICES.documentReread);
          return json(res, 200, { jobId: `job_rerun_${Date.now().toString(36)}` });
        }

        if (url === '/api/onboarding/progress') {
          if (req.method === 'PUT') {
            progress.set(me.id, parseBody(await body(req), req.headers['content-type'] ?? ''));
            return json(res, 200, { ok: true });
          }
          if (req.method === 'DELETE') { progress.delete(me.id); return json(res, 200, { ok: true }); }
          return json(res, 200, progress.get(me.id) ?? null);
        }

        // Marks onboarding done on the ACCOUNT, so returning on another device
        // does not restart it — AND starts phase two, which is the real
        // backend's behaviour: the answers in this payload are what shape the
        // matching, so the matching cannot have run before it arrives.
        if (url === '/api/profile' && req.method === 'POST') {
          const submitted = parseBody(await body(req), req.headers['content-type'] ?? '');
          me.onboarded = true;
          // Remember what was confirmed, and which documents it came from, so
          // the profile screen has something to read back. Production reads
          // these from its profiles table; the SHAPE is the contract.
          profiles.set(me.id, {
            ...(submitted as unknown as Record<string, unknown>),
            documents: (progress.get(me.id) as { documents?: unknown[] } | undefined)?.documents ?? [],
            updatedAt: Date.now(),
          });
          progress.delete(me.id);
          const paused = [...jobs_.entries()].reverse()
            .find(([, j]) => !j.bad && j.confirmedAt === undefined
              && Date.now() - j.started >= PHASE_ONE_MS);
          if (!paused) return json(res, 200, { ok: true });
          paused[1].confirmedAt = Date.now();
          return json(res, 200, { ok: true, jobId: paused[0] });
        }

        if (url === '/api/profile' && req.method === 'GET') {
          const stored = profiles.get(me.id);
          if (!stored) return json(res, 404, { error: 'no_profile' });
          // Everything uploaded since, merged over what onboarding recorded —
          // production reads `all_documents` here, not one run's inputs.
          const seeded = (stored.documents as Record<string, unknown>[] | undefined) ?? [];
          const since = uploads.get(me.id) ?? [];
          const seen = new Set(since.map((d) => d.id));
          return json(res, 200, {
            ...stored, email: me.email,
            documents: [...since, ...seeded.filter((d) => !seen.has(d.id))],
          });
        }

        /* Edits from the profile screen. Distinct from POST: this one does NOT
           start the pipeline, because correcting a birth date is not a reason to
           re-run the matching. */
        if (url === '/api/profile' && req.method === 'PUT') {
          const edited = parseBody(await body(req), req.headers['content-type'] ?? '');
          const prev = profiles.get(me.id) ?? {};
          profiles.set(me.id, {
            ...prev,
            ...(edited as unknown as Record<string, unknown>),
            updatedAt: Date.now(),
          });
          return json(res, 200, { ok: true });
        }

        return next();
      });

      /* ---- the built marketing site, served untouched at the root ---- */
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];
        if (url.startsWith('/app') || url.startsWith('/@') || url.startsWith('/node_modules')) {
          return next();
        }
        // /api belongs to a backend, never to the site. A plugin's middleware is
        // registered BEFORE Vite's proxy, so without this the site's 404 page
        // answers every API call and the proxy never sees one — which presents
        // as a completely broken backend rather than as a routing mistake.
        if (url === '/api' || url.startsWith('/api/')) return next();
        if (!fs.existsSync(SITE_DIST)) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.end(
            'The marketing site has not been built yet.\n\n' +
            'Run:  cd ../itqan-website && npm run build\n',
          );
        }

        const rel = decodeURIComponent(url).replace(/^\/+/, '');
        const candidates = [
          path.join(SITE_DIST, rel),
          path.join(SITE_DIST, rel, 'index.html'),
          path.join(SITE_DIST, `${rel}.html`),
        ];
        const file = candidates.find((p) => {
          // Never serve outside the built site.
          if (!p.startsWith(SITE_DIST)) return false;
          return fs.existsSync(p) && fs.statSync(p).isFile();
        });

        if (!file) {
          const notFound = path.join(SITE_DIST, '404.html');
          if (fs.existsSync(notFound)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(fs.readFileSync(notFound));
          }
          return next();
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.end(fs.readFileSync(file));
      });
    },
  };
}
