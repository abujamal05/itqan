---
name: itqan-design-system
description: >
  Itqan's visual design system — the source of truth for what any Itqan interface LOOKS LIKE: design
  tokens (colour, typography, spacing, radius, elevation, depth, material, motion), dark mode, and
  component specs. Use this skill WHENEVER building, styling, restyling, or reviewing any Itqan screen,
  component, page, email, or visual; when producing HTML/React/CSS/Tailwind for Itqan; or when choosing any
  colour, font, weight, spacing, radius, shadow, gradient, or animation value for Itqan — even when the
  request never says "design system" or "tokens". It defines the LOCKED brand identity (Rubik as sole
  typeface; the navy/gold/paper palette and its semantic roles; the brand gold is never body text;
  RTL-native, bilingual) and the token architecture that makes theming a swap, not a rewrite. Pair it with
  itqan-ux-craft (behaviour, states, process), itqan-motion (how it moves) and the impeccable skill
  (design strategy and direction). This skill owns VALUES; where they conflict, Itqan's locked rules win.
---

# Itqan Design System

This skill owns **what Itqan looks like** — the concrete values and components. It does **not** teach
general UX principles, screen states, or process; that is `itqan-ux-craft`. When you need *how a good
interface should behave*, read that skill; when you need *a value or a component spec*, read this one.
Don't duplicate content across the two — reference instead.

Itqan's product is trust: a graduate acts on its word about their own future. The visual system serves
that — **clarity first, then material.** The brand personality to reinforce is mastery (إتقان),
intelligence, craftsmanship, approachability. Never AI clichés — no brains, circuits, robot faces, neural
glow, synthetic futurism. The work should read *considered*, not generated.

**Considered does not mean plain.** Read that sentence twice before styling anything. The users are
graduates in their twenties and the product must read as a sharp modern tool, not a government portal. A
flat, shadowless, single-surface page is not "restrained" — it is unfinished, and the aesthetic-usability
effect means it is trusted *less*, not more. Restraint is a budget: spend it on few things and make each
excellent. `references/depth-and-materials.md` is the file that governs this, and it is not optional.

## Files in this skill

- `references/tokens.css` — the complete token set (primitive → semantic → component), dark mode, depth,
  material, motion, and the reduced-motion mechanism. **This is the source of truth for every value.**
  Read it before writing any styles; use the semantic tokens, never raw hex.
- `references/depth-and-materials.md` — the two registers, the nine sources of visual life, the material
  recipes, how much gold, and the blandness review. **Read it on any surface work.** If a design comes
  back flat, the fix is in here.
- `references/components.md` — specs for every Itqan component with all interaction states, in tokens.
  Read it when building or reviewing any component.

## Token architecture (non-negotiable)

Three tiers, per the W3C DTCG convention:
1. **Primitive** — raw values (the five brand hexes + derived ramps). No meaning. Components never touch these.
2. **Semantic** — meaning mapped onto primitives (`--color-text`, `--color-surface`, `--color-accent`, `--color-danger`…). **Components use only semantic tokens.**
3. **Component** — per-component overrides, used sparingly.

Dark mode is a **semantic-layer swap** (`[data-theme="dark"]` remaps semantic tokens; primitives are untouched). Anyone hard-coding a primitive into a component breaks theming — reject it in review.

## LOCKED brand rules

These come from the brand brief and are not up for casual revision. Overriding one requires an explicit brief change.

### Typography — Rubik only
Rubik is the sole typeface for Arabic and Latin. No serif, no second family. Hierarchy is **weight and
size only**. Weights: 400 body, 500 emphasis/labels, 600 subheads/verdicts, 700 headlines. A weight may
be used in Latin only if Rubik ships it in Arabic too — otherwise remove it from the system.
- **Arabic caution (from research):** bold Arabic body text reads heavy because the script is cursive and
  connected. Reserve 700 for short Arabic headings/labels; keep Arabic body at 400. Never add
  `letter-spacing` to Arabic — it breaks the joins and destroys legibility. Arabic also needs more
  line-height (`--leading-arabic`) and a slight size bump (`--font-scale-arabic`); both are in tokens.
- **One typeface is not a reason to be timid with type.** Rubik at `--text-7xl` against 400-weight body is
  a strong system. Use the display sizes; use `--tracking-tight-latin` on Latin display type (never
  Arabic); hold body copy to `--measure`. Unbounded line length is a slop tell.

### Colour — five values, roles are law
`--navy #071055` = ink/text and primary brand. `--gold #F39F1C` = fill, accent, and state **only**.
`--paper #FAF8F3` = base surface. `--sand #EEE6D8` = secondary surface. `--maroon #820000` = danger/deep accent.

- **`#F39F1C` is the final brand gold.** `#D08C2F` is **retired** — it must not appear anywhere. If you
  find it, it is a defect, not a variant. The whole gold ramp in `tokens.css` is rederived from F39F1C;
  never mix a tone from the old ramp into the new one.
- **The brand gold is never body text on light** — it measures 2.0:1 on paper and fails WCAG AA badly.
  Text on a gold fill is **navy**, always (`--color-text-on-gold`), which measures 8.1:1.
- **Gold hairlines and icons on light** must use `--color-border-accent` / `--gold-700` (3.2:1), because
  the brand gold also fails the 3:1 non-text floor. This is the rule most often missed.
- `--color-accent-ink` (`--gold-800`, 5.4:1) is available for **emphasis text and small headings** on
  light. It is a derived deep tone, not the brand gold, and it does not reopen the locked rule. **Pending
  your sign-off**, alongside the green below.
