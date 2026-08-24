# Microinteractions and motion

Every animation on the site, what triggers it, and its token. All durations/easings come from
`src/styles/tokens.css`. The rule everywhere: **only `transform` and `opacity` animate**, directional
motion is RTL-aware, and **reduced motion** removes movement while keeping opacity/colour fades.

> **Status: the 2026-08-03 revision has now LANDED.** `src/styles/tokens.css` is the design system's
> `tokens.css` copied verbatim, and `Onboarding/src/styles/tokens.css` is kept identical to it. The
> `--color-text-muted` deviation this note used to record has been fixed upstream; all three copies are
> byte identical again. Three consequences for everything
> catalogued below, none of which changes what triggers what:
>
> - **The curves moved.** `--ease-out` is now `cubic-bezier(0.23, 1, 0.32, 1)`; the value this file was
>   written against, `cubic-bezier(0.16, 1, 0.3, 1)`, is what the system now calls `--ease-out-expo`.
>   `--ease-in-out` changed too, and `--duration-fast` went 150ms to 160ms.
> - **Shadows are two-part** (a tight key plus a wide ambient) and compose with `--rim-light`.
> - **The blanket reduced-motion kill switch is gone**, replaced by the scalar mechanism described at the
>   bottom of this file. The "known defect" note that used to sit there has been resolved.
>
> Still not applied: `--ease-overshoot` is defined but unused and is fenced to the expressive register,
> and the animated-Hud requirement in the next section remains open. Read the skill before adding motion;
> read this file to know what is currently on the page.

## The motion layer (added 2026-08-21)

`src/scripts/motion.ts` owns three things that have to agree with each other, so
they live in one module rather than three.

| # | Interaction | Trigger | What happens | Token / value |
|---|---|---|---|---|
| M1 | Site entrance | DOMContentLoaded | `[data-enter]` elements fade and rise 18px, staggered 75ms apart in reading order: header, then headline, rule, sub, pain, actions, mascot | 850ms, `--ease-out-expo` |
| M2 | Scroll feel | always (pointer) | Lenis momentum smoothing; the page keeps weight and settles instead of stopping dead | 1.15s, exponential ease-out |
| M3 | Scroll reveal | 15% of the element in view | opacity + 28px rise | `--duration-story`, `--ease-out-expo` |
| M4 | Scroll cue | loop | the mouse wheel glyph ticks down 5px and pauses | 2.6s, `--ease-in-out` |

**Why `motion/mini` and not `motion`.** The full entry point costs 28KB gzipped
on a site whose whole JS budget was 2.8KB. `motion/mini` is the same `animate()`
over the Web Animations API the browser already ships. `stagger` and `inView`
are not imported at all: they are four lines and an IntersectionObserver
respectively, written out locally rather than pulled in at ten times their
weight. Measured total is **11.4KB gzipped per page**, of which ~8.6KB is the
motion layer.

**Reduced motion.** Lenis does not start at all — smoothing IS movement the user
did not ask for, and it is the most nauseating thing on a page for someone who
set that preference. The entrance keeps its fade at full duration and drops the
travel. M4 stops. M3 keeps the fade through `--motion-scale`.

**The class contract is unchanged.** `.reveal` / `.is-visible` still drives the
page-head rule, the gold marker, the survey meters and every `pathLength`
stroke. Motion toggles the same class rather than replacing it, because driving
those four from JS instead would have killed all four silently.

## Global (`src/styles/global.css`)

| # | Interaction | Trigger | What happens | Token |
|---|---|---|---|---|
| 1 | Button hover (primary) | hover | lift `translateY(-1px)` + `--shadow-sm`, fill → `--color-accent-hover` | `--duration-fast`, `--ease-out` / `--ease-hover` |
| 2 | Button press (all) | `:active` | `scale(0.97)` | `--duration-instant` |
| 3 | Button hover (secondary / ghost) | hover | bg → `--color-surface-sunken` / `--color-accent-tint` | `--duration-fast` |
| 4 | Icon button (theme, menu) | hover / active | bg → accent-tint / sunken | `--duration-fast` |
| 5 | Scroll reveal | element enters viewport (IntersectionObserver) | fade + rise (`opacity 0→1`, `translateY(12px→0)`) | `--duration-slow`, `--ease-out` |
| 6 | Stagger | grouped `.stagger` children | reveal delayed 40 / 80 / 120ms | — |
| 7 | Gold marker `.mark` | its reveal enters | gold underline wipes `background-size 0%→100%` | `--duration-slower`, `--ease-out` |
| 8 | Draw-stroke connectors | its reveal enters | SVG `stroke-dashoffset 1→0` (line/arrow draw themselves) | `--duration-slower`, `--ease-out` |
| 9 | Page transitions | any same-origin navigation | native cross-document view-transition cross-fade | browser default |
| 10 | Focus ring | keyboard focus | 2px `--color-focus` ring, `outline-offset: 2px` | `--duration-instant` |

