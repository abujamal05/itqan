# CLAUDE.md — Itqan onboarding app

Read this before touching anything in `Onboarding/`.

This file exists because it did not. The design mandates for this product lived only in
[`../itqan-website/CLAUDE.md`](../itqan-website/CLAUDE.md), so an agent working in this directory had no
reason to open them — and in August 2026 that produced a dashboard rebuild that shipped flat, broken
geometry and six regressions on screens nobody looked at. The instructions were followable; they were
just invisible from here.

## What this is

The signed-in product: a graduate uploads a CV and transcript, answers a few questions, confirms what the
agents extracted, and lands on a dashboard of readiness, skills, courses and real job matches. React +
Vite + react-router. **Log in and sign up do NOT live here** — they are on the marketing site, and this app
only ever reads the session it established.

```bash
npm run dev            # http://localhost:4333/app/  (the site is served at / by dev/site-plugin.ts)
npm run build          # tsc -b && vite build
npm run lint
```

Dev accounts are seeded in `dev/site-plugin.ts`, all with the same password:
`maryam@itqan.test` (onboarded, profile seeded) · `nasser@itqan.test` (onboarded) ·
`new@itqan.test` (not onboarded, for testing the flow).

## Read these BEFORE styling anything

Not optional, and in this order:

1. **`../.claude/skills/itqan-design-system/references/depth-and-materials.md`** — the single most
   important file for making a surface feel alive. Pick the **register** before writing any CSS: product
   (verdicts, matches, confidence, tables, forms) is precise and quiet; expressive (onboarding, empty and
   error states, milestones) is dimensional and paced. Most "it feels wrong" reports are the wrong
   register. It also holds the nine sources of visual life and the eight-question blandness review — treat
   each failure there as a defect, the same as a contrast failure.
2. **`../.claude/skills/itqan-design-system/references/tokens.css`** — the source of truth for values.
3. **`../.claude/skills/itqan-design-system/references/components.md`** — component specs, the 8
   interaction states.
4. **`../.claude/skills/itqan-ux-craft/SKILL.md`** — screen states, capability-before-deficit ordering.
5. **`impeccable`** — direction and strategy, before implementation.

> **Restraint is a budget, not a prohibition.** "Clarity before decoration" ranks the two; it does not
> delete the second. A flat, shadowless, single-surface page is not restrained, it is unfinished — and for
> the skeptical graduate this product is built for, it is trusted *less*, not more.

## Locked — do not relearn these

- **`src/styles/tokens.css` is a verbatim copy of the design system's `tokens.css`**, and must stay in
  lockstep with `itqan-website/src/styles/tokens.css`. Exactly one deliberate deviation exists today,
  documented in the file: `--color-text-muted`, because the upstream value measures 4.32:1 and fails AA.
  If you need a value that is not there, the answer is to fix the skill, not to invent a local token.
- **Tokens only.** No raw hex, px, ms or curves in components.
- **The brand gold is `#F39F1C`.** `#D08C2F` is retired. Gold **fills** carry navy text at 8.1:1. Gold
  **edges and icons** on light must use `--color-border-accent` (`--gold-700`, 3.2:1) — the brand gold
  measures 2.0:1 and is barred from being a meaningful border. Gold **text** on light is
  `--color-accent-ink` (`--gold-800`) only, never body copy.
- **One gold anchor per viewport.**
- **RTL is the base architecture.** Logical properties only. Two exceptions that bite: `transform-origin`
  has no logical keywords (mirror it by hand under `[dir='rtl']`), and numeric/time axes never mirror.
- **Bilingual parity.** Every key exists in `ar.json` and `en.json`.
- **The Hud fence.** Never beside a verdict, score, real match, data table, or the confirmation screen. He
  is absent from the dashboard entirely.
- **Trust rules.** Every extracted value carries its confidence; every recommendation carries `why` and a
  real source. No invented statistics.
- **Motion:** only `transform` and `opacity`. Movement distance multiplies by `--motion-scale`, which
  reduced motion collapses to 0 — durations stay, so feedback survives. Every keyframe ships its own
  `prefers-reduced-motion` swap. The blanket `0.01ms` kill switch is banned.

## Verification — the part that was skipped

**A design change is not done until it has been rendered and looked at.** Build passing, typecheck
passing, and `detect.mjs` returning `[]` prove no defect was detected; they do not prove the result is
good. A dashboard rebuild once shipped with a progress track 12px off its markers, 109px of stray line at
each end, and a fill overshooting by 45px — through three commits that all passed every automated check.

Before calling any visual change finished:

1. Run it. `npm run dev`, sign in, open the screen.
2. Both themes, both directions, at 375 / 768 / 1280.
3. **If you changed a global utility or a token, open every screen that consumes it.** `grep` for the
   class first. `.muted`, `.chip*`, `.grid--*`, `.meter`, `.card*` and `.section__*` are all shared, and
   a dashboard-motivated change to any of them lands on Jobs, Courses, Documents, Profile, Confirm,
   Questions and Upload.
4. Measure, do not assume: `getComputedStyle` and `getBoundingClientRect` beat judgement about pixels.
   Composite alpha against what is actually behind an element before computing a contrast ratio.
5. `node ../.claude/skills/impeccable/scripts/detect.mjs --json src/` — a floor, not a finish line.

Known environment quirks: screenshots time out unless the Browser pane is displayed, so DOM geometry is
the usual fallback. `getComputedStyle(el).transform` misreports on **SVG** elements here. Rapid edits can
corrupt Vite HMR into `useI18n must be used inside <I18nProvider>` — hard-reload before believing it.

## Backend

[`../BACKEND.md`](../BACKEND.md) is the contract: every call, what it sends, what it must return, and the
four endpoints plus three fields that do not exist yet. `dev/site-plugin.ts` is a dev-only stub and **not
a specification** — it has already accepted things production would not.
