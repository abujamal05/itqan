# CLAUDE.md — Itqan onboarding app

Read this before touching anything in `Onboarding/`. The design mandates apply here too even though they
also live in [`../itqan-website/CLAUDE.md`](../itqan-website/CLAUDE.md); an agent that never opened that
file once shipped six regressions on screens nobody looked at.

## What this is

The signed-in product for **Itqan**, a career navigator for job seekers and job switchers. It answers four
questions in order, and every screen here serves one of them:

1. **Where do I stand today?** Upload, confirm, and the readiness block.
2. **Which role should I aim for?** The career goal, or Hud suggesting roles the position supports.
3. **What is the shortest path there?** Courses and certifications that close the distance.
4. **Which jobs can I apply to now?** Matched to that position and the stated preferences.

React + Vite + react-router. **Log in and sign up do NOT live here** — they are on the marketing site, and
this app only ever reads the session it established.

```bash
npm run dev            # http://localhost:4333/app/  (the site is served at / by dev/site-plugin.ts)
npm run build          # tsc -b && vite build
npm run lint
npx playwright test --project=chromium
```

Dev accounts are seeded in `dev/site-plugin.ts`, all with the password `itqan1234`:
`maryam@itqan.test` (onboarded, profile seeded) · `nasser@itqan.test` (onboarded) ·
`new@itqan.test` (not onboarded, and must stay that way — the e2e flow suite depends on it).

## Read these before styling anything

In this order:

1. **`../.claude/skills/itqan-design-system/references/depth-and-materials.md`** — pick the **register**
   before writing any CSS. Product (verdicts, matches, confidence, tables, forms) is precise and quiet;
   expressive (onboarding, empty and error states, milestones) is dimensional and paced. Most "it feels
   wrong" reports are the wrong register. It also holds the blandness review; treat each failure there as
   a defect, the same as a contrast failure.
2. **`../.claude/skills/itqan-design-system/references/tokens.css`** — the source of truth for values.
3. **`../.claude/skills/itqan-design-system/references/components.md`** — component specs, the 8 states.
4. **`../.claude/skills/itqan-ux-craft/SKILL.md`** — screen states, capability before deficit.
5. **`impeccable`** — direction and strategy, before implementation.

> **Restraint is a budget, not a prohibition.** "Clarity before decoration" ranks the two; it does not
> delete the second. A flat, shadowless, single-surface page is not restrained, it is unfinished, and for
> the skeptical user this product is built for it is trusted *less*, not more.

## Locked

- **`src/styles/tokens.css` is a verbatim copy of the design system's**, in lockstep with the website's.
  One deliberate deviation, documented in the file: `--color-text-muted`, because the upstream value
  measures 4.32:1 and fails AA. If a value is missing, fix the skill rather than inventing a local token.
- **Tokens only.** No raw hex, px, ms or curves in components.
- **The brand gold is `#F39F1C`.** Gold **fills** carry navy text at 8.1:1. Gold **edges and icons** on
  light must use `--color-border-accent` (3.2:1) — the brand gold measures 2.0:1 and is barred from being
  a meaningful border. Gold **text** on light is `--color-accent-ink` only, never body copy.
- **One gold anchor per viewport.**
- **RTL is the base architecture.** Logical properties only. Two exceptions that bite: `transform-origin`
  has no logical keywords (mirror it by hand under `[dir='rtl']`), and numeric or time axes never mirror.
- **Bilingual parity.** Every key exists in `ar.json` and `en.json`.
- **The Hud fence.** Never beside a verdict, score, real match, data table, or the confirmation screen.
  He is absent from the dashboard entirely.
  **One exception: the chat surface** (`src/app/Chat.tsx` and its parts), where the assistant is named
  after him. Two structural boundaries keep the fence's argument alive. **Nothing actionable lives in his
  prose** — a job or course is ATTACHED to the message and rendered through `MatchCard` / `CourseCard`
  unchanged, so `why`, the source and the confidence badge are inherited rather than reimplemented. And
  **exactly one Hud is on screen at a time**: `Chat.tsx` owns the single instance, `Message.tsx` contains
  no mascot, and `e2e/responsive.spec.ts` asserts the count at three widths.
- **Trust rules.** Every extracted value carries its confidence; every recommendation carries `why` and a
  real source. No invented statistics.
- **Motion:** only `transform` and `opacity`. Movement distance multiplies by `--motion-scale`, which
  reduced motion collapses to 0 — durations stay, so feedback survives. Every keyframe ships its own
  `prefers-reduced-motion` swap. The blanket `0.01ms` kill switch is banned.

## Verification

**A design change is not done until it has been rendered and looked at.** Typecheck, build and a clean
`detect.mjs` prove no defect was *detected*; they do not prove the result is good. A dashboard once
shipped with a progress track 12px off its markers and a fill overshooting by 45px, through three commits
that passed every automated check.

1. Run it. `npm run dev`, sign in, open the screen.
2. Both themes, both directions, at 375 / 768 / 1280.
3. **If you changed a global utility or a token, open every screen that consumes it.** `grep` the class
   first. `.muted`, `.chip*`, `.grid--*`, `.meter`, `.card*` and `.section__*` are shared, and a
   dashboard-motivated change to any of them lands on Jobs, Courses, Documents, Profile, Confirm,
   Questions and Upload.
4. Measure, do not assume: `getComputedStyle` and `getBoundingClientRect` beat judgement about pixels.
   Composite alpha against what is actually behind an element before computing a contrast ratio.
5. `node ../.claude/skills/impeccable/scripts/detect.mjs --json src/` — a floor, not a finish line.

**Screenshots work; a timeout means you are addressing a background tab.** The pane only composites the
FRONTED tab. Starting a second preview server creates a new tab and fronts it, orphaning the one you were
using. Fix with `tabs_context`, `tabs_select <tabId>`, then capture. Do not fall back to geometry only and
call it verified.

Two known quirks: `getComputedStyle(el).transform` misreports on **SVG** elements here, and rapid edits
can corrupt Vite HMR into `useI18n must be used inside <I18nProvider>` — hard-reload before believing it.
If a transform genuinely fails to compile, check the dev server log rather than assuming HMR.

## Backend

[`../BACKEND.md`](../BACKEND.md) is the contract: every call, what it sends, what it must return, and
which routes do not exist yet. `dev/site-plugin.ts` is a dev-only stub and **not a specification** — it
has already accepted things production would not, and a route missing from it is how a real bug survived
undetected.
