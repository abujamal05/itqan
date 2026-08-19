# Itqan marketing website

Public marketing site for **Itqan**, a career navigator for job seekers and job switchers in Oman and
the Gulf. It sells four answers, in order: where you stand, which role to aim for, the shortest path
there, and the jobs you can apply to now. Its one job is a free account.

Astro, TypeScript, static output, no client framework. Arabic is the default language and the default
design direction; English is co-equal. Light and dark themes, both from the design tokens.

**[`CLAUDE.md`](CLAUDE.md) holds the locked rules, the audit gate and the skill routing. Read it before
changing anything.**

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve the built output
```

## Where things live

| Thing | Place |
|---|---|
| Every colour, size, spacing, radius, duration | `src/styles/tokens.css` — never write a raw value anywhere else |
| Base styles, fonts, buttons, utilities | `src/styles/global.css` |
| All copy, per locale | `src/i18n/ar.json` and `src/i18n/en.json` |
| Form endpoints and site URL | `src/config.ts` |
| Page shell (head, header, footer, skip link) | `src/layouts/Base.astro` |
| Pages | `src/pages/ar/...` and `src/pages/en/...` |
| Logo exports | `public/logos/` |
| Fonts (self hosted Rubik, Arabic and Latin subsets) | `public/fonts/` |

## Editing copy

All user facing words live in `src/i18n/ar.json` and `src/i18n/en.json`. Arabic and English are both
authored, never machine translated. Follow the brand voice rules: no hype vocabulary, no hyphens or
dashes in prose, lead with capability, never promise a job.

## Language and theme

- `/` redirects to `/ar/` unless the visitor chose English before (stored in `localStorage` as `itqan-lang`).
- The theme follows the OS setting until the visitor uses the toggle (stored as `itqan-theme`).
- The logo swaps to the reversed version in dark mode. This is a brand rule, not a preference.

## Pages

| Route (per locale) | What it is |
|---|---|
| `/` | Home: hero, problem cards, three steps, worked example, audiences, FAQ, closing CTA |
| `/how-it-works/` | The four steps, confirmation step highlighted, no accuracy claims |
| `/proof/` | Full worked example, match justification, honest limits. No mascot, by rule |
| `/signup/` `/login/` | Forms only, validated client side, posting to the placeholder endpoints |
| `/forgot-password/` | Stub |
| `/privacy/` | Under construction. The lawyer's question list stays in the locale files |
| `/terms/` | Under construction |
| `/404` | Bilingual, stays in the visitor's language |

## Status

All pages build in both locales and are verified in both directions, both themes, and at mobile and
desktop widths. Inlined JS is measured in `CLAUDE.md` rather than estimated here. Remaining work is
assets and legal text, listed in `PLACEHOLDERS.md`.

**The Arabic copy is a version behind the English.** The English pages were repositioned in August 2026
and the Arabic was left deliberately; it still sells the retired framing. Arabic is the default locale,
so this is the next content job.
