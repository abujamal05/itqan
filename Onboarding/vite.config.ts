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
/**
 * Which backend answers /api in dev.
 *
 *   unset             the stub in dev/site-plugin.ts — no services needed
 *   ITQAN_API=<url>   proxy /api to the real FastAPI, e.g. http://127.0.0.1:8000
 *
 * A PROXY, not VITE_API_BASE_URL, and the distinction is load-bearing:
 * src/api/http.ts sends `credentials: 'same-origin'`, so pointing the base URL
 * at another port makes the browser silently withhold the session cookie and
 * every authenticated call 401s. Proxying keeps ONE origin, which is the whole
 * premise of the site-owns-login design above.
 *
 * The plugin still runs either way — it also serves the built marketing site at
 * `/`, which is where log in and sign up live. It just yields /api when a real
 * backend is configured, so only one thing ever answers it.
 */
const API_TARGET = process.env.ITQAN_API;

export default defineConfig(({ command }) => ({
  /**
   * Where this app is mounted, which decides both the asset URLs and the router
   * basename (`import.meta.env.BASE_URL`).
   *
   *   dev            /app/   — the plugin serves the site at / and this under /app/
   *   Vercel (prod)  /       — the app is its own origin and owns the root
   *   VPS (prod)     /app/   — one Caddy serves the site at / and this at /app/
   *
   * The two production targets genuinely differ, so the base is an env override
   * rather than a constant: the VPS deploy builds with VITE_APP_BASE=/app/, and
   * anything unset keeps the Vercel-correct root. Getting this wrong is silent —
   * every asset 404s and the page renders blank — so it is driven from the one
   * place that knows the target: the deploy workflow.
   */
  base: command === 'serve' ? '/app/' : (process.env.VITE_APP_BASE || '/'),
  plugins: [react(), itqanSite({ apiTarget: API_TARGET })],
  server: API_TARGET
    ? { proxy: { '/api': { target: API_TARGET, changeOrigin: false } } }
    : undefined,
}));
