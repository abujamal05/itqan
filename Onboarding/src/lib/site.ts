/**
 * Where the marketing site lives, from this app's point of view.
 *
 * There are three environments and the difference is real, not incidental:
 *
 *   dev             one origin. The Vite plugin serves the site at / and this
 *                   app under /app/, so a plain path is correct.
 *   VPS (PRODUCTION) tryitqan.com, one Caddy serving the site, /app/* and
 *                   /api/* together. Plain paths are correct, and better,
 *                   because they carry no baked-in domain to go stale.
 *   Vercel (test)   two projects on two domains, so a link to the site has to
 *                   be absolute or it 404s there.
 *
 * **Vercel is a testing target, not production.** An earlier version of this
 * comment had it the other way round, which mattered because it made the
 * two-origin branch look like the one that ships.
 *
 * The single-host case is opt-in via VITE_SITE_SAME_ORIGIN=1 rather than
 * inferred, and `.github/workflows/deploy.yml` sets it — so the production
 * build takes the relative-path branch. Leave the default alone: on Vercel,
 * getting it wrong sends every "home"/"log in" link to a silent 404. Set
 * VITE_SITE_URL to move the site on a two-origin setup.
 */
const CONFIGURED = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '');

/** True when the site and this app share one origin (dev, or a single-host VPS). */
const SAME_ORIGIN = !import.meta.env.PROD
  || import.meta.env.VITE_SITE_SAME_ORIGIN === '1';

/** Empty when same-origin, so links stay relative; absolute only across domains. */
export const SITE_ORIGIN = SAME_ORIGIN
  ? ''
  : (CONFIGURED || 'https://itqan-site.vercel.app');

export const siteHome = (locale: string) => `${SITE_ORIGIN}/${locale}/`;
export const siteLogin = (locale: string) => `${SITE_ORIGIN}/${locale}/login/`;
/** Where an account that has not proved its address belongs. The site owns the
 *  auth screens, so this is a full navigation like `siteLogin`, not a route. */
export const siteVerify = (locale: string) => `${SITE_ORIGIN}/${locale}/verify-email/`;

/**
 * The handoff token the site puts in the URL after a successful sign in.
 * Read once, then removed from the address bar so a reload or a shared link
 * cannot replay it.
 */
export function takeHandoffToken(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get('t');
  if (!token) return null;
  url.searchParams.delete('t');
  window.history.replaceState({}, '', url.toString());
  return token;
}
