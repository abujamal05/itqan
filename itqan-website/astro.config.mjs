// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

// `site` is the ONE source of the deployed origin — Astro derives canonical
// URLs, hreflang alternates and the sitemap from it, and it is exposed to the
// rest of the build as `import.meta.env.SITE`. It is baked in at build time and
// cannot be read at serve time, which is why the deploy workflow passes it as a
// build env var (ITQAN_SITE_URL) rather than the app reading it at runtime.
// Unset (local builds) it falls back to the placeholder.
export default defineConfig({
  output: 'static',
  /**
   * Phosphor, via Iconify, inlined as SVG at build time.
   *
   * The site used to hand-draw 54 icons at three different stroke weights,
   * which is a large part of why it read as a document rather than a product.
   * Phosphor is chosen over Lucide (which the app uses) for one reason: its
   * `duotone` weight lets an icon carry navy AND gold, so the iconography uses
   * the brand palette instead of being a single grey stroke. Both are 24px
   * geometric sets, so the two halves still agree.
   *
   * `include` is an allowlist, not a convenience: without it the whole 9,161
   * icon set is a build dependency. Every icon the site uses is named here.
   */
  integrations: [
    icon({
      include: {
        /* Exactly the icons the source uses, nothing speculative. Regenerate
           after adding one, or the build fails on the missing name (which is
           the allowlist working, not a bug):

             node -e "const s=require('@iconify-json/ph/icons.json'),fs=require('fs'),p=require('path');const f=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const q=p.join(d,e.name);e.isDirectory()?w(q):/\.(astro|ts)$/.test(e.name)&&f.push(q)}})('src');const u=new Set();for(const x of f)for(const m of fs.readFileSync(x,'utf8').matchAll(/['\"`]ph:([a-z0-9-]+)['\"`]/g))u.add(m[1]);console.log(JSON.stringify([...u].sort()))"
        */
        ph: [
          'arrow-right', 'briefcase-duotone', 'caret-down', 'chart-bar-duotone', 'chat-circle-dots',
          'check', 'clipboard', 'eye', 'eye-slash', 'file-text-duotone', 'info',
          'linkedin-logo', 'list', 'map-pin', 'minus', 'moon', 'mouse-scroll',
          'path-duotone', 'plus',
          'question', 'seal-check-duotone', 'shield-check-duotone', 'sun',
          'target-duotone', 'warning', 'warning-circle', 'warning-duotone', 'x',
        ],
      },
    }),
  ],
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
