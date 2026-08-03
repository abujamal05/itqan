---
name: itqan-motion
description: >
  Itqan's motion and animation layer — how any Itqan interface MOVES, and how to build it well. Use
  WHENEVER animating or reviewing motion in Itqan: transitions, entrances and exits, hovers, presses,
  microinteractions, loading and skeleton animation, page transitions, staggered reveals, drawers, modals,
  toasts, tooltips, popovers, gestures, springs or scroll-triggered motion; when choosing easing, duration
  or spring config; when the pipeline or loading wait needs choreographing; when the mascot Hud appears; or
  when something feels janky, too slow, too much, or dead. Also triggers on: easing, cubic-bezier, spring,
  keyframes, transform, opacity, stagger, Motion, Framer Motion, GSAP, prefers-reduced-motion, skeleton,
  loading state. Owns CHOREOGRAPHY and IMPLEMENTATION; RTL-aware, register-aware, and tuned to Itqan's
  trust-first tone.
---

# Itqan Motion

This skill owns **how Itqan moves** — the choreography and the implementation. It does **not** redefine
motion values (durations, easings, spring config live in `itqan-design-system/references/tokens.css`) and
it does **not** re-argue whether a surface may be expressive at all (the two registers are defined in
`itqan-design-system/references/depth-and-materials.md`). Pull values from the design system, the register
from depth-and-materials, and the craft canon from the installed Emil Kowalski skills.

**Read `references/recipes.md`** for concrete, copy-adaptable patterns (RTL-safe entrance, the pipeline
wait, staggered result reveal, Hud, component microinteractions, reduced-motion swaps, performance,
tooling). Go there whenever you're actually writing animation code.

## Motion serves trust — and a dead interface is not trustworthy

Itqan's product is trust, and for a long time this skill read that as "animate as little as possible." That
was an over-correction and it produced flat, lifeless work. The correct rule is **register-dependent**:

- **Product register** — verdicts, matches, confidence, gap analysis, tables, forms, the OCR confirmation
  screen. Motion is fast, purposeful and invisible. Under 200ms. No overshoot, no bounce, no delight, no
  Hud. Speed always wins. A confidence badge must read as *fact*, so it does not animate in at all.
- **Expressive register** — marketing and landing pages, onboarding, empty states, error states, genuine
  success milestones, the pipeline wait, and the gap moment. Motion is choreographed and has a point of
  view. Up to `--duration-story`. Overshoot is licensed. Stagger, draw-ons, parallax-lite, and the animated
  mascot all belong here.

The trust rules apply in both registers. Expressive never means animating a number so it looks impressive,
hiding a confidence score behind a flourish, or putting a cartoon bird next to a result.

**A page where nothing responds to the pointer is a defect**, reported the same way a contrast failure is.
That is true even in the product register — a button with no `:active` state is broken, not restrained.

## Animate for a reason — and "it feels dead" is a reason

Before adding any animation, name which job it does:
1. **Feedback** — confirm an action registered (button press, save).
2. **Continuity** — preserve spatial/mental context across a state change (modal open, route change).
3. **Focus** — direct the eye to what changed (a new match arriving).
4. **Perceived speed** — make an unavoidable wait feel responsive (the pipeline).
5. **Character** — *expressive register only.* Make the product feel like a considered tool made by people.
   This is a real job. Hud's entrance, a hero's choreographed reveal and the gap moment's confident settle
   all earn their place on this line alone.

Frequency still governs. Anything users trigger 100+ times a day, and every keyboard-initiated action, does
not animate — speed beats smoothness there, and no register overrides it.

| Frequency | Decision |
|---|---|
| 100+/day (keyboard shortcuts, command palette) | No animation. Ever. |
| Tens/day (hover, list navigation) | Minimal — under 160ms |
| Occasional (modals, drawers, toasts) | Standard |
| Rare / first-time (onboarding, empty, success, marketing) | Character licensed |

## The easing decision (values in tokens)

- Element **entering or exiting** → `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`).
- Element **already on screen moving/morphing** → `--ease-in-out`.
- **Hover / colour** change → `--ease-hover`.
- **Drawers and sheets** → `--ease-drawer`.
- **Constant** motion (tickers, determinate progress) → `linear`.
- **Character moments, expressive register only** → `--ease-overshoot`. Never on a verdict, score, match or
  table.
- **Avoid `ease-in`** for UI — it delays the exact moment the user is watching.

Use the token curves, not the CSS keywords. The built-in easings are too weak to read as intentional; that
weakness is a significant part of why the output felt bland. Duration from tokens: micro 100–160ms,
standard ~200ms, screen-level ~300ms; product motion stays under 300ms; marketing may reach
`--duration-story`; exits run ~20% faster than entrances; larger elements and longer travel take longer.

## Hud moves — use the animated version wherever he is allowed

**LOCKED: where Hud is permitted, the animated clip is the default and the still is a fallback, not a
choice.** He is a live messenger-scout; a frozen bird gets looked *at* instead of glanced at, and it is the
single clearest signal that a surface was built without care.

- Drop `public/mascot/{pose}.webm` + `{pose}.png`; the component picks them up automatically. Poses shipped:
  `flying-in`, `idle`, `waving`, `thinking`, `analyzing`, `error`.
- Prefer a **play-once pose handing over to a loop** (`flying-in` → `idle`) over a bare loop. Entrance then
  settle reads alive; an immediate loop reads like a GIF.
