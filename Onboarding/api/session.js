/**
 * Reads the session, and is also where a handoff from the site is exchanged.
 *
 * Two jobs in one endpoint on purpose. The app boots, asks who it is talking
 * to, and — if it arrived from the site with `?t=` in the URL — hands that
 * token over in the same request. One round trip instead of two, and no
 * window in which the app is loaded but not yet signed in.
 *
 * The handoff token is verified with the shared secret, then immediately
 * replaced by a normal session cookie on THIS domain. From then on the token
 * in the URL is dead weight; the client strips it from the address bar.
 */
import {
  COOKIE, LOCALE_COOKIE, json, localeCookie, readCookies, sessionCookie, sign, verify,
} from './_lib/auth.js';

export default async function handler(req, res) {
  const cookies = readCookies(req.headers.cookie);

  // Arriving from the site: exchange the short-lived token for a session here.
  const url = new URL(req.url, 'https://placeholder.local');
  const handoff = url.searchParams.get('t');

  if (handoff) {
    const payload = verify(handoff);
    if (!payload) return json(res, 401, { error: 'bad_handoff' });

    const user = {
      id: payload.id,
      fullName: payload.fullName,
      email: payload.email,
      onboarded: !!payload.onboarded,
    };
    const locale = payload.locale === 'en' ? 'en' : 'ar';
    const token = sign(user);

    return json(res, 200, { token, user, locale }, [
      sessionCookie(token),
      localeCookie(locale),
    ]);
  }

  // Otherwise: an ordinary "am I still signed in" check.
  const session = verify(cookies[COOKIE]);
  if (!session) return json(res, 401, { error: 'no_session' });

  return json(res, 200, {
    token: cookies[COOKIE],
    user: {
      id: session.id,
      fullName: session.fullName,
      email: session.email,
      onboarded: !!session.onboarded,
    },
    locale: cookies[LOCALE_COOKIE] === 'en' ? 'en' : 'ar',
  });
}
