/**
 * Single place to point the forms at the real API later.
 * Both endpoints are placeholders; no backend exists yet.
 */
export const formEndpoints = {
  signup: '/api/placeholder/signup',
  login: '/api/placeholder/login',
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
