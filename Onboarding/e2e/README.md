# End-to-end tests

Cross-browser Playwright tests for **both** halves of Itqan, run against the
same one-origin dev server the product uses locally: the Onboarding vite server
serves the built marketing site at `/`, this app under `/app/`, and every
`/api/` endpoint. One `baseURL` therefore exercises the site pages, the auth
handoff and the app flow together.

## Running

```bash
# from Onboarding/
npm run test:e2e            # all engines, all specs
npm run test:e2e:chromium   # one engine, fast
npm run test:e2e:webkit     # the engine the iOS bugs live in
npm run test:e2e:ui         # interactive UI mode
npm run test:e2e:report     # open the last HTML report
```

`playwright.config.ts` starts the server for you (`e2e:serve`, which builds the
site first because the plugin serves its `dist/`) and reuses an already-running
dev server when there is one. No manual setup.

Browser binaries install with `npx playwright install chromium firefox webkit`.

## Engines

`chromium`, `firefox`, `webkit`, plus `mobile-chrome` (Pixel 5) and
`mobile-safari` (iPhone 13). WebKit is not optional — the mascot and glow bugs
this suite guards are WebKit-only, and `mobile-safari` is the real iPhone
engine.

**Firefox** stays a first-class target but is auto-skipped when its binary
cannot launch (some locked-down Windows sandboxes report `spawn UNKNOWN` while
Chromium and WebKit run fine). Set `E2E_FORCE_FIREFOX=1` to require it — do this
in CI, where it should always launch.

## What each spec covers

| Spec | Guards |
|---|---|
| `site.spec.ts` | Every public page renders in both languages with the right `dir`; the language switch crosses route trees; unknown paths 404. |
| `responsive.spec.ts` | No horizontal scroll on any page, site or app, across 320–1440px in both directions — the machine-checkable core of the responsiveness work. |
| `mascot.spec.ts` | The mascot falls back to a still PNG on WebKit (keyed off the real `navigator.vendor`) and stays video elsewhere; the poster keeps the artwork's aspect ratio; the hero glow animates both layers on a 5s swing, mirrors in Arabic, and swaps movement for a fade under reduced motion. |
| `onboarding.spec.ts` | The onboarded dashboard greets by name; the app root redirects correctly; and — the regression that started this — reloading a later onboarding step OFFERS to resume instead of dead-ending. |

## Notes for anyone extending this

- **Log in with `login(page, email, locale)`** from `helpers.ts`. It posts the
  site's own login endpoint; in dev that's one origin, so the session cookie is
  read straight back with no handoff. Language rides on the request's referer,
  because the app adopts the session's locale over localStorage on boot — set
  localStorage instead and it will not stick.
- **Onboarding progress is server-side, keyed by account, shared across every
  browser context.** The fresh-account flow is therefore `serial` and gated to a
  single engine; do the same for any new test that mutates a shared account, or
  parallel runs will clobber each other's progress.
- Artifacts (`test-results/`, `playwright-report/`) are gitignored.
