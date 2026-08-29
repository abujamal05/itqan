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

/** One row of `app_consents`: which document, and when. `kind` keeps marketing
 *  consent separate from service consent, so the sign up box can never satisfy
 *  it and an absent row is an auditable no. */
interface ConsentRecord { kind: 'service' | 'marketing'; policyVersion: string; grantedAt: string }

interface Account { id: string; fullName: string; email: string; password: string;
                    onboarded: boolean; emailVerified: boolean;
                    /** Optional only because the seeded accounts predate consent
                     *  being recorded. A real signup always writes one. */
                    consents?: ConsentRecord[] }

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
  /**
   * The MERGE fixture. Like `maryam` it is SPENT against — a re-upload costs a
   * document re-read — so it gets its own account rather than sharing one. Two
   * specs spending the same in-memory counter is precisely what made the token
   * spec pass alone and fail in a full run.
   */
  { id: 'u_reader', fullName: 'Huda Al Zadjali', email: 'reader@itqan.test', password: 'itqan1234', onboarded: true, emailVerified: true },
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

/**
 * Which courses each account has marked finished.
 *
 * Production has had `POST/DELETE /api/courses/:id/complete` for a while and
 * this client called neither, so completion lived only in the browser's
 * localStorage. The courses map moved on, the server did not, and the
 * dashboard — which reads the server — went on naming a finished course as the
 * next step. Recording it here is what lets dev reproduce that at all.
 */
const completedByUser = new Map<string, Set<string>>();

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
/* `alternative` is one agent call over one item, so it sits between a message
   and a full re-read. A STUB'S FIGURE, like the update costs: BACKEND.md §12
   says production must publish a measured one the way the re-read's 19 was
   measured. */
const TOKEN_PRICES = { message: 1, documentReread: 19, alternative: 2 } as const;

/* What each stage of the pipeline costs, matching the server. They are one
   measured re-read divided by which agents actually run: Agent E alone, Agent C
   and E, or all three. Kept beside TOKEN_PRICES rather than derived from it,
   because the server publishes `spent` and the screens read that — this table
   only has to be right enough to develop the difference against. */
const RERUN_PRICES: Record<string, number> = { courses: 2, match: 5, full: 19 };

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

/**
 * Accounts this dev server has been told to pause.
 *
 * Deactivation's MEANING is the server's, not this file's — BACKEND.md §9 says
 * what production has to do, and a stub cannot stand in for stopping a
 * pipeline. What this proves is the contract: the route exists, it answers, and
 * the account it names cannot log back in without being restored. That last
 * part is the half a stub CAN test, and it is the half the UI promises.
 */
const deactivated = new Set<string>();

/**
 * What is out of date per account, and whether the offer has been deferred.
 *
 * THE PRICE IS THE SERVER'S TO STATE, which is the half of this a stub can
 * genuinely stand in for: the client asks what a run costs and shows that
 * figure, so a browser is never doing arithmetic about somebody's budget. The
 * numbers here are the documented token prices; production measures its own.
 */
interface StaleRow { scope: 'documents' | 'skills'; reasons: string[]; deferred: boolean }
const stale = new Map<string, StaleRow>();

/**
 * A skills-only run costs less than a document re-read because it does less
 * work: the documents are not read again. Priced at the message rate times the
 * agents it still has to run, which is a STUB'S GUESS and labelled as one —
 * BACKEND.md §11 says production must publish a measured figure the same way the
 * re-read's 19 was measured.
 */
const UPDATE_COST = { documents: 19, skills: 5 } as const;

/**
 * How far readiness has moved for this account since the seed.
 *
 * DEV ONLY, AND CRUDE ON PURPOSE. Production computes readiness from evidence;
 * nothing here can. What the stub has to reproduce is the SHAPE of the thing —
 * a run finishes, the score is higher than it was, and the dashboard has
 * something real to congratulate. Without it the celebration path could not be
 * walked locally at all, because the seeded score is a constant.
 */
const readinessGain = new Map<string, number>();

/** One rating per account, which is all the product ever asks for. */
const ratings = new Map<string, { stars: number; comment: string | null; at: number }>();