## Header (`Header.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 11 | Logo | hover | lift `translateY(-1px)` (`--duration-fast`, `--ease-out`) |
| 12 | Nav-link underline | hover / current page | gold underline grows from the reading-start edge (`scaleX 0→1`, `--duration-base`). Origin is set physically (`left`, mirrored to `right` under `[dir='rtl']`) because `transform-origin` has no logical keywords — it read `inline-start` and silently grew from the centre in both languages until 2026-08-07 |
| 13 | Register arrow | hover | arrow nudges `translateX(3px)`, RTL-mirrored (`--duration-fast`) |
| 14 | Mobile menu | tap / Escape / outside tap / focus leaving the header | panel drops in: `opacity 0→1` + `translateY(-8px)→0` over `--duration-base`, out over `--duration-fast`, with `display` on `allow-discrete` and an `@starting-style` entry pose so it stays out of the layout and tab order when shut. Hamburger↔close icon swap; Escape returns focus to the button |
| 15 | Sticky header | scroll | translucent `backdrop-filter: blur` (state) |

## Language toggle (`LangToggle.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 16 | Segmented thumb | switch AR↔EN | thumb slides `inset-inline-start 0↔50%` (`--duration-base`, `--ease-in-out`) **and** glides across the page cross-fade via shared `view-transition-name: lang-thumb` |
| 17 | Option hover | hover on inactive | text colour → `--color-text` (`--duration-fast`) |

## Theme toggle (`ThemeToggle.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 18 | Icon swap | toggle | moon ↔ sun cross-fade with a counter-rotation: outgoing glyph turns 90° and drops to `scale(0.6)` while the incoming one settles upright (`--duration-fast` opacity, `--duration-base` transform, `--ease-out`). Both glyphs share one grid cell so the 44px box never reflows. Logo swaps colour/reversed with the theme |

## Forms (`forms.css`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 19 | Input focus | focus-visible | border → `--color-focus` + 2px ring (`--duration-fast`) |
| 20 | Input hover | hover | border → `--color-border-strong` |
| 21 | Valid / error field | blur | check icon (valid) or danger border + icon + message (error) appear |
| 22 | Submit loading | submit | label → "submitting…", spinner rotates (continuous), width held stable, button dims |
| 23 | Error summary | invalid submit | summary appears and receives focus |

## Home (`HomePage.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 24 | Hero entrance | load (in view) | kicker / title / rule / sub / actions / Hud reveal in sequence |
| 25 | Hero gold rule | reveal | `scaleX 0→1` wipe, RTL origin flip |
| 26 | Cards (problem / who) | hover (fine pointer only) | lift `translateY(-4px)` + `--shadow-lg` + border-strong (`--duration-base`) |
| 27 | Steps thread | reveal | gold line draws across nodes `scaleX 0→1`, RTL origin flip |
| 28 | Worked-example connector | reveal | line + arrow draw (`stroke-dashoffset`), RTL mirror |
| 29 | Section link arrow | hover | nudges, RTL-aware |
| 30 | FAQ item | open | chevron rotates 180° (`--duration-base`), border → strong |
| 31 | Closing CTA | hover | arrow nudge; panel carries a static gold radial glow |

## How-it-works (`HowItWorksPage.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 32 | Page-head rule | reveal | `scaleX` wipe |
| 33 | Vertical thread | reveal | gold spine draws down `scaleY 0→1` through the nodes |
| 34 | Confirmation step | — | weighted card (shadow + border) — state, not motion |
| 35 | CTA arrow | hover | nudge |

## Proof (`ProofPage.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 36 | Page-head rule | reveal | `scaleX` wipe |
| 37 | Match-row connectors (×5) | reveal | line + arrow draw, RTL mirror |
| 38 | Match rows | hover (fine pointer) | `--shadow-md` + border-strong |
| 39 | CTA arrow | hover | nudge |

