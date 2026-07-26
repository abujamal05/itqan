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
 * Where a successful sign up or log in lands. The product app is served from
 * /app on this same origin, so the session cookie set by the endpoints above
 * is readable there and the user never leaves the product.
 */
export const appUrl = '/app/';
