/**
 * The bridge between the two domains.
 *
 * The site and the app are separate Vercel projects, so a cookie set here is
 * unreadable there. The session therefore travels as a short-lived signed
 * token in the redirect URL, and the app swaps it for a cookie on its own
 * domain the moment it loads.
 *
 * This is why `appUrl` in src/config.ts points here rather than straight at
 * the app. The site's form script navigates to that URL after a successful
 * post, and it is same origin, so the session cookie is sent and can be read.
 * Nothing in the site's markup or scripts had to change.
 *
 * The token lasts two minutes and carries no secret of its own: it is the
 * user, signed. Losing it in a browser history entry costs nothing after it
 * has been exchanged, and it cannot be minted without the shared secret.
 */
import { COOKIE, LOCALE_COOKIE, readCookies, signHandoff, verify } from './_lib/auth.js';

/** Set ITQAN_APP_URL on the site project if the app moves to another domain. */
const APP_URL = (process.env.ITQAN_APP_URL || 'https://app-itqan.vercel.app').replace(/\/+$/, '');

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);
  const session = verify(cookies[COOKIE]);
  const locale = cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar';

  // No session, or an expired one: send them back to log in rather than to an
  // app that will only bounce them here again.
  if (!session) {
    res.statusCode = 302;
    res.setHeader('Location', `/${locale}/login/`);
    res.setHeader('Cache-Control', 'no-store');
    return res.end();
  }

  const token = signHandoff({
    id: session.id,
    fullName: session.fullName,
    email: session.email,
    onboarded: session.onboarded,
    locale,
  });

  res.statusCode = 302;
  res.setHeader('Location', `${APP_URL}/?t=${encodeURIComponent(token)}`);
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
}
