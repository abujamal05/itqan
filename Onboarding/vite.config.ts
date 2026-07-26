import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { itqanSite } from './dev/site-plugin.js';

/**
 * The marketing site and this app are ONE origin.
 *
 * That is the whole point: the site owns log in and sign up, and a session
 * established there has to be readable here. Two origins would mean two
 * sessions, a CORS dance, and a redirect that reads as leaving the product.
 *
 *   /            -> the built marketing site, served untouched
 *   /ar/… /en/…  -> the site's own pages, including its login and signup
 *   /api/…       -> the endpoints the site's forms already POST to
 *   /app/…       -> this React app
 *
 * `base` is /app/ so the site keeps the root, which is where its links,
 * canonical URLs and hreflang tags already point.
 */
export default defineConfig(({ command }) => ({
  /**
   * Dev serves the site at / and this app under /app/ on one origin, so the
   * app needs that prefix. In production the app is its own Vercel project on
   * its own domain and owns the root — keeping /app/ there is what made every
   * asset 404 and the page render blank.
   */
  base: command === 'serve' ? '/app/' : '/',
  plugins: [react(), itqanSite()],
}));
