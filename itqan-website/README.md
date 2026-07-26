# Itqan marketing website

Public marketing site for Itqan. Astro, TypeScript, static output, no client framework.
Arabic is the default language and the default design direction; English is co-equal.
Light and dark themes, both from the design tokens.

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

## Dropping in the mascot files

The Hud component arrives in phase 5. Its contract: place files at `public/mascot/{pose}.webm` and
`public/mascot/{pose}.png` for the poses `flying-in`, `idle`, `waving`, `thinking`, `analyzing`,
`error`. The component uses them automatically when present and shows a labelled placeholder when not.
No page code changes needed.

## Pages

| Route (per locale) | What it is |
|---|---|
| `/` | Home: hero, problem cards, three steps, worked example, audiences, FAQ, closing CTA |
| `/how-it-works/` | The four steps, confirmation step highlighted, no accuracy claims |
| `/proof/` | Full worked example, match justification, honest limits. No mascot, by rule |
| `/signup/` `/login/` | Forms only, validated client side, posting to the placeholder endpoints |
| `/forgot-password/` | Stub |
| `/privacy/` | Structured headings with lawyer placeholders |
| `/terms/` | Draft stub with a visible notice |
| `/404` | Bilingual, stays in the visitor's language |

## Build status

All pages are built in both locales, verified in both directions, both themes, and at mobile and
desktop widths. Client JavaScript is about 1KB compressed plus small inline scripts. Remaining work
is assets and legal text, all listed in `PLACEHOLDERS.md`.