const markStale = (userId: string, scope: 'documents' | 'skills', reason: string) => {
  const row = stale.get(userId);
  /* DOCUMENTS WINS. If both are pending, the documents run subsumes the skills
     one — it rebuilds the skills on its way past — and charging for both would
     be charging twice for work done once. */
  const next: StaleRow = row?.scope === 'documents' || scope === 'documents'
    ? { scope: 'documents', reasons: [...new Set([...(row?.reasons ?? []), reason])], deferred: false }
    : { scope, reasons: [...new Set([...(row?.reasons ?? []), reason])], deferred: false };
  stale.set(userId, next);
};

/**
 * The subscription behind a paid plan.
 *
 * TWO STATES, and the second is the one worth having a stub for: `cancelled`
 * means it will not renew and the account is still entitled until
 * `currentPeriodEnd`. That window is exactly when the settings screen allows
 * deletion and warns about the paid time being given up, and it is unreachable
 * locally without somewhere to hold the flag.
 */
interface SubscriptionRow { status: 'active' | 'cancelled'; currentPeriodEnd: string }
const subscriptions = new Map<string, SubscriptionRow>();

/** A month out, which is what a monthly subscription renews on. */
const monthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};
const planFor = (id: string) => plans.get(id) ?? 'free';

/** One counter, because there is one pool. */
const tokensUsed = new Map<string, number>();

/* The PUBLIC assistant's per-visitor budget, mirroring `public_ask_per_visitor`
   on the server. Counted in a COOKIE rather than a module variable, and that is
   deliberate: the E2E suite runs this spec once per browser project, and a
   process-wide counter would let two projects spend each other's questions.
   Production signs the same cookie; a stub cannot, and does not need to — what
   it has to model is the shape and the refusal, not the tamper-proofing. */
