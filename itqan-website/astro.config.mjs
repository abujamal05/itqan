// @ts-check
import { defineConfig } from 'astro/config';

// Site URL is a placeholder until the real domain is decided. See PLACEHOLDERS.md.
export default defineConfig({
  output: 'static',
  site: 'https://itqan.example',
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
