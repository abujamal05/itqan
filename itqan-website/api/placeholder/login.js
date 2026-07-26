/**
 * The endpoint the site's login form already posts to.
 *
 * The contract is the site's, not a new one. itqan-website/src/scripts/form.ts
 * does `fetch(form.action, {method:'POST', body:FormData})` and, on any ok
 * response, navigates to `data-success-url`. So a 200 is the entire success
 * signal and a non-2xx makes the form show its own "could not log you in"
 * message. Nothing about the site had to change to make this work.
 *
 * Same origin as the form, so the cookie it sets is stored normally.
 */
import {
  findAccount, json, localeCookie, localeFromReferer, parseBody, readRaw, sessionCookie, sign,
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const form = parseBody(await readRaw(req), req.headers['content-type']);
  const account = findAccount(form.email, form.password);

  // 401 and nothing else: the site renders its own message, so a body here
  // would be an error string it has no code to read.
  if (!account) return json(res, 401, { error: 'invalid_credentials' });

  const token = sign({
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    onboarded: account.onboarded,
  });

  return json(res, 200, { ok: true }, [
    sessionCookie(token),
    localeCookie(localeFromReferer(req.headers.referer)),
  ]);
}
