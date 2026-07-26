/**
 * Stateless auth shared by the two deployments. Zero dependencies: Node's
 * built-in crypto only, because adding a package to either project is what
 * broke the deploy before.
 *
 * WHY STATELESS. The site and the app are separate Vercel projects on separate
 * domains, and serverless functions keep nothing between invocations. There is
 * no database here, so the session cannot live on a server and a cookie set on
 * one domain cannot be read by the other.
 *
 * So the user travels *inside* a signed token. The site validates credentials,
 * mints a token carrying the user, and hands it to the app in a redirect URL;
 * the app verifies the signature and sets its own cookie on its own domain.
 * Neither side has to remember anything, and the token cannot be forged
 * without the shared secret.
 *
 * This file is duplicated verbatim in Onboarding/api/_lib/auth.js. Two Vercel
 * projects cannot import across their roots, and a shared package would mean
 * an install step. If you change one, change the other.
 *
 * Files under api/_lib are ignored by Vercel's function router (leading
 * underscore), so this is a library, not an endpoint.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Both projects must agree. Set ITQAN_AUTH_SECRET on BOTH Vercel projects to
 * harden this; the fallback keeps the demo working out of the box and is safe
 * only because every account and every record here is fake.
 */
const SECRET = process.env.ITQAN_AUTH_SECRET || 'itqan-dev-secret-change-me';

/** How long a session lasts, and how long a handoff token stays usable. */
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;   // seven days
const HANDOFF_MAX_AGE = 60 * 2;             // two minutes: it is used immediately

export const COOKIE = 'itqan_session';
export const LOCALE_COOKIE = 'itqan_locale';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const hmac = (data) => b64url(createHmac('sha256', SECRET).update(data).digest());

/** Signs a payload into `<body>.<signature>`. */
export function sign(payload, maxAgeSeconds = SESSION_MAX_AGE) {
  const body = b64url(JSON.stringify({ ...payload, exp: Date.now() + maxAgeSeconds * 1000 }));
  return `${body}.${hmac(body)}`;
}

/** Returns the payload, or null if the token is malformed, forged or expired. */
export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  // Constant-time compare so a signature cannot be guessed byte by byte.
  const expected = Buffer.from(hmac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(unb64url(body).toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const signHandoff = (payload) => sign(payload, HANDOFF_MAX_AGE);

/* ---------------------------------------------------------------- cookies -- */

export function readCookies(header = '') {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((c) => {
        const i = c.indexOf('=');
        return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
      })
      .filter(([k]) => k),
  );
}

/**
 * SameSite=Lax is deliberate: the session arrives via a top-level redirect
 * from the other domain, which Lax allows, and it keeps the cookie off
 * cross-site subrequests. None is not needed and would be worse.
 */
export const sessionCookie = (token) =>
  `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

export const clearSessionCookie = () =>
  `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/** Readable by the client so the app can open in the language the site used. */
export const localeCookie = (locale) =>
  `${LOCALE_COOKIE}=${locale === 'en' ? 'en' : 'ar'}; Path=/; Max-Age=${SESSION_MAX_AGE}; Secure; SameSite=Lax`;

/* ----------------------------------------------------------------- bodies -- */

export const readRaw = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.alloc(0)));
  });

/**
 * Parses urlencoded, multipart or JSON into a flat object. The site's forms
 * post FormData, so multipart is the case that actually matters.
 * File parts contribute metadata only — nothing here needs the bytes.
 */
export function parseBody(raw, contentType = '') {
  const type = String(contentType || '');

  if (type.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  }

  if (type.includes('multipart/form-data')) {
    const boundary = type.split('boundary=')[1]?.split(';')[0];
    if (!boundary) return {};
    const out = {};
    raw.toString('binary').split(`--${boundary}`).forEach((part) => {
      const name = /name="([^"]+)"/.exec(part);
      if (!name) return;
      const value = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
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

  try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; }
}

/* ---------------------------------------------------------------- replies -- */

export function json(res, status, body, cookies = []) {
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/* --------------------------------------------------------------- accounts -- */

/**
 * The seeded accounts. Passwords are in plain text because these are fake
 * demo logins with no real data behind them; a real backend hashes and this
 * array is replaced by a query.
 *
 * Anyone who signs up is NOT stored — there is nowhere to store them. Their
 * details ride in the signed token instead, which is enough for the demo and
 * cannot be forged.
 */
export const ACCOUNTS = [
  { id: 'u_maryam', fullName: 'Maryam Al Balushi', email: 'maryam@itqan.test', password: 'itqan1234', onboarded: false },
  { id: 'u_nasser', fullName: 'Nasser Al Hinai', email: 'nasser@itqan.test', password: 'itqan1234', onboarded: true },
];

export function findAccount(email, password) {
  const clean = String(email || '').trim().toLowerCase();
  return ACCOUNTS.find((a) => a.email === clean && a.password === String(password || '')) || null;
}

/** The locale is in the site's URL, so the referer says which one was used. */
export const localeFromReferer = (ref = '') => (/\/en(\/|$)/.test(String(ref || '')) ? 'en' : 'ar');
