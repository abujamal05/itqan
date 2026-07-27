/**
 * The endpoint the site's signup form already posts to. Same 200-or-not
 * contract as login.
 *
 * There is no database, so a new account is not written anywhere. Instead the
 * submitted name and email are carried in the signed token itself, which is
 * enough for the account to work for the length of the session and cannot be
 * forged. The one thing that must still behave correctly is the duplicate
 * check against the seeded accounts, so signing up as one of them fails
 * rather than silently shadowing a real login.
 */
import {
  ACCOUNTS, json, localeCookie, localeFromReferer, parseBody, readRaw, sessionCookie, sign,
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const form = parseBody(await readRaw(req), req.headers['content-type']);
  const email = String(form.email || '').trim().toLowerCase();
  const fullName = String(form.name || '').trim();
  const password = String(form.password || '');

  // The site validates all of this client side too; this is the backstop for
  // anything that reaches the endpoint directly. Client-side validation is a
  // courtesy to the user, never a control — the rule has to hold here as well.
  const strongEnough = password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);

  if (!fullName || !email || !strongEnough) {
    return json(res, 400, { error: 'invalid_input' });
  }
  if (ACCOUNTS.some((a) => a.email === email)) {
    return json(res, 409, { error: 'email_taken' });
  }

  const token = sign({
    id: `u_${Buffer.from(email).toString('hex').slice(0, 12)}`,
    fullName,
    email,
    onboarded: false,          // a new account always goes through onboarding
  });

  return json(res, 200, { ok: true }, [
    sessionCookie(token),
    localeCookie(localeFromReferer(req.headers.referer)),
  ]);
}