## Hud's ask panel (`HudChat.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 40 | Launcher hover | hover (fine pointer only) | lifts `translateY(-2px)` and swaps `--shadow-lg` for `--shadow-xl` + `--glow-gold` (`--duration-fast`, `--ease-out`) |
| 41 | Launcher press | `:active` | `scale(0.97)`, scaled by `--motion-scale` |
| 42 | Panel open / close | launcher tap, Escape, close button, pointerdown outside | `opacity 0→1` + `translateY(8px)→0`, in over `--duration-base` and out over `--duration-fast`, with `display` on `allow-discrete` and an `@starting-style` entry pose. Same mechanism as the mobile menu (#14), for the same reason: shut means out of the layout **and** out of the tab order |
| 43 | Question taken | fork tap, or a matched free-text question | the answer node is **moved** into the spine and scrolled to with `scrollIntoView`, `behavior: 'smooth'` unless reduced motion asks otherwise, then receives focus |
| 44 | Fork hover | hover (fine pointer only) | border → `--color-border-strong`, ground → `--color-accent-tint`, lift `translateY(-1px)` (`--duration-fast`) |
| 45 | Send press | `:active` | `scale(0.97)` |

Two notes that are motion decisions, not omissions. The **launcher never animates on its own** — a
looping mascot pinned to the corner of every page competes with the reading, so the still is the
design here rather than a fallback. And the spine's **gold thread is drawn, not animated**: it is a
painted `::before` rule, because the panel's answers arrive one at a time by a person's choice, and a
line that redraws itself on every arrival would draw attention to the container instead of the answer.
The full surface in the app is where that thread animates.

Reduced motion needs no separate rule here: the entry offset and both lifts multiply by
`--motion-scale`, so the panel and the forks fade in place, and `scrollIntoView` switches to `'auto'`
by reading the media query directly.

## Static (not animated, but part of the visual system)

- Dot-grid canvas texture (`body::before`), hero/closing radial glows, icon chips, step/limit marks,
  the confidence badge (deliberately does **not** animate in — it must read as fact).

## Reduced motion (`prefers-reduced-motion: reduce`)

Movement is removed and the element jumps to its final state: reveals fade only (no rise), the marker
and all draw-strokes render fully drawn, the language thumb and threads do not slide, view transitions
are disabled, and the Hud mascot renders its poster only. Hover-motion is additionally guarded behind
`(hover: hover) and (pointer: fine)` so a tap never fires a hover animation. The global safety net lives
in `tokens.css`; per-component swaps live beside each interaction.

**RESOLVED.** This used to describe a defect: a blanket
`animation-duration: 0.01ms !important; transition-duration: 0.01ms !important` on every element, which
does not honour the preference so much as delete the interface's feedback — a user who asked for less
movement also lost colour fades, toast arrivals and skeleton resolution.

It is gone from both apps. `tokens.css` now collapses the scalars (`--reveal-rise`,
`--reveal-scale-from`, `--hover-lift`, `--motion-scale`) to zero and restricts transitions to non-moving
properties at full duration. Every movement in either codebase multiplies its distance by
`--motion-scale`, so travel disappears and duration does not; keyframes that a scalar cannot express ship
their own `prefers-reduced-motion` swap beside them. See `itqan-motion` §Accessibility and recipes §1b
and §6.

One case is deliberately NOT scaled and must stay that way: the skip link's `translateY(-200%)`. Collapsing
that to zero would leave it permanently on screen.

## Pending: the animated mascot

Hud already renders his `.webm` where one exists, with the poster as fallback — that behaviour is correct
and matches the new rule. What the skill now additionally requires, and this site does not all do yet:
prefer a play-once pose handing over to a loop (`flying-in` → `idle`) over a bare loop, and match the pose
to the moment rather than the layout. The fence is unchanged: he stays off `/proof`, the worked-example
blocks, and anything that looks like a result.

## Deliberately not animated

**FAQ disclosure height.** A `::details-content` `block-size: 0 → auto` transition was built and removed
on 2026-08-07. `CSS.supports('selector(::details-content)')` returns true in current Chromium and the
`block-size: 0` half applies, but the `[open]` rule that releases it does not, so every answer rendered
clipped to zero height. A feature query that reports support for a pseudo-element it does not fully
implement cannot gate this safely, and a hidden answer is a far worse failure than an instant one. The
chevron still rotates 180° on open, which is the half of the gesture that can move without hiding content.
Revisit when `::details-content` ships complete.

**Component transitions vs the reveal.** `html.reveal-ready .reveal` sets `transition: opacity, transform`
and outweighs a plain component rule, so any component that also needs a hover transition must match on
both classes (`.card.reveal`, `.proof-row.reveal`, `.faq-item.reveal`, `.about-team__card.reveal`) **and**
carry `opacity` in its own list — otherwise it either loses the hover properties or loses the entrance
fade. Four components hit this; a fifth will too.
