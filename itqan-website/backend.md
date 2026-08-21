# backend.md — what this site would need from the backend, and does not have

Scope: the **marketing site only**. The full contract for both front ends is
[`../BACKEND.md`](../BACKEND.md); this file exists so that design work which
*wants* a backend never quietly invents one, per the working rule that a feature
needing new connectivity gets written down rather than forced.

## Status of the current pass

**No new backend connectivity was added or required.** Everything in the motion,
layout and `/proof` rebuild is static or build time. The three integration points
the site already has are untouched and verified by the Playwright suite:

| Integration | Where | State |
|---|---|---|
| Sign up / log in POST | `src/config.ts` → `/api/auth/*` | unchanged |
| Session handoff to the app | `src/config.ts` → `/api/handoff` | unchanged |
| Locale cookie handover | `src/layouts/Base.astro` inline script | unchanged |

## Open items that WOULD need a backend

### 1. Real evidence on `/proof`

`/proof` is currently built on **screenshots of the running app**, captured by
`Onboarding/scripts/capture-app-shots.mjs` against seeded dev accounts. That is
honest — it is the real UI doing the real thing — but it is not outcome
evidence, and the page can never claim more than "this is the mechanism".

To claim more, one of these has to exist:

- **A published accuracy figure.** Blocked upstream, not here: `PRODUCT.md`
  requires measurement across 20 to 30 real transcripts first, and none has been
  done. No endpoint is needed until there is a number.
- **Anonymised real cases.** Would need something like
  `GET /api/public/cases` returning a small, hand-approved set of
  `{ role, held[], missing[], why[], sourceUrl, retrievedAt }`. It must be a
  curated table rather than a live query over user data: consent is per person,
  and the marketing site is unauthenticated.
- **Pilot numbers from UTAS.** Static content, so it needs no endpoint. It needs
  a source and a date, which is a content task rather than an engineering one.

**Suggested implementation if cases are wanted:** a build-time fetch, not a
runtime one. The site is static output; a curated JSON file committed to the repo
(or pulled at build from a private endpoint with a token in CI) keeps the public
site with zero runtime API surface, which is also what keeps it deployable to a
CDN with no origin.

### 2. The Hud chat answers are hard coded

`src/components/HudChat.astro` ships four pre-written answers with keyword
matching. It is deliberately not an AI surface on the marketing site, and it says
so to the user. If it should become one, it needs a public, rate limited,
unauthenticated endpoint that cannot leak anything about a real account, which
is a different security posture from every route in `../BACKEND.md`. Do not wire
it to the authenticated chat endpoint.

### 3. Nothing else

The survey figures on `/about` are static copy. The team list is a literal in
`AboutPage.astro`. The product screenshots are files in `public/app/`. None of
these should become dynamic without a reason that is not "it could be".
