---
name: Itqan marketing site
description: A career navigator's public site, built from girih — the tiles you hold, the ones a role still needs, and the open edge between them.
colors:
  navy: "#071055"
  navy-900: "#060C2B"
  navy-950: "#05091F"
  gold: "#F39F1C"
  gold-400: "#FFB443"
  gold-800: "#8F5A0E"
  paper: "#FAF8F3"
  sand: "#EEE6D8"
  maroon: "#820000"
  surface: "#FFFFFF"
  border: "#E4DDCF"
  text: "{colors.navy}"
  text-muted: "color-mix(in srgb, #6B72A6 84%, #071055)"
  text-on-navy: "{colors.paper}"
  accent-ink: "{colors.gold-800}"
typography:
  display:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 9.5vw, 5.5rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 6.5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 3.4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#D98A15"
    textColor: "{colors.navy}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "44px"
  panel-navy:
    backgroundColor: "{colors.navy-900}"
    textColor: "{colors.paper}"
    padding: "96px 0"
  panel-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text}"
    padding: "96px 0"
  plaque:
    backgroundColor: "color-mix(in srgb, #05091F 76%, transparent)"
    textColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "24px"
  piece-held:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  piece-open:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
---

# Design

Recorded from the built site on 2026-08-19, after the visual world was replaced.
Where this file and `src/styles/tokens.css` disagree, **the tokens file wins** — it is
copied from the `itqan-design-system` skill and is the normative source. This document
describes how those values are composed here.

## Overview

The site is built from **girih**: the Islamic geometric system in which a pattern is
assembled from a small set of decorated polygons whose strap lines meet at fixed angles,
so the strapwork continues across every join automatically.

That is not decoration, it is the argument. The product tells someone where they stand,
which role to aim for, what the shortest path there is, and which jobs fit now. Girih
gives all four a single vocabulary:

| Product idea | How the site draws it |
|---|---|
| What you already hold | A **set** tile: filled, strapwork closed |
| What a role still needs | An **open** tile: dashed outline, nothing in it |
| The gap | The **open edge**, where the straps visibly run out |
| The ordered path | The **spine**, one continuous strap between markers |
| Evidence, not assertion | Straps that connect, rather than a claim that they do |

The pattern is computed in `src/lib/girih.ts` and rendered to static SVG in Astro's
frontmatter, so it executes at build time and costs the visitor **zero JavaScript**.

**The risk this world carries.** Islamic geometry is the Gulf's most wallpapered cliché.
This only works while the tiles are the actual content, navigation and state. The moment
a girih shape is added because a surface looked empty, the world has become a bank
website. Every tile on the page means something a visitor either has or does not.

## Colors

The five brand values are locked and unchanged. What changed is which one dominates:
**navy is the spine of the site, not an accent on paper.** Pages alternate two registers.

- **Navy register** (`.panel--navy`) — construction happens here. Hero, the open edge,
  limits, closings, the account pages, the 404, the footer. Carries the girih wall in
  gold. Navy in **both** themes, which is why marks on it are always the reversed lockup.
- **Paper register** (`.panel--paper`, `.panel--sunken`) — reading happens here. The
  pain beat, the spine, the worked example, questions, the team.

`.on-navy` re-registers a whole subtree for a dark ground. It **declares `color`**, not
just `--color-text`: `color` inherits as a computed value, so redefining the variable
alone never reaches a descendant heading.

**The scrim is not optional.** Legibility over a pattern must never depend on where a
tile lands, so `.panel--navy::after` lays a navy gradient between the wall and the words.
Its direction is the `--scrim` token: inline sweep by default (mirrored for RTL), radial
on `.panel--closing`, a flat vertical wash on phones and account pages.

Gold is fill, accent and state. It is **never body text on light** — `--color-accent-ink`
(`#8F5A0E`, 5.4:1 on paper) carries gold emphasis instead.

## Typography

Rubik only, both scripts. Hierarchy comes from weight and size alone.