const PUBLIC_ASK_LIMIT = 3;
const ASK_COOKIE = 'itqan_asked';
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
  /** `merge` on a re-upload, which changes the shape of the poll's result. */
  mode?: 'replace' | 'merge';
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

          /* CONSENT IS ENFORCED HERE BECAUSE IT IS ENFORCED IN PRODUCTION.
             An unchecked box omits the field entirely, so absence is the refusal
             case. The API refuses the same way, and the required attribute on
             the checkbox is a courtesy to the user rather than the rule — this
             repo has now found the same client-only-rule shape twice, in
             `last_cv` and in `require_verified_user`.
             A browser sends `on` for a ticked box; the JSON forms the e2e
             helpers post send a real boolean. Both are accepted. */
          const consent = f.consent;
          const consented = consent === 'on' || consent === 'true' || consent === '1';
          if (!consented) return json(res, 400, { error: 'consent_required' });

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
            /* What `app_consents` stores server side: which document, and when.
               Recorded rather than dropped, because a stored tick with no
               version answers "did they agree" and not "to what", and the
               second is the question an audit asks. `kind` exists so marketing
               consent is a SEPARATE row that the sign up box can never satisfy;
               its absence is a clean no. */
            consents: [{
              kind: 'service',
              policyVersion: (f.policy_version ?? '').trim() || 'unknown',
              grantedAt: new Date().toISOString(),
            }],
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
          /* LOGGING BACK IN IS WHAT RESTORES A PAUSED ACCOUNT, and the settings
             screen says so in as many words. Restoring it here is the one half
             of deactivation a stub can actually prove; without it the promise
             on that screen would be untested in the only place it can be
             walked before production has the route at all. */
          deactivated.delete(hit.id);

          /* AND "REMIND ME LATER" MEANS THE NEXT SIGN IN, not never. Without
             this the deferral was permanent and the offer never came back,
             which is precisely the quietly stale journey the whole mechanism
             exists to prevent. BACKEND.md §11 states it as a requirement. */
          const pendingRow = stale.get(hit.id);
          if (pendingRow?.deferred) stale.set(hit.id, { ...pendingRow, deferred: false });
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
        /* ---- the public assistant ----
         *
         * `POST /api/ask` answers a SIGNED-OUT visitor from Itqan's own
         * documentation, and it is the only endpoint here that takes no
         * session — which is why it sits above the token lookup below.
         *
         * The site's Hud panel falls through to it whenever its authored
         * answers do not match. Without it that request 404s locally and the
         * panel quietly shows the authored refusal instead, so the thinking
         * state, a real answer and the limit could not be seen on this machine
         * at all. Shape copied from `api/main.py`: `{answer, remaining}` on the
         * way through, `ask_limit` with a 429 once the three are gone.
         */
        if (url === '/api/ask' && req.method === 'POST') {
          const sent = parseBody(await body(req), req.headers['content-type'] ?? '');
          const question = String(sent.question ?? '').trim();
          if (!question) return json(res, 400, { error: 'empty_question' });
          if (question.length > 500) return json(res, 400, { error: 'message_too_long' });

          const asked = Number(cookies[ASK_COOKIE] ?? '0') || 0;
          if (asked >= PUBLIC_ASK_LIMIT) {
            return json(res, 429, { error: 'ask_limit', asked, limit: PUBLIC_ASK_LIMIT });
          }
          return json(res, 200, {
            answer: `Itqan reads what you already have and tells you where you stand. You asked: ${question}`,
            remaining: Math.max(0, PUBLIC_ASK_LIMIT - (asked + 1)),
          }, [`${ASK_COOKIE}=${asked + 1}; Path=/; SameSite=Lax`]);
        }

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

        /* Every document on the account, from BOTH stores. `uploads` is this
           session's and `profiles` is what a confirmed profile carries; a rule
           that read only one of them would be enforced against half the truth,
           which is how the last-CV check nearly shipped broken. */
        const allDocuments = () => {
          const prof = profiles.get(me.id) as { documents?: Record<string, unknown>[] } | undefined;
          return [...(uploads.get(me.id) ?? []), ...(prof?.documents ?? [])];
        };

        if (url === '/api/documents' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const fileName = f.__filename ?? 'document.pdf';
          // Any file named "unreadable" fails the pipeline, so the recovery
          // path is reachable without breaking a real file.
          if (/unreadable/i.test(fileName)) unreadable.add(id);
          const kind = f.kind ?? 'transcript';
          /* THERE IS ONLY EVER ONE CV, AND UPLOADING ONE REPLACES IT.
             Not a refusal: `/app/documents` exists precisely so somebody can
             hand over a newer CV, and answering that with "you already have
             one" would break the screen's whole purpose to enforce a rule the
             screen was trying to keep. The row and its id survive, which is
             what a stored profile's `documentId` and every past analysis point
             at. Mirrors BACKEND.md §3; production needs it too. */
          const heldCv = kind === 'cv' && allDocuments().find((d) => d.kind === 'cv');
          if (heldCv) {
            markStale(me.id, 'documents', 'document_replaced');
            heldCv.fileName = fileName;
            heldCv.mimeType = f.__mimetype ?? heldCv.mimeType;
            heldCv.sizeBytes = Number(f.__size ?? 0);
            if (/unreadable/i.test(fileName)) unreadable.add(String(heldCv.id));
            else unreadable.delete(String(heldCv.id));
            return json(res, 200, heldCv);
          }
          const doc = {
            id, fileName, mimeType: f.__mimetype ?? 'application/pdf',
            sizeBytes: Number(f.__size ?? 0), kind,
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
        /* Replacing the FILE, keeping the row. The id survives, which is the
           whole reason this route exists rather than a delete plus an upload: a
           stored profile references `documentId`, past analyses reference the
           ids they read, and the CV cannot be deleted at all. It does not read
           anything — extraction stays a separate, reviewed, paid act. */
        if (url.startsWith('/api/documents/') && req.method === 'PUT') {
          const id = decodeURIComponent(url.slice('/api/documents/'.length));
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const doc = allDocuments().find((d) => d.id === id);
          if (!doc) return json(res, 404, { error: 'not_found' });

          doc.fileName = f.__filename ?? doc.fileName;
          doc.mimeType = f.__mimetype ?? doc.mimeType;
          doc.sizeBytes = Number(f.__size ?? doc.sizeBytes);
          /* The same escape hatch the upload has: a file named "unreadable"
             fails the pipeline, so the recovery path stays reachable. */
          if (/unreadable/i.test(String(doc.fileName))) unreadable.add(id);
          else unreadable.delete(id);
          markStale(me.id, 'documents', 'document_replaced');
          return json(res, 200, doc);
        }

        /* Recategorising. The CV slot has a floor and a ceiling: it cannot
           reach zero, because the pipeline cannot run without one, and it
           cannot reach two, because a second makes "your CV" ambiguous on every
           screen that names it. Both refusals are machine readable, so the
           front end keeps owning the wording in its two languages. */
        if (url.startsWith('/api/documents/') && req.method === 'PATCH') {
          const id = decodeURIComponent(url.slice('/api/documents/'.length));
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const kind = String((f as unknown as { kind?: string }).kind ?? '');
          if (!['cv', 'transcript', 'certificate'].includes(kind)) {
            return json(res, 400, { error: 'bad_kind' });
          }

          const onFile = allDocuments();
          const doc = onFile.find((d) => d.id === id);
          if (!doc) return json(res, 404, { error: 'not_found' });

          if (kind === 'cv' && onFile.some((d) => d.id !== id && d.kind === 'cv')) {
            return json(res, 409, { error: 'cv_exists' });
          }
          if (doc.kind === 'cv' && kind !== 'cv') {
            return json(res, 409, { error: 'last_cv' });
          }

          doc.kind = kind;
          return json(res, 200, doc);
        }

        if (url.startsWith('/api/documents/') && req.method === 'DELETE') {
          const id = decodeURIComponent(url.slice('/api/documents/'.length));
          const mine = uploads.get(me.id) ?? [];
          const prof = profiles.get(me.id) as { documents?: Record<string, unknown>[] } | undefined;
          const onFile = allDocuments();

          const doomed = onFile.find((d) => d.id === id);
          if (!doomed) return json(res, 404, { error: 'not_found' });

          const cvs = onFile.filter((d) => d.kind === 'cv');
          if (doomed.kind === 'cv' && cvs.length <= 1) {
            return json(res, 409, { error: 'last_cv' });
          }

          uploads.set(me.id, mine.filter((d) => d.id !== id));
          if (prof?.documents) prof.documents = prof.documents.filter((d) => d.id !== id);
          /* A document leaving the corpus changes what the reading was built
             from, exactly as replacing one does. */
          markStale(me.id, 'documents', 'document_removed');
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
          /* THE MODE IS CARRIED, because the confirm screen renders a different
             thing on a re-upload: the union of old and new skills, plus what
             changed. A stub that always answered `replace` would let the merge
             screen be built against a shape production never sends. */
          const mode = (f as never as { mode?: string }).mode === 'merge' ? 'merge' : 'replace';
          jobs_.set(jobId, {
            started: Date.now(), mode,
            bad: ids.some((d) => unreadable.has(d)),
          });
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
          /* On a merge the server publishes the UNION -- this run's extraction
             plus the already-approved skills it did not find again -- and a
             delta describing what moved. A carried-over skill has
             `confidence: null` and `origin: 'confirmed'`, never a fabricated
             1.0: nothing measured it on this run. */
          const merged = () => {
            const base = analysisResult(locale);
            if (job.mode !== 'merge') return base;
            const approved = (profiles.get(me.id)?.skills ?? []) as string[];
            const found = new Set(base.skills.map((x) => x.name.toLowerCase()));
            const carried = approved
              .filter((n) => !found.has(String(n).toLowerCase()))
              .map((n, i) => ({
                id: `c${i + 1}`, name: String(n),
                confidence: null, origin: 'confirmed' as const,
              }));
            const approvedSet = new Set(approved.map((n) => String(n).toLowerCase()));
            const unapproved = base.skills.filter((x) => !approvedSet.has(x.name.toLowerCase()));
            return {
              ...base,
              skills: [...base.skills, ...carried],
              delta: {
                // First unapproved skill stands in for one they removed before,
                // so the OFFER path is reachable locally and not only in prod.
                addedSkills: unapproved.slice(1),
                changedSkills: [],
                previouslyRemoved: unapproved.slice(0, 1),
                unchangedCount: base.skills.length - unapproved.length,
              },
            };
          };

          if (job.confirmedAt === undefined) {
            // The extraction is attached AT THE PAUSE. That is what lets the
            // confirm screen show the details instead of a skeleton.
            return json(res, 200, {
              jobId, stage: 'awaiting_confirmation', progress: 0.75,
              result: merged(),
            });
          }
          // Phase two: matching -> done.
          const two = Math.min(1, (Date.now() - job.confirmedAt) / PHASE_TWO_MS);
          return json(res, 200, {
            jobId, stage: two >= 1 ? 'done' : 'matching',
            progress: 0.75 + (Math.floor(two * 12) / 12) * 0.25,
            result: merged(),
          });
        }

        if (url === '/api/dashboard') {
          const base = dashboard(locale);
          /* Capped at 100, because a readiness of 104 is not a number this
             product would ever show and a stub that produced one would send
             somebody hunting for a bug in the ring. */
          const readiness = Math.min(100, base.readiness + (readinessGain.get(me.id) ?? 0));
          return json(res, 200, { ...base, readiness });
        }
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
        /* THE COMPLETION JOIN, mirrored. Production returns `completedAt` on
           every course AND keeps returning a finished one after a rescan stops
           recommending it -- Agent E suggests one course per MISSING skill, so
           closing a gap is exactly what drops its course from the next set.
           Without both here, the finished group could not be developed at all
           and the screen would be built against a fiction. */
        if (url === '/api/courses') {
          const done = completedByUser.get(me.id) ?? new Set<string>();
          const listed = courses(locale).map((c) => ({
            ...c,
            completedAt: done.has(c.id) ? new Date().toISOString() : null,
          }));
          const shown = new Set(listed.map((c) => c.id));
          const orphaned = [...done].filter((id) => !shown.has(id));
          // A finished course nothing recommends any more: `recommended: false`,
          // and NO `closesGap`/`priority` -- those came from a recommendation
          // that no longer exists, and inventing them would state a reason
          // Agent E did not give.
          const finished = orphaned.map((id) => ({
            id,
            title: `Finished course ${id}`,
            provider: 'Coursera',
            unlocks: [],
            hoursMin: null, hoursMax: null, durationText: null,
            price: null, currency: null, priceLabel: 'paid',
            recommended: false,
            completedAt: new Date().toISOString(),
            source: { name: 'Coursera', url: 'https://example.test', retrievedAt: '' },
          }));
          return json(res, 200, [...listed, ...finished]);
        }

        /* Completion, POST to set and DELETE to undo.
           Production has had these since before this stub did, and the client
           was calling neither — so dev could not reproduce the bug where the
           server's next step and the local one disagreed. Recorded per user,
           in memory, because that is what this stub is: the point is that the
           route EXISTS and answers, so the client's write path is exercised.
           DELETE is idempotent, matching the documented contract. */
        if (/^\/api\/courses\/[^/]+\/complete$/.test(url)
            && (req.method === 'POST' || req.method === 'DELETE')) {
          const courseId = decodeURIComponent(url.split('/')[3]);
          const set = completedByUser.get(me.id) ?? new Set<string>();
          if (req.method === 'POST') set.add(courseId);
          else set.delete(courseId);
          completedByUser.set(me.id, set);

          /* FINISHING A COURSE ADDS WHAT IT TEACHES. The catalogue already
             says which skills the course unlocks, and completing it is the
             only evidence anyone could ask for that they were earned — so the
             person is not made to type them in, and the matches that depend on
             them are marked as a step behind. */
          if (req.method === 'POST') {
            const course = [...courses(locale), ...alternateCourses(locale)]
              .find((c) => c.id === courseId);
            const prof = profiles.get(me.id) as { skills?: string[] } | undefined;
            if (course && prof) {
              const held = new Set((prof.skills ?? []).map((x) => x.toLowerCase()));
              const added = course.unlocks.filter((x) => !held.has(x.toLowerCase()));
              if (added.length) prof.skills = [...(prof.skills ?? []), ...added];
            }
            markStale(me.id, 'skills', 'course_completed');
          }
          return json(res, 204, undefined);
        }

        /* ---- Closing the account (BACKEND.md §9) ----
           NEITHER ROUTE EXISTS IN PRODUCTION. They are specified there and
           built nowhere, which is precisely why they are stubbed here: without
           them the client's write path could not be exercised at all, and the
           screen that calls them would only ever be seen in its failure state.

           A stub is not a specification. Production has to reach the documents
           on disk, every derived row, and the snapshot rotation LEGAL-BRIEF.md
           records; this reaches four Maps and a cookie. */
        if (url === '/api/account/deactivate' && req.method === 'POST') {
          deactivated.add(me.id);
          /* Signed out with it. The account is paused, so the session that was
             using it has to end in the same response rather than lingering
             until the browser is closed. */
          return json(res, 204, undefined, [`${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`]);
        }

        /* ---- Cancelling (BACKEND.md §10) ----
           NOT BUILT IN PRODUCTION. The real route opens a session with the
           payment provider and hands back its URL; nothing is cancelled until
           that provider's webhook lands, exactly as the upgrade already works.

           This stub flips the row IMMEDIATELY, which production must not do,
           and it is the deliberate simplification: without it the
           cancelled-but-still-running state cannot be reached locally, and that
           state is the whole reason the delete guard below exists. The URL it
           returns is a dev-only page standing in for the provider's, so the
           client's "navigate to where the server sent you" path is exercised. */
        if (url === '/api/subscription/cancel' && req.method === 'POST') {
          const row = subscriptions.get(me.id);
          if (planFor(me.id) !== 'paid' || !row) {
            return json(res, 409, { error: 'no_subscription' });
          }
          subscriptions.set(me.id, { ...row, status: 'cancelled' });
          return json(res, 200, { url: '/api/dev/provider' });
        }

        if (url === '/api/dev/provider') {
          /* DEV ONLY, and it exists so the navigation lands somewhere that says
             what it is instead of a 404 that looks like a broken cancel. */
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          return res.end('<!doctype html><meta charset="utf-8">'
            + '<title>Payment provider (dev)</title>'
            + '<body style="font:16px/1.6 system-ui;margin:4rem auto;max-width:34rem">'
            + '<h1>This stands in for the payment provider</h1>'
            + '<p>In production the server sends you to the provider to finish '
            + 'cancelling, and the subscription changes when its webhook lands. '
            + 'This dev server has already marked it cancelled.</p>'
            + '<p><a href="/app/plan">Back to your plan</a></p>');
        }

        if (url === '/api/account' && req.method === 'DELETE') {
          /* THE SERVER ENFORCES IT TOO. The settings screen does not offer
             deletion while a subscription still renews, so reaching this is a
             stale view — and a stale build of the app is not a way to leave
             somebody paying for an account that no longer exists. */
          if (subscriptions.get(me.id)?.status === 'active') {
            return json(res, 409, { error: 'subscription_active' });
          }
          /* Everything this stub holds about the person, named one at a time.
             A loop over "all the maps" would silently stop covering a store
             added later, and a deletion that misses a store is the failure mode
             the legal brief is actually about. */
          profiles.delete(me.id);
          uploads.delete(me.id);
          completedByUser.delete(me.id);
          chatThreads.delete(me.id);
          feedback.delete(me.id);
          plans.delete(me.id);
          tokensUsed.delete(me.id);
          deactivated.delete(me.id);
          subscriptions.delete(me.id);
          const at = accounts.findIndex((a) => a.id === me.id);
          if (at >= 0) accounts.splice(at, 1);
          return json(res, 204, undefined, [`${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`]);
        }

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
          /* `status=cancelled` puts the account in the window that matters:
             paid, not renewing, and still entitled until the period ends. */
          if (next === 'paid') {
            subscriptions.set(me.id, {
              status: f.status === 'cancelled' ? 'cancelled' : 'active',
              currentPeriodEnd: monthFromNow(),
            });
          } else {
            subscriptions.delete(me.id);
          }
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
          /* A paid account has a subscription; the stub mints one on the way
             past if `/api/dev/plan` did not. Production reads it from the
             payment provider, and a FREE account carries none at all — which is
             what the client reads as "nothing to cancel". */
          if (plan === 'paid' && !subscriptions.has(me.id)) {
            subscriptions.set(me.id, { status: 'active', currentPeriodEnd: monthFromNow() });
          }
          if (plan === 'free') subscriptions.delete(me.id);

          return json(res, 200, {
            plan,
            subscription: subscriptions.get(me.id) ?? null,
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
        /* ---- One replacement, of either kind (BACKEND.md §12) ----
           NOT BUILT IN PRODUCTION. What the stub reproduces is the shape the
           screens depend on: the REASON reaches the search and changes what
           comes back, a posting can be replaced as well as a course, the spend
           is refused with its numbers, and `null` is an honest answer. */
        if (url === '/api/recommendations/alternative' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '') as unknown as
            { subject?: string; itemId?: string; reason?: string | null; exclude?: string[] };

          const refusedAlt = tokenRefusal(me.id, TOKEN_PRICES.alternative);
          if (refusedAlt) return json(res, 429, refusedAlt);

          const excluded = new Set([...(f.exclude ?? []), f.itemId ?? '']);
          const rows = feedback.get(me.id) ?? [];

          if (f.subject === 'job') {
            const disliked = new Set(rows
              .filter((r) => r.subject === 'job' && r.verdict === 'dislike')
              .map((r) => r.itemId));
            const pool = jobs(locale)
              .filter((j) => !excluded.has(j.id) && !disliked.has(j.id));
            /* Nothing is invented: this is another REAL posting off the same
               list, or nothing at all. */
            if (!pool.length) return json(res, 200, null);
            spend(me.id, TOKEN_PRICES.alternative);
            return json(res, 200, pool[0]);
          }

          const all = [...courses(locale), ...alternateCourses(locale)];
          const rejected = all.find((c) => c.id === f.itemId);
          const wanted = new Set(rejected?.unlocks ?? []);
          const disliked = new Set(rows
            .filter((r) => r.subject === 'course' && r.verdict === 'dislike')
            .map((r) => r.itemId));
          let pool = all.filter((c) => !excluded.has(c.id) && !disliked.has(c.id));

          /* THE REASON CHANGES THE ANSWER, which is the whole point of asking
             it. Production's ranker will do something far better than this;
             what matters is that the field is USED, because a search that
             ignores it makes the panel's question decoration. */
          if (f.reason === 'price') pool = [...pool].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
          if (f.reason === 'tooLong') {
            pool = [...pool].sort((a, b) => (a.hoursMin ?? 1e9) - (b.hoursMin ?? 1e9));
          }

          const sameGap = pool.find((c) => c.unlocks.some((u) => wanted.has(u)));
          const answer = sameGap ?? pool[0] ?? null;
          if (answer) spend(me.id, TOKEN_PRICES.alternative);
          return json(res, 200, answer);
        }

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

          /* REFUSED BEFORE IT IS SPENT, and this was missing: the stub charged
             for every question and never once said no, so an account could run
             to 31 of a 30 token budget and the "you have none left" path could
             not be reached locally at all. That is why the chat screen had no
             message for it — the case was unreachable in development.

             Same code and same fields as every other door that spends, per
             BACKEND.md §11, so the front end has one sentence for one refusal
             wherever it happens. */
          const noTokens = tokenRefusal(me.id, TOKEN_PRICES.message);
          if (noTokens) return json(res, 429, noTokens);

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
        /* The update prompt's door. It maps onto the same three stages under
           the vocabulary of what CHANGED rather than what to run, and its POST
           is the confirmation — the person already answered a dialog. */
        if (url === '/api/update' && req.method === 'POST') {
          const sent = parseBody(await body(req), req.headers['content-type'] ?? '');
          const mode = { documents: 'full', skills: 'match' }[String(sent.scope ?? '')];
          if (!mode) return json(res, 400, { error: 'unknown_scope' });
          const price = RERUN_PRICES[mode];
          const refused = tokenRefusal(me.id, price);
          if (refused) return json(res, 429, refused);
          spend(me.id, price);
          return json(res, 200, {
            jobId: `job_update_${Date.now().toString(36)}`,
            mode, spent: price, awaitingConfirmation: mode === 'full',
          });
        }

        if (url === '/api/assistant/rerun' && req.method === 'POST') {
          const sent = parseBody(await body(req), req.headers['content-type'] ?? '');
          if (String(sent.confirm) !== 'true') {
            return json(res, 400, { error: 'confirmation_required' });
          }
          /* `token_limit`, not `rerun_limit_reached`: the same id production
             returns at BOTH doors, because one budget whichever door should
             mean one reason whichever door. `rerunCredits` stays only to gate
             whether the chat OFFERS the proposal. */
          /* EACH STAGE ITS OWN PRICE, matching production since 2026-08-29.
             The three are divisions of one measured re-read: Agent E alone, C
             and E, and all three. A stub that charged 19 for every one of them
             would make the cheap rung impossible to develop against — the whole
             visible difference between "look for new courses" and "re-read my
             CV" is what the meter does afterwards. */
          const mode = String(sent.mode ?? 'match');
          const price = RERUN_PRICES[mode];
          if (price === undefined) return json(res, 400, { error: 'unknown_mode' });
          const refused = tokenRefusal(me.id, price);
          if (refused) return json(res, 429, refused);
          rerunCredits = Math.max(0, rerunCredits - 1);
          spend(me.id, price);
          return json(res, 200, {
            jobId: `job_rerun_${Date.now().toString(36)}`,
            mode, spent: price,
            awaitingConfirmation: mode === 'full',
          });
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
          /* ONLY A CHANGED SKILL SET MAKES ANYTHING STALE. Saving a preference
             or a phone number changes nothing downstream, and offering to spend
             tokens after either would train people to dismiss the offer. */
          const before = JSON.stringify((prev as { skills?: string[] }).skills ?? []);
          const after = JSON.stringify(
            (edited as unknown as { skills?: string[] }).skills ?? [],
          );
          profiles.set(me.id, {
            ...prev,
            ...(edited as unknown as Record<string, unknown>),
            updatedAt: Date.now(),
          });
          if (before !== after) markStale(me.id, 'skills', 'skills_edited');
          return json(res, 200, { ok: true });
        }

        /* ---- Bringing the journey up to date (BACKEND.md §11) ----
           NOT BUILT IN PRODUCTION. The route exists here so the client's whole
           path is exercised: ask what is stale, show the price, get a yes, run
           the scope, poll it like any other run. */
        if (url === '/api/update' && req.method === 'GET') {
          const row = stale.get(me.id);
          const cost = row ? UPDATE_COST[row.scope] : 0;
          const remaining = Math.max(0, PLAN_TOKENS[planFor(me.id)] - (tokensUsed.get(me.id) ?? 0));
          return json(res, 200, {
            scope: row?.scope ?? null,
            reasons: row?.reasons ?? [],
            cost,
            remaining,
            /* THE SERVER ANSWERS THIS, not the browser. One place doing the
               arithmetic is one place that can be wrong about it. */
            affordable: cost > 0 && cost <= remaining,
            deferred: row?.deferred ?? false,
          });
        }

        if (url === '/api/update' && req.method === 'POST') {
          const row = stale.get(me.id);
          if (!row) return json(res, 409, { error: 'nothing_stale' });
          const cost = UPDATE_COST[row.scope];
          /* The refusal carries its numbers, so the screen can say "that costs
             19 and you have 8 left" rather than "that did not work". */
          const refused = tokenRefusal(me.id, cost);
          if (refused) return json(res, 429, refused);
          spend(me.id, cost);
          stale.delete(me.id);

          const jobId = `job_update_${Date.now().toString(36)}`;
          /* THE SCOPES ARE DIFFERENT JOBS, and this is where that is real.
             A `documents` run starts at the beginning and PAUSES at
             `awaiting_confirmation`, because the extraction changed and the
             person has to check it. A `skills` run is created already past that
             pause — `confirmedAt` set — so it goes straight to matching. It is
             not a fresh run: nobody changed an extraction, so there is nothing
             to re-read and nothing to confirm. Production has to preserve that
             distinction; BACKEND.md §11 says so in the contract's own words. */
          jobs_.set(jobId, {
            started: row.scope === 'documents' ? Date.now() : Date.now() - PHASE_ONE_MS,
            bad: false,
            confirmedAt: row.scope === 'documents' ? undefined : Date.now(),
          });
          /* The score moves, which is the point of having run it. */
          readinessGain.set(me.id, (readinessGain.get(me.id) ?? 0) + 6);
          return json(res, 200, { jobId });
        }

        /* ---- What they think of Itqan (BACKEND.md §13) ----
           NOT BUILT IN PRODUCTION. Stored per account so the stub can prove the
           one rule that matters to the client: a rating given is a rating that
           does not get asked for again. */
        if (url === '/api/feedback/rating' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '') as unknown as
            { stars?: number; comment?: string | null };
          const stars = Number(f.stars);
          if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            return json(res, 400, { error: 'invalid_input' });
          }
          ratings.set(me.id, { stars, comment: f.comment ?? null, at: Date.now() });
          return json(res, 204, undefined);
        }

        if (url === '/api/update/defer' && req.method === 'POST') {
          const row = stale.get(me.id);
          if (row) stale.set(me.id, { ...row, deferred: true });
          return json(res, 204, undefined);
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
