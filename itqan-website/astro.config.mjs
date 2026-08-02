// @ts-check
import { defineConfig } from 'astro/config';

// `site` is the ONE source of the deployed origin — Astro derives canonical
// URLs, hreflang alternates and the sitemap from it, and it is exposed to the
// rest of the build as `import.meta.env.SITE`. It is baked in at build time and
// cannot be read at serve time, which is why the deploy workflow passes it as a
// build env var (ITQAN_SITE_URL) rather than the app reading it at runtime.
// Unset (local builds) it falls back to the placeholder.
export default defineConfig({
  output: 'static',
  site: process.env.ITQAN_SITE_URL || 'https://itqan.example',
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
