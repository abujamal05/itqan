# Microinteractions and motion

Every animation on the site, what triggers it, and its token. All durations/easings come from
`src/styles/tokens.css`. The rule everywhere: **only `transform` and `opacity` animate**, directional
motion is RTL-aware, and **reduced motion** removes movement while keeping opacity/colour fades.

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
| 12 | Nav-link underline | hover / current page | gold underline grows from inline-start (`scaleX 0→1`, `--duration-base`) |
| 13 | Register arrow | hover | arrow nudges `translateX(3px)`, RTL-mirrored (`--duration-fast`) |
| 14 | Mobile menu | tap / Escape | opens/closes; hamburger↔close icon swap; Escape returns focus to the button |
| 15 | Sticky header | scroll | translucent `backdrop-filter: blur` (state) |

## Language toggle (`LangToggle.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 16 | Segmented thumb | switch AR↔EN | thumb slides `inset-inline-start 0↔50%` (`--duration-base`, `--ease-in-out`) **and** glides across the page cross-fade via shared `view-transition-name: lang-thumb` |
| 17 | Option hover | hover on inactive | text colour → `--color-text` (`--duration-fast`) |

## Theme toggle (`ThemeToggle.astro`)

| # | Interaction | Trigger | What happens |
|---|---|---|---|
| 18 | Icon swap | toggle | moon ↔ sun; logo swaps colour/reversed with the theme |

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

## Static (not animated, but part of the visual system)

- Dot-grid canvas texture (`body::before`), hero/closing radial glows, icon chips, step/limit marks,
  the confidence badge (deliberately does **not** animate in — it must read as fact).

## Reduced motion (`prefers-reduced-motion: reduce`)

Movement is removed and the element jumps to its final state: reveals fade only (no rise), the marker
and all draw-strokes render fully drawn, the language thumb and threads do not slide, view transitions
are disabled, and the Hud mascot renders its poster only. Hover-motion is additionally guarded behind
`(hover: hover) and (pointer: fine)` so a tap never fires a hover animation. The global safety net lives
in `tokens.css`; per-component swaps live beside each interaction.
