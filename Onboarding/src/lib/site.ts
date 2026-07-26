/**
 * Where the marketing site lives, from this app's point of view.
 *
 * The two differ by environment and that difference is real, not incidental:
 *
 *   dev         one origin. The Vite plugin serves the site at / and this app
 *               under /app/, so a plain path is correct.
 *   production  two Vercel projects on two domains, so anything pointing at
 *               the site has to be absolute or it lands on a 404 here.
 *
 * Set VITE_SITE_URL on the app project if the site moves.
 */
const CONFIGURED = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '');

/** Empty in dev, so links stay same-origin relative paths. */
export const SITE_ORIGIN = import.meta.env.PROD
  ? (CONFIGURED || 'https://itqan-site.vercel.app')
  : '';

export const siteHome = (locale: string) => `${SITE_ORIGIN}/${locale}/`;
export const siteLogin = (locale: string) => `${SITE_ORIGIN}/${locale}/login/`;

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