- Clips play only in the viewport and pause outside it. Above-the-fold instances load eagerly; everything
  else lazily.
- The still is correct in exactly four cases, all failures rather than decisions: WebKit discarding the
  alpha channel, playback that never starts, alpha lost on any other engine, and `prefers-reduced-motion`.
- **The fence is unchanged.** Animated or not, Hud never appears beside a verdict, confidence score, real
  match, data table, or the OCR confirmation screen. Animating him does not buy him entry anywhere.
- Never animate Hud *into* a trust-critical region as a transition, either — that includes flying across a
  results panel on the way somewhere else.

## RTL-aware motion (non-negotiable for Itqan)

Directional motion must respect reading direction. **Never hard-code physical `translateX`/`left`** for
entrances — it moves the wrong way in Arabic. Drive horizontal offset from `dir`, or use logical techniques
(see recipes §1). "Next/forward" advances in reading direction (leftward in RTL). Numeric and time axes
never flip — a progress bar over time still fills left→right. Test every directional animation in both RTL
and LTR; an entrance that feels right in English can be backwards in Arabic and native speakers notice
instantly.

## The pipeline wait is the signature problem

The A→B→C→D run is 20–60s — far outside normal animation timescales. It needs *choreographed progress*, not
a spinner: a staged indicator across the four agents, streamed results, skeleton cards for shape, and a
confident reveal for the gap moment. This is the one place where the expressive register lives inside the
product, because the alternative is a user leaving. Full pattern in recipes §2. Get it right before
polishing hovers.

## Accessibility — reduced motion means less movement, not a dead product

**The blanket `animation-duration: 0.01ms !important` override is BANNED.** It does not honour the
preference; it deletes the interface's feedback. A user who asked for less movement still needs a button
that responds, a toast that arrives rather than teleports, and a skeleton that visibly resolves.

The mechanism, in three parts:
1. **Scalars collapse.** `tokens.css` sets `--reveal-rise: 0`, `--reveal-scale-from: 1`, `--hover-lift: 0`,
   `--motion-scale: 0`. Every component that reads them loses its travel automatically. Build components to
   read them — that is what makes this work.
2. **The safety net restricts, it does not kill.** Transitions are limited to opacity, colour, shadow,
   fill, stroke and filter, at full duration. Fades survive.
3. **Keyframe animations ship their own swap.** A generic rule cannot catch a moving keyframe. Every one
   you write gets a `prefers-reduced-motion` block beside it. This is a requirement, not a nicety.

Also: guard hover motion behind `@media (hover: hover) and (pointer: fine)` so taps don't fire hover effects
on touch. Never rely on motion alone to communicate state — pair it with the icon/label/colour the design
system already requires.

## Performance floor

Animate only `transform` and `opacity`. Never animate layout properties (width/height/margin/padding/top/
left) or blur >20px. `will-change` sparingly and temporarily. In React, update per-frame values via refs,
not state. Don't drive child transforms from a CSS variable on a shared parent — it recalculates styles for
every child. Motion's `x`/`y`/`scale` shorthands are not hardware-accelerated; use the full transform string
where the main thread is busy. Full guidance and the CSS-vs-Motion-vs-GSAP decision in recipes §6–7.

## Working with the installed motion skills

The Emil Kowalski skills are now installed and are the **implementation canon** behind this skill's values.
Load them freely; they do not compete with anything Itqan has locked.

| Skill | Use it for |
|---|---|
| **emil-design-eng** | The philosophy and the craft details — easing, duration, physicality, springs, interruptibility, the invisible details |
| **review-animations** | Strict review of a diff's motion against the standards; use before shipping animation work |
| **improve-animations** | A prioritised roadmap when a whole codebase's motion needs lifting |
| **find-animation-opportunities** | When a surface "feels dead" and you need to know what *should* move — and what shouldn't |
| **animation-vocabulary** | Naming an effect precisely before building it |
| **apple-design** | Gesture, spring and translucency craft on drag/sheet surfaces |
| **impeccable** (`animate`, `delight`) | Whether this surface should be more expressive at all — strategy, before implementation |

**Where they conflict with Itqan, the Itqan rule wins on exactly three things:** RTL-safe direction, the
Hud fence, and the product-register limits on trust-critical surfaces. Everything else — curves, durations,
physicality, interruptibility, performance — follow the canon.

## Pre-ship motion checklist

1. Every animation names a functional job (feedback/continuity/focus/perceived-speed/character).
2. The register is right: product surfaces fast and plain, expressive surfaces choreographed.
3. Easing and duration come from tokens; strong curves, not CSS keywords; correct curve for the motion type.
4. Directional motion is RTL-safe and was tested in both directions.
5. Hud is animated wherever he appears, hands over from entrance to loop, and is absent from every fenced
   surface.
6. The pipeline wait is choreographed (staged, streamed, skeletoned), not a lone spinner.
7. `prefers-reduced-motion` is handled by the scalars plus a per-component swap — the banned global kill
   switch appears nowhere.
8. Only transform/opacity animated; no layout thrash; `will-change` cleaned up.
9. Nothing enters from `scale(0)`; entrances start at `--reveal-scale-from` with opacity.
10. Paired elements (modal+overlay, toast+icon) share one duration and easing; popovers scale from their
    trigger, modals from centre.
11. Nothing high-frequency or keyboard-initiated animates in a way that slows the user.
12. **Something on this page responds to the pointer.** If nothing does, it is not finished.
