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
import { courses, dashboard, jobs, pipelineResult } from './data.js';
import type { Locale } from './data.js';

const SITE_DIST = path.resolve(__dirname, '../../itqan-website/dist');
const COOKIE = 'itqan_session';
const LOCALE_COOKIE = 'itqan_locale';

/* ------------------------------------------------------------- accounts -- */

interface Account { id: string; fullName: string; email: string; password: string; onboarded: boolean }

/**
 * Seeded test accounts live HERE, on the server side, and are never rendered
 * into any page. Credentials belong in the project's notes, not in the UI.
 */
const accounts: Account[] = [
  { id: 'u_maryam', fullName: 'Maryam Al Balushi', email: 'maryam@itqan.test', password: 'itqan1234', onboarded: false },
  { id: 'u_nasser', fullName: 'Nasser Al Hinai', email: 'nasser@itqan.test', password: 'itqan1234', onboarded: true },
];

/** Progress and profile per account, so a reload does not restart onboarding. */
const progress = new Map<string, unknown>();

/** How long the fake pipeline takes end to end. */
const PIPELINE_MS = 7000;
/** Document ids the pipeline will refuse, so the failure path is reachable. */
const unreadable = new Set<string>();

/** Strips the password before anything leaves the server. */
const publicUser = ({ password: _password, ...u }: Account) => u;

const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms); });

/**
 * The CSRF cookie is deliberately NOT httpOnly — the client has to read it to
 * echo it back in X-CSRF-Token (double submit). Production does the same; see
 * BACKEND_INTEGRATION.md §2.
 */
const csrfCookie = () => `csrf_token=dev-csrf; Path=/; SameSite=Lax`;
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

export function itqanSite(): Plugin {
  return {
    name: 'itqan-site',
    configureServer(server) {
      /* ---- the endpoints the site's forms already post to ---- */
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith('/api/')) return next();

        const cookies = readCookies(req.headers.cookie);
        const setLocale = `${LOCALE_COOKIE}=${localeFromReferer(req.headers.referer)}; Path=/; SameSite=Lax`;

        // Sign up: the site posts name, email, password, consent.
        if (url === '/api/placeholder/signup' && req.method === 'POST') {
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
          };
          accounts.push(account);
          return json(res, 200, { ok: true }, [
            `${COOKIE}=${tokenFor(account.id)}; Path=/; SameSite=Lax`,
            csrfCookie(),
            setLocale,
          ]);
        }

        // Log in: the site posts email, password.
        if (url === '/api/placeholder/login' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const hit = accounts.find(
            (a) => a.email === (f.email ?? '').trim().toLowerCase() && a.password === f.password,
          );
          // The site shows its own "could not log you in" message on any
          // non-ok response, so 401 needs no body it would have to understand.
          if (!hit) return json(res, 401, { error: 'invalid_credentials' });
          return json(res, 200, { ok: true }, [
            `${COOKIE}=${tokenFor(hit.id)}; Path=/; SameSite=Lax`,
            csrfCookie(),
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

        // Paths match BACKEND_INTEGRATION.md exactly. They live under /auth
        // because that is what FastAPI will serve; if these two drift apart,
        // local dev passes and production 401s on every request.
        if (url === '/api/auth/session') {
          if (!me) return json(res, 401, { code: 'no_session', message: 'Not signed in' });
          return json(res, 200, {
            token,
            user: publicUser(me),
            locale: cookies[LOCALE_COOKIE] ?? 'ar',
          });
        }

        /**
         * Refresh. There is no real token rotation here — dev sessions do not
         * expire — but the ENDPOINT has to exist and answer 200/401 correctly,
         * because the client's single-flight refresh runs against it on every
         * 401 and its absence would look like a dead session.
         */
        if (url === '/api/auth/refresh' && req.method === 'POST') {
          if (!me) return json(res, 401, { code: 'no_session', message: 'Not signed in' });
          return json(res, 200, { ok: true }, [csrfCookie()]);
        }

        if (url === '/api/auth/logout' && req.method === 'POST') {
          return json(res, 200, { ok: true }, [
            `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
            `csrf_token=; Path=/; Max-Age=0; SameSite=Lax`,
          ]);
        }

        if (!me) return json(res, 401, { error: 'no_session' });

        /* ---- the agent services ---- */
        const locale = (cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar') as Locale;

        if (url === '/api/documents' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          const fileName = f.__filename ?? 'document.pdf';
          // Any file named "unreadable" fails the pipeline, so the recovery
          // path is reachable without breaking a real file.
          if (/unreadable/i.test(fileName)) unreadable.add(id);
          return json(res, 200, {
            id, fileName, mimeType: f.__mimetype ?? 'application/pdf',
            sizeBytes: Number(f.__size ?? 0), kind: f.kind ?? 'other',
          });
        }

        /**
         * The synchronous pipeline, matching the production contract: one POST
         * that holds open for the whole A -> C -> E run and returns every
         * envelope at once. The delay is deliberately real so the questions
         * screen is exercised the way a user will meet it.
         */
        if (url === '/api/analysis' && req.method === 'POST') {
          const f = parseBody(await body(req), req.headers['content-type'] ?? '');
          const ids: string[] = Array.isArray((f as never as { document_ids: string[] }).document_ids)
            ? (f as never as { document_ids: string[] }).document_ids : [];

          if (ids.some((d) => unreadable.has(d))) {
            await sleep(1200);
            return json(res, 422, {
              code: 'agent_a_unreadable_document',
              message: 'The documents could not be read.',
            });
          }

          await sleep(PIPELINE_MS);
          return json(res, 200, pipelineResult(locale));
        }

        if (url === '/api/dashboard') return json(res, 200, dashboard(locale));
        if (url === '/api/jobs') return json(res, 200, jobs(locale));
        if (url === '/api/courses') return json(res, 200, courses(locale));

        if (url === '/api/onboarding/progress') {
          if (req.method === 'PUT') {
            progress.set(me.id, parseBody(await body(req), req.headers['content-type'] ?? ''));
            return json(res, 200, { ok: true });
          }
          if (req.method === 'DELETE') { progress.delete(me.id); return json(res, 200, { ok: true }); }
          return json(res, 200, progress.get(me.id) ?? null);
        }

        // Marks onboarding done on the ACCOUNT, so returning on another device
        // does not restart it.
        if (url === '/api/profile' && req.method === 'POST') {
          await body(req);
          me.onboarded = true;
          progress.delete(me.id);
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
