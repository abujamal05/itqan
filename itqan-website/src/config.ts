/**
 * Single place to point the forms at the real API later.
 * Both endpoints are placeholders; no backend exists yet.
 */
export const formEndpoints = {
  signup: '/api/placeholder/signup',
  login: '/api/placeholder/login',
} as const;

/** Placeholder until the real domain is decided. Also set in astro.config.mjs. */
export const siteUrl = 'https://itqan.example';

/**
 * Where a successful sign up or log in lands.
 *
 * This points at an endpoint on THIS origin, not at the app, because the app
 * is a separate deployment on a different domain and cannot read a cookie set
 * here. /api/handoff reads the session, signs a short-lived token, and
 * redirects to the app with it. The user sees one hop and stays signed in.
 */
export const appUrl = '/api/handoff';
