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
 * This points at an endpoint on THIS origin, not at the app, because the app
 * is a separate deployment on a different domain and cannot read a cookie set
 * here. /api/handoff reads the session, signs a short-lived token, and
 * redirects to the app with it. The user sees one hop and stays signed in.
 */
export const appUrl = '/api/handoff';