The display scale is the biggest change from the previous site, whose largest text was
36px and read like a form. `.display` runs to 88px. It does **not** use `--text-7xl`
directly: that token's 3.75rem floor put a five-line headline down a whole 375px
viewport, so the viewport term does the work and the token's ceiling is kept.

Latin tracking tightens at display sizes. **Arabic never receives letter-spacing** — it
severs the cursive joins — so every tracking rule is guarded by `[dir='ltr']`.

## Layout

Panels, not sections. Each is a full-bleed band in one register with a `.container`
inside it, and the page alternates registers to pace the scroll: dense passages earn
quiet ones. Home runs navy → paper → sunken → navy → paper → navy.

**The spine** is the site's structural signature: an ordered list where each step's
marker holds a girih tile and one continuous gold strap runs between them. The strap is
anchored to the *step* and stretched between markers, never hung off the marker at a
fixed height — a step with a mascot in it is taller than that, and the strapwork visibly
stopping mid-sequence contradicts the one thing this world asserts.

RTL is the base architecture. Logical properties throughout; the three direction-sensitive
things (the pattern mask, the scrim, the arrow) each carry an explicit `[dir='rtl']` rule.

## Elevation & Depth

Two-part navy-tinted shadows from the tokens file, never neutral grey. Compose a shadow
with `--rim-light`, the 1px inner top highlight — that pairing is what makes a surface
read as an object rather than a coloured rectangle.

The **plaque** (`.plaque`) is the one raised object in the navy register: a translucent
`navy-950` panel with a blur, a border and a rim light, used wherever rows have to be
read on a patterned ground. Account pages use the same idea in reverse — a paper card
floating on navy — and in both cases the inner `.form-card` surface is flattened, because
a card inside a card draws a boundary where there is no second object.

## Shapes

Radii come from the tokens file: 8 / 12 / 20 / 28 / full. The brand reads soft, and the
girih tiles supply all the angular geometry the page needs.

**The icon system is the tile set.** Five decorated polygons — decagon, pentagon,
hexagon, bowtie, rhombus — all sharing one edge length, all rendered through
`GirihTile.astro`. There are no borrowed icons and no emoji. A mark on this site is a
piece, so it means something; the four spine tiles differ because the four steps do.

## Components

- `GirihField.astro` — the wall. Rosette lattice with a `held(row, col)` predicate
  deciding which cells are set and which are open. Geometry is emitted **once** into a
  `<defs>` and instanced with `<use>`; writing full path data per cell put 874KB of
  duplicated coordinates into the home page.
- `GirihTile.astro` — one tile, `state="set" | "open"`.
- `.panel` / `.panel--navy` / `.panel--paper` / `.panel--sunken` / `.panel--closing`
- `.spine` / `.spine__step` / `.spine__marker`
- `.pieces` / `.piece` / `.piece--open`
- `.plaque`, `.strap-link`, `.faq`, `.display` / `.title` / `.heading` / `.lede`

**Motion.** One authored moment, not scattered effects: tiles settle into place along the
lattice diagonal as a field enters view, staggered by `--cell-delay`. Everything reads
`--motion-scale`, so reduced motion collapses the travel to zero while opacity and colour
transitions keep running at full duration. Full catalogue in `MOTION.md`.

## Do's and Don'ts

**Do**

- Make every girih shape mean something a visitor has or does not have.
- Put a scrim between the wall and any text, and a plaque under any rows.
- Let a set tile differ from an open one in **fill and strapwork**, not only colour.
- Alternate registers, and give a heading more space above than below it.
- Guard every tracking rule with `[dir='ltr']`.

**Don't**

- Add an **eyebrow or kicker above a heading**. The heading carries its own weight. This
  is the single most likely regression: the previous site had one on every section.
- Build a **grid of same-size cards** each holding an icon, a heading and a line of text.
  That scaffolding is what this world replaced.
- Nest a card inside a card.
- Use girih as a background texture with nothing to say.
- Put the full-colour lockup on any navy surface, or Hud beside anything that looks like
  a verdict — the footer, the 404, `/proof` and the worked-example blocks are all fenced.
- Publish a number that has not been measured.