- The palette has no "success/valid" hue. `tokens.css` proposes a functional green (`--color-success`)
  **pending your approval** — functional-only, never decorative. If rejected, success states rely on
  icon + label, not colour.
- How much gold, and where it may appear, is in `references/depth-and-materials.md`.

### Direction — Arabic-first, RTL-native
RTL is the default design direction, not a mirror bolted on later. English is a first-class mode. Build
with **logical CSS properties** (`margin-inline-start`, `padding-inline-end`, `text-align: start`) from
day one so one codebase serves both. The *engineering* of RTL/bilingual (bidi, mirroring, numerals,
which elements flip) lives in `itqan-ux-craft/references/rtl-bilingual.md` — read it for any bilingual work.

### Accessibility floor
WCAG AA is a floor, never negotiated for aesthetics. **Never encode meaning in colour alone** — every
capability/gap/confidence/error state also carries an icon, label, or shape. Visible keyboard focus
(`--color-focus`), responsive to mobile. The detailed accessibility practice lives in `itqan-ux-craft`;
this skill supplies the token values it uses.

**Reduced motion is handled by a mechanism, not a kill switch.** The blanket
`animation-duration: 0.01ms !important` on every element is **banned** — it does not honour the
preference, it deletes the interface's feedback. `tokens.css` instead collapses the motion scalars
(`--reveal-rise`, `--hover-lift`, `--motion-scale`) to zero and restricts transitions to non-moving
properties at full duration. Movement goes; fades, colour and shadow stay. Keyframe animations that move
must ship their own swap beside them. See `itqan-motion`.

## Depth and material

Flat fills everywhere is the single biggest reason competent Itqan work has read lifeless. The system
ships the vocabulary to fix it — layered two-part shadows, `--rim-light`, gradients, off-centre radial
glows, canvas texture, glass, five surfaces rather than two, and a display type scale.

**Read `references/depth-and-materials.md` before styling any surface.** It defines the two registers
(product vs expressive), the nine sources of visual life, the composition recipes, and the blandness
review that a visual check must now include. The short version:

- **Product surfaces** (verdicts, matches, confidence, tables, forms, the OCR screen) stay quiet: hairlines,
  one shadow step, flat fills, fast motion, no Hud.
- **Expressive surfaces** (marketing, onboarding, empty, error, success, the gap moment) get the full
  material vocabulary: gradients, glows, layered shadows, texture, display type, animated Hud.
- The locked trust rules apply in both. Expressive never means an invented number or a missing source link.

## Motion values

Durations and easings are tokenised (`--duration-*`, `--ease-*`), using the Emil Kowalski/animations.dev
easing canon — strong custom curves, because the built-in CSS keywords are too weak to read as
intentional. Rules of thumb: micro-interactions 100–200ms, standard transitions ~200ms, screen-level
~300ms, marketing choreography up to `--duration-story` (700ms); **ease-out** entering/exiting,
**ease-in-out** for on-screen morph, **ease** for hover; avoid ease-in for UI. `--ease-overshoot` is
**licensed, not banned** — for onboarding, empty states, success, Hud and the gap moment; never on a
verdict, score, match or table.

This skill owns the *values*. The *decision* to animate lives in `itqan-ux-craft`; the *choreography and
implementation* (RTL-aware motion, the pipeline-wait sequence, component recipes, springs, performance)
lives in the `itqan-motion` skill — read it for any real animation work.

## Working with the installed design skills

| Skill | Use it for | Never let it |
|---|---|---|
| **impeccable** | Design strategy and direction on every surface: composition, hierarchy, visual world, how bold to go, critique. Load it before deciding what a page should look like. | Change the palette, the typeface, the logo rules, the mascot rules, or the voice |
| **emil-design-eng**, **review-animations**, **improve-animations**, **find-animation-opportunities** | Motion implementation and review — the craft canon behind the easing and duration tokens | Override the RTL rules or the trust-register limits in `itqan-motion` |
| **apple-design** | Gesture, spring, translucency and optical-typography craft when a surface needs it | Import iOS chrome into a bilingual web product |
| **ui-ux-pro-max** | Generic craft checklists on non-brand questions | Set or change anything Itqan-specific — it is a recommender and Itqan has already chosen |

When a generic skill and a locked Itqan rule conflict, **the locked rule wins.** When a generic skill and
an *unlocked* Itqan habit conflict — composition, depth, boldness, how a section is laid out — the
generic skill usually has the better answer. Only the brand, the palette, the typeface, the mascot fence
and the trust rules are locked. Everything else is open, and treating it as locked is what produced the
bland output this system was corrected for.

## Pre-ship visual checklist

1. Every value is a semantic token — no raw hex, no primitive hard-coded in a component.
2. No `#D08C2F` anywhere. Gold is `#F39F1C` and its derived ramp only.
3. Text is navy on light / paper on dark; the brand gold appears only as fill/accent/state; text on gold is
   navy; gold hairlines and icons on light use `--gold-700`; contrast verified.
4. Rubik only; Arabic body not bold; no letter-spacing on Arabic; Arabic line-height and size bump applied;
   body copy held to `--measure`.
5. Logical properties throughout; verified in both RTL and LTR.
6. Every interactive component defines all its states (see components.md); no meaning in colour alone.
7. **Depth check:** more than one ground colour; layered elevation, not one blur; texture, gradient or
   light present; type scale contrast ≥ 3:1; gold doing one confident job. Run the blandness review in
   `depth-and-materials.md`.
8. Motion uses tokens; the correct register for the surface; reduced motion handled by the scalars and a
   per-component swap, never by the banned global kill switch.
9. Dark mode works by semantic swap and was actually tested, not assumed.
10. With the logo removed, this is still recognisable as Itqan.
