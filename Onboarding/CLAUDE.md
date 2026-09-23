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

1. **[`../DESIGN.md`](../DESIGN.md) — the apex, and it wins on anything visual.** Pick the **register**
   from §3 before writing any CSS. There are **three, assigned by surface**: Stage (marketing), Passage
   (onboarding, upload, confirm, empty, error, success) and **Workspace** (dashboard, jobs, courses,
   documents, profile, settings, chat). On top of them sits the **evidence fence** (§3.4), scoped to
   *components* — verdicts, confidence, the evidence chain, parsed tables — which is the only absolute
   and travels with the data rather than the route.
   **This app is Workspace, and Workspace is dense, not flat.** An older model assigned two registers by
   route, so everything on a page that contained a score anywhere got built like a score; `DESIGN.md`
   Appendix B names that as the reason this app read sterile. Outside the fence, on the same screen,
   the full material vocabulary is available.
   **§3.5 is mobile** — the phone spacing table, the length caps, and what depth must survive the
   breakpoint. Read it before writing a media query. **§6.4 is the 13-question blandness review**; treat
   each failure as a defect, the same as a contrast failure.
2. **`../.claude/skills/itqan-design-system/references/tokens.css`** — the source of truth for values.
3. **`../.claude/skills/itqan-design-system/references/depth-and-materials.md`** — the nine sources of
   visual life and the material recipes. Downstream of `DESIGN.md`; if they disagree, `DESIGN.md` is the
   intent and the payload is the bug.
4. **`../.claude/skills/itqan-design-system/references/components.md`** — component specs, the 8 states.
5. **`../.claude/skills/itqan-ux-craft/SKILL.md`** — screen states, capability before deficit.
6. **[`../tools/itqan_voice.md`](../tools/itqan_voice.md)** — **the apex for any string you write**, in
   either language (`itqan_voice_ar.md` for Arabic).
7. **`impeccable`** — direction and strategy, before implementation.

> **Restraint is a budget, not a prohibition.** "Clarity before decoration" ranks the two; it does not
> delete the second. A flat, shadowless, single-surface page is not restrained, it is unfinished, and for
> the skeptical user this product is built for it is trusted *less*, not more.
>
> **But plain is allowed; sterile is not.** A simple surface is often the right answer — a settings row,
> a confirmation, a login. The defect is **absence of decision**, not simplicity. A plain surface that is
> finished has decided four things: type hierarchy, its one ground change, what responds to the pointer,
> and its spacing rhythm. A sterile one defaulted all four. Check which before adding material; if all
> four were decided, leave it alone.
>
> **Warmth is not hype, and ordinary words are ordinary.** Positive, appealing copy is wanted — the ban
> is on the unearned claim. "Register", "your account", "your journey", "settings" are the words the
> interface needs; they are a problem only when a headline leans on one instead of saying something
> specific. An arrow after a CTA is a UI affordance where the control really means "travel".

## Locked

- **`src/styles/tokens.css` is a verbatim copy of the design system's**, in lockstep with the website's.
  All three copies are now byte identical: the `--color-text-muted` deviation was fixed upstream rather
  than carried, so there is no longer a sanctioned place for these files to differ. If a value is
  missing, fix the skill rather than inventing a local token.
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
2. Both themes, both directions, **at 375 first**, then 768 and 1280. Phone width is the weakest surface
   in this app and checking it last means finding it last. Against `../DESIGN.md` §3.5: did the depth
   survive the breakpoint, is every spacing value from the §3.5 table, is the gutter the same as on the
   previous screen, and is any paragraph over its length cap? Over-explanation is a *visual* defect at
   375px, not only a copy one.
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
