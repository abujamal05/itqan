# Itqan Motion Recipes

Concrete, copy-adaptable patterns. All durations/easings are tokens from
`itqan-design-system/references/tokens.css` — never hard-code curve values here.
Every example is RTL-safe and ships with a reduced-motion behaviour.

**Register first.** Before using any pattern below, decide whether the surface is *product* (fast, plain,
under 200ms, no overshoot) or *expressive* (choreographed, character licensed). The registers are defined in
`itqan-design-system/references/depth-and-materials.md`. Patterns marked **[E]** are expressive-only.

---

## 1. RTL-safe entrance (the rule generic skills get wrong)

Never animate physical `translateX`/`left` for directional motion — it moves the wrong way in Arabic.
Use logical translation, or drive X from a direction variable that flips with `dir`.

```css
/* Panel enters from the inline-start edge, correct in both LTR and RTL */
.panel { transform: translateX(0); transition: transform var(--duration-slow) var(--ease-drawer); }
[dir="ltr"] .panel.is-hidden { transform: translateX(-100%); }
[dir="rtl"] .panel.is-hidden { transform: translateX(100%); }

@media (prefers-reduced-motion: reduce) {
  .panel { transition: opacity var(--duration-fast) var(--ease-hover); }
  .panel.is-hidden { transform: none; opacity: 0; }   /* swap movement -> fade */
}
```

Motion (formerly Framer Motion): compute the offset from direction, don't hard-code it.
```jsx
const dir = document.documentElement.dir; // "rtl" | "ltr"
const offX = dir === "rtl" ? 24 : -24;
<motion.div
  initial={reduce ? { opacity: 0 } : { opacity: 0, x: offX }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />
```
"Next / forward" moves in reading direction: content advances leftward in RTL, rightward in LTR.
Numeric and time axes do NOT flip (a progress bar over time still fills left→right). See the
`rtl-bilingual` reference in `itqan-ux-craft`.

## 1b. Scroll reveal driven by the motion scalars

This is the pattern that makes reduced motion work for free. The component never checks the media query —
it reads the scalar, and `tokens.css` collapses it.

```css
.reveal {
  opacity: 0;
  transform: translateY(var(--reveal-rise)) scale(var(--reveal-scale-from));
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}
.reveal.is-in { opacity: 1; transform: translateY(0) scale(1); }
```

Under reduced motion `--reveal-rise` is `0px` and `--reveal-scale-from` is `1`, so the element fades in
place at full duration. Nothing snaps, nothing is deleted. Build every entrance this way.

## 2. The pipeline wait (Itqan's signature motion problem)

The A→B→C→D run takes ~20–60s. A single indeterminate spinner for a minute reads as broken and users
leave. Choreograph the wait so the agent is visibly *working*. This is expressive motion living inside the
product, and it is licensed.

- **Never one 60s spinner.** Show the four stages (parse → extract → match → pathway) and advance through
  them with a determinate or stepped indicator. Each completed stage gets a check.
- **Stream, don't block.** Reveal each result as it lands rather than holding everything to the end.
- **Skeletons for shape.** While matches load, show skeleton match-cards (real layout, not a blank), so the
  eye knows what's coming. Subtle shimmer; static under reduced motion.
- **Hud is welcome here** — the `analyzing` pose, animated, beside the stage list. He leaves the moment
  results appear; he must not be on screen next to a match.
- **Let the gap moment land (Peak–End). [E]** When the distance to the target role resolves and the path
  across it appears — the product's emotional peak — reveal it with `--duration-slower`,
  `--ease-out-expo`, and a brief hold, not a throwaway fade. A single `--glow-gold` pulse on the revealed card is licensed here and nowhere else in the
  results view. The confidence number inside it still does not animate.
- **Failure is a state, not a freeze.** On mid-pipeline error, animate back to the last good step with a
  retry affordance; never leave a dead spinner. (Mirrors the LangGraph checkpoint-resume in the backend.)

```jsx
/* Staged progress: advance, check completed stages, stream results in */
const stages = ["Reading transcript", "Extracting skills", "Matching jobs", "Building pathway"];
// render each with state: pending | active (animated dot) | done (check, ease-out fade)
```

Shimmer, with its required swap:
```css
.skeleton { background-image: var(--gradient-sheen); background-size: 200% 100%;
            animation: sheen 1.4s linear infinite; }
@keyframes sheen { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background-image: none; background: var(--color-surface-sunken); }
}
```

## 3. Result reveal — staggered, restrained

When matches arrive, stagger their entrance so the list assembles rather than snapping in — but keep the
stagger tight (product register).

```jsx
<motion.ul variants={{ show: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="show">
  {matches.map(m => (
    <motion.li key={m.id}
      variants={{ hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }} />
  ))}
</motion.ul>
```
Stagger step 30–80ms; cap total reveal so a long list never feels slow. Never block interaction while a
stagger plays. Under reduced motion, fade only.

## 4. Component microinteractions (Itqan set)

