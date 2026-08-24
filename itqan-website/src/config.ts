/**
 * Where the sign up and log in forms post.
 *
 * These were `/api/placeholder/*` — the word "placeholder" in a production URL,
 * from when no backend existed. The API now serves `/api/auth/*` and keeps the
 * old paths as aliases, because this site is static: the HTML on the box posts
 * to whatever path it was BUILT with, and it deploys from a different repo by a
 * different job than the API does. Until this build is live, older HTML is still
 * posting to the old paths.
 *
 * The aliases can be removed from the API once this has shipped and the old
 * paths show no traffic.
 */
export const formEndpoints = {
  signup: '/api/auth/signup',
  login: '/api/auth/login',
} as const;

/**
 * The deployed origin. Single-sourced from astro.config's `site` (Astro exposes
 * it as `import.meta.env.SITE`), so it can never drift from what canonical URLs
 * and hreflang use. Set it via the ITQAN_SITE_URL build env, not here.
 */
export const siteUrl = import.meta.env.SITE ?? 'https://itqan.example';

/**
 * Where a successful sign up or log in lands.
 *
 * This points at an endpoint on THIS origin rather than straight at the app.
 *
 * The reason used to be that the app was a separate deployment on a different
 * domain and could not read a cookie set here. **That is no longer true.**
 * Since the move to a single box, Caddy serves the site, `/app/*` and `/api/*`
 * from one origin, which is why `credentials: 'same-origin'` works and why no
 * CORS is configured anywhere. Confirmed with the API team, 2026-08-24.
 *
 * The hop stays regardless, because it does a second job: /api/handoff reads
 * the session, signs a short-lived token and redirects with it, which is what
 * lets the app come up already signed in instead of racing the cookie. Do not
 * "simplify" it away on the grounds that the domains now match.
 */
export const appUrl = '/api/handoff';
