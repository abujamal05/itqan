# Placeholders and pending assets

Everything on this list is either a placeholder in the code or an asset that does not exist yet.
Nothing here should ship as is.

## Mascot animations — DONE

Every pose ships. `public/mascot/` holds `flying-in`, `idle`, `waving`, `thinking`, `analyzing`,
`celebrating` and `error`, each as `.webm` plus a poster `.png`. This section listed all of them as
missing long after they landed.

Two things about them are still live constraints rather than gaps:

- **The artwork's eyes are holes in the alpha channel.** Whatever is behind Hud shows through them, so
  `Hud.astro` floods them with a double paper drop-shadow. The real fix is re-exporting with opaque eyes.
- **WebM alpha does not work in WebKit**, so iOS and Safari need the HEVC companion. Both ship; the
  contract is in `Hud.astro`.

## Assets that need a designer

| What | Where it is used | Required | Owner |
|---|---|---|---|
| Vector (SVG) masters of every lockup | All logo slots sitewide | SVG, exact brand colours | Brand designer |
| Reversed monochrome lockup, wordmark and icon | Dark mode header, footer, 404 | Paper on transparent | Brand designer. **Interim:** mechanically derived paper silhouettes from the transparent PNGs live in `public/logos/*-reversed.webp`. The bird loses its eye and beak counterforms when flattened. Approve or replace before launch. |
| Arabic only and Latin only lockups | Not yet used | Per brand programme | Brand designer |
| Simplified icon below 32px | The 16px favicon slice | Per brand programme | Brand designer. Interim: `favicon.ico` was generated from the full icon; at 16px it is dense. |
| Open graph and social share images | `og:image` on every page (currently omitted) | 1200 x 630, per locale | Team |
| Illustration: sharing the record | How it works, step 1 | About 640 x 480 | Team |
| Illustration: the plan for closing gaps | How it works, step 4 | About 640 x 480 | Team |
| Photographs of people | Home and proof pages, if wanted | TBD | Team |

## Values that are placeholders in code

| What | File | Current value |
|---|---|---|
| Site domain | `astro.config.mjs` and `src/config.ts` | `https://itqan.example` |
| ~~Sign up form endpoint~~ | `src/config.ts` | **Resolved.** `/api/auth/signup`, live |
| ~~Log in form endpoint~~ | `src/config.ts` | **Resolved.** `/api/auth/login`, live |
| ~~Post sign up destination~~ | `src/config.ts` (`appUrl`) | **Resolved.** `/api/handoff` on this origin |
| Password minimum length | Sign up form | 8 characters, an assumed product rule |

## Legal text — written, and now awaiting review rather than authoring

- **`/privacy` is complete**, fourteen sections, effective 24 August 2026, in both locales.
- **`/terms` is complete**, eighteen sections, same date, both locales.
- Written 2026-08-24 on the lead's instruction, to be **reviewed and amended by a lawyer** rather than
  drafted by one. They are published text and neither page calls itself a draft.
- `s.privacy.brief` stays in the locale files, unrendered, as the issue list for that review.
  [`../LEGAL-BRIEF.md`](../LEGAL-BRIEF.md) is the fuller version and records what is still open.
- ~~The forgot password page is a stub~~ — **resolved**, `/api/auth/forgot-password` and
  `reset-password` are live.

### Three things in that text that must become true, or must change

Each is stated in the published policy, so each is now a promise rather than an intention:

| Stated | Reality today | Owner |
|---|---|---|
| `privacy@tryitqan.com` and `support@tryitqan.com` reach a person | **Mailboxes do not exist yet.** Create them before launch. | Team |
| Account erasure on request | No route exists; it is done by hand on the VPS. The policy says "write to us and we will carry it out", which is true only while somebody actually does. | Backend |
| Backups release erased data as rotation completes | An OVH snapshot backup exists; the **rotation period is not yet decided or written down**. | Backend |

## Working assumptions awaiting a decision

Flagged because the owning reference file (`itqan-brand/references/logo-program.md`) and the layout
grid decision are missing from the installed skills.

| Assumption | Where | Why it is provisional |
|---|---|---|
| Full horizontal lockup in the header at 148px (140px on mobile) | `src/components/Header.astro` | Confirmed by the team in review; the lockup is nearly square so the header is tall. The logo programme file should ratify it. |
| Content max width 72rem, menu breakpoint 52rem | `src/styles/global.css`, components | The layout grid is an open decision in the brand skill, section 10. |
| `theme-color` meta uses literal hex | `src/layouts/Base.astro` | HTML meta cannot read CSS variables. Values mirror the `--paper` and `--navy-950` primitives; update both if tokens change. |
| "Suggested — confirm" badge label keeps its dash | i18n `badge.suggested` | The design system fixes this exact label; the brief bans dashes in prose. Skills win per the brief's own rule. Flagged for the team. |

## Known contradiction in the skills (needs fixing upstream)

The brand skill's review checklist calls `#D08C2F` "retired ochre", while `tokens.css` defines the
same hex as `--gold`, the brand gold. The site only ever references the token, so correcting the
token corrects the site, but someone should fix whichever file is wrong.

## Source assets used

Original files in `C:\Users\admin\OneDrive\Desktop\02 - Lead\Itqan\`. The transparent exports
(files with a trailing `1` in the name, plus `Itqan Mascot v2.2.png`) were trimmed and converted in
`public/logos/` and `public/mascot/`. Regenerate at any size from the originals.