| Element | Motion | Token |
| --- | --- | --- |
| Button press | `transform: scale(0.97)` on `:active` | `--duration-quick`, `--ease-out` |
| Button hover | lift `translateY(var(--hover-lift))` + shadow step | `--duration-fast`, `--ease-out` |
| Primary CTA hover **[E]** | above, plus `--glow-gold` fading in | `--duration-base`, `--ease-hover` |
| Match card hover | `--shadow-sm` → `--shadow-md`, no lift | `--duration-base`, `--ease-out` |
| Feature card hover **[E]** | lift + `--shadow-lg` + `--color-border-strong` | `--duration-base`, `--ease-out` |
| Modal + overlay | scale `var(--reveal-scale-from)`→1 + fade, **as one unit**, origin centre | `--duration-slow`, `--ease-out` |
| Popover / dropdown | scale from the **trigger** via `transform-origin: var(--transform-origin)` | `--duration-fast`, `--ease-out` |
| Drawer / sheet | translate from the inline edge | `--duration-slow`, `--ease-drawer` |
| Toast | slide from inline-edge + fade in; exit faster | `--duration-slow` in / `--duration-base` out |
| Tabs (high-frequency) | fast underline slide | `--duration-fast`, `--ease-out` |
| Accent rule / marker **[E]** | `scaleX` wipe from the inline start, RTL origin flip | `--duration-slower`, `--ease-out` |
| Confidence badge | **none** — it must read as fact, not animate in | — |

Rules baked in: elements that move together share one duration and easing; entrances start at
`--reveal-scale-from`, **never `scale(0)`** — nothing in the real world appears from nothing; popovers scale
from their trigger while modals stay centred; high-frequency elements animate less; exits run faster than
entrances.

Use CSS **transitions**, not keyframes, for anything triggered rapidly (toasts stacking, toggles).
Transitions retarget mid-flight; keyframes restart from zero.

## 5. Hud — the animated mascot

Where the fence allows him, he is animated. See the skill's Hud section for the fence itself.

- **Entrance then settle.** `flying-in` handing over to `idle` on `ended` beats a bare `idle` loop. An
  immediate loop reads like a decorative GIF; an arrival reads like a character.
- **Match the pose to the moment**, not to the layout: `waving` on first contact, `thinking` while the user
  is deciding, `analyzing` during the pipeline, `error` on a failure, `celebrating` on a genuine milestone.
- **In view only.** Play on intersect, pause on exit, `preload="none"` until needed. He is decorative:
  `aria-hidden`, empty `alt`, never the sole carrier of meaning.
- **The still is a failure path, not an option** — WebKit alpha loss, refused autoplay, alpha lost
  elsewhere, or reduced motion. Never ship the poster because it was easier.
- Under reduced motion he renders the poster and the clip is never requested.

## 6. Reduced motion (Itqan stance)

Reduced motion ≠ no motion. **Remove movement (transform, slide, scale, parallax); keep opacity, colour and
shadow transitions at full duration** — fades don't trigger vestibular issues and preserve the comprehension
that animation provides.

**The banned pattern** — do not write this, and remove it where it exists:
```css
/* BANNED: deletes feedback instead of removing movement */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

**The pattern instead** — scalars collapse globally (in `tokens.css`), and each moving keyframe ships its
own swap:
```css
@media (prefers-reduced-motion: reduce) {
  .card-enter { transform: none; transition: opacity var(--duration-base) var(--ease-hover); }
}
```
```jsx
const reduce = useReducedMotion();
const offX = reduce ? 0 : (dir === "rtl" ? 24 : -24);
```
Also guard hover motion on touch (`@media (hover: hover) and (pointer: fine)`) so taps don't fire
hover-scale on mobile.

## 7. Performance

Animate **only `transform` and `opacity`** (GPU, skips layout/paint). Never animate width/height/margin/
padding/top/left, or blur >20px. `will-change: transform` only on elements about to animate, then remove.
In React, drive frame-by-frame updates via refs, not state.

Two traps worth naming:
- **Don't set a shared CSS variable on a parent to move children** — it recalculates styles for every child.
  Set `transform` directly on the element that moves.
- **Motion's `x`/`y`/`scale` shorthands are not hardware-accelerated** — they run on the main thread via
  rAF and drop frames while the browser is loading or scripting. Use the full transform string
  (`animate={{ transform: "translateX(24px)" }}`) where that matters, or use CSS.

## 8. Tooling decision

- **CSS transitions/keyframes** — simple, deterministic enter/exit/hover, and anything that must stay smooth
  while the page is loading. Default choice; runs off the main thread.
- **`@starting-style`** — entry animation without JS, replacing the `useEffect(() => setMounted(true))`
  pattern where support allows.
- **Motion (`motion/react`)** — interruptible, gesture/drag, layout/shared-element, stagger orchestration,
  `useReducedMotion`. Use for the pipeline reveal and any spring.
- **WAAPI** — JS control with CSS performance, no library.
- **GSAP** — only if a complex scripted timeline appears (unlikely for Itqan's product surfaces).

Springs require JS. Two sanctioned profiles: `{ duration: 0.4, bounce: 0 }` for product surfaces,
`{ duration: 0.5, bounce: 0.25 }` for expressive ones. Never exceed bounce 0.3.

## 9. Debugging feel

When motion is technically correct but feels wrong, the answer is almost always duration or curve, and you
cannot see it at full speed:
- Bump the duration 3–5× and watch it. Do the coordinated properties stay in sync? Does the easing stop
  abruptly? Is the `transform-origin` right?
- Step frame by frame in the DevTools Animations panel for timing drift between paired elements.
- Test gestures on a real device, not a simulator.
- Look again the next day. Imperfections invisible during development surface with fresh eyes.

Then run **review-animations** over the diff before shipping.
