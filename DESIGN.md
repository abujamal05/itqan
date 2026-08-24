# DESIGN.md — the Itqan design system

**One file. Every visual decision.** This is the authoritative design reference for both front ends. It
consolidates what was previously spread across nine documents and three copies of `tokens.css`, and it
resolves the contradictions between them.

## Precedence

1. **This file wins** on anything visual: tokens, layout, density, register, component shape, RTL.
2. **`itqan-brand`** still owns identity — the mission, the hoopoe logo programme, the Hud fence, the
   voice. Those are quoted here where they constrain visuals, not restated in full.
3. **`tokens.css`** (three copies, in lockstep) remains the machine-readable source. Where a value here
   and a value there disagree, the file is the bug and this document is the intent.
4. **`impeccable`, `emil-design-eng`, `apple-design`, `ui-ux-pro-max`** own craft and direction. On
   anything not marked **LOCKED** below, they usually have the better answer. Deferring to a thin
   in-house habit over a specialist skill is what produced flat work once already.

Six things are LOCKED and need a brief change to move: **the five brand colours and their roles**,
**Rubik as the sole typeface**, **the logo programme**, **the Hud fence**, **the voice**, and **the trust
rules** (provenance, honest confidence, no invented numbers). Everything else — composition, hierarchy,
density, depth, scale, boldness, choreography — is open, and this document exists partly to say so out
loud.

---

## 1. Core visual philosophy and vibe

Itqan's product is trust. A graduate acts on its word about their own future. That sets the tone, and it
is the reason for every rule that follows.

**Considered, not generated.** The name means doing something with excellence and care. Every detail
should look decided by a person: a gradient because this panel is the page's dark beat, not because
gradients look modern.

**Restraint is a budget, not a prohibition.** A restrained interface spends its visual budget on few
things and makes each excellent. It does not spend nothing. A flat, shadowless, single-surface page is
not restrained; it is unfinished, and by the aesthetic–usability effect it is trusted *less* by the
sceptic this product is built for, not more.

**The register of a sharp modern tool.** Linear, Raycast, Arc, Vercel. Not a government portal, not a
bank, not a hospital. The users are graduates in their twenties who arrived demoralised after months of
applications that went nowhere. Warmth is functional here.

**Evidence is quiet; everything around it may be loud.** The restraint belongs to the data — the verdict,
the score, the match, the extracted transcript line. It does not belong to the page that data sits on.
This distinction is section 3 and it is the single most important idea in this document.

**Arabic first.** RTL is the base architecture, not a mirror bolted on. English is a first-class mode,
never a degraded echo.

### The five-second test

Cover the logo. If the surface is not still recognisably Itqan — warm paper ground, navy ink, one
confident gold move, generous type, real depth — it is not finished, however cleanly it passes an audit.

---

## 2. Design tokens

Three tiers, W3C DTCG convention. **Primitive** (raw, never touched by a component) → **semantic**
(meaning, the only tier components may reference) → **component** (per-component overrides, sparing).
Dark mode is a semantic-layer swap; primitives never change. Anyone hard-coding a primitive into a
component breaks theming — reject it in review.

### 2.1 Colour

**The brand five (LOCKED).**

| Token | Hex | Role |
|---|---|---|
| `--navy` | `#071055` | Ink, primary brand, focus ring on light, the dark beat |
| `--gold` | `#F39F1C` | Fill, accent, state. **Never body text on light.** |
| `--paper` | `#FAF8F3` | Base canvas |
| `--sand` | `#EEE6D8` | Secondary surface, wells |
| `--maroon` | `#820000` | Danger, deep accent |

`#D08C2F` is **retired**. It is a defect wherever it appears, not a variant. The whole gold ramp is
rederived from `#F39F1C`; never mix a tone from the old ramp into the new one.

**The three gold rules that get missed.** Gold's legibility ceiling is the value people get wrong most.

- The brand gold measures **2.0:1 on paper**. It fails body text *and* the 3:1 non-text floor.
- Text **on** a gold fill is navy, always — `--color-text-on-gold`, 8.1:1.
- A gold **hairline or icon** on light is `--color-border-accent` / `--gold-700` (3.2:1), never `--gold`.
- Gold **text** on light, for emphasis and small headings only, is `--color-accent-ink` / `--gold-800`
  (5.4:1). It is a derived deep tone and does not reopen the locked rule.

**The functional palette.** Components reference only this tier.

| Role | Token | Light | Dark |
|---|---|---|---|
| Canvas | `--color-bg` | `--paper` | `--navy-950` |
| Raised surface | `--color-surface` | `#FFFFFF` | `--navy-900` |
| Sunken surface | `--color-surface-sunken` | `--sand` | `--navy-800` |
| Warm ground | `--color-surface-warm` | `--gold-50` | gold @ 7% |
| Inverse panel | `--color-surface-inverse` | `--navy` | `--paper` |
| Hairline | `--color-border` | `#E4DDCF` | `#1E2A5A` |
| Strong edge | `--color-border-strong` | `--navy-100` | `--navy-600` |
| Accent edge | `--color-border-accent` | `--gold-700` | `--gold-400` |
| Primary text | `--color-text` | `--navy` | `--paper` |
| Secondary text | `--color-text-muted` | navy-300 deepened, 5.46:1 on paper | `--navy-200` |
| Text on gold | `--color-text-on-gold` | `--navy` | `--navy` |
| Text on navy | `--color-text-on-navy` | `--paper` | `--paper` |
| Accent ink | `--color-accent-ink` | `--gold-800` | `--gold-300` |
| Accent | `--color-accent` | `--gold` | `--gold-400` |
| Accent hover | `--color-accent-hover` | `--gold-600` | `--gold-300` |
| Accent tint / wash | `--color-accent-tint` / `-wash` | `--gold-100` / `--gold-50` | gold @ 16% / 7% |
| Focus ring | `--color-focus` | `--navy` | `--gold-400` |
| Danger | `--color-danger` | `--maroon` | `--red-400` |
| Warning | `--color-warning` | `--gold` | `--gold-400` |
| Success | `--color-success` | `--green-500` *(pending sign-off)* | `#46A97A` |
| Info | `--color-info` | `--navy-600` | `--navy-300` |

**Five surfaces, not two.** This is deliberate and under-used. A long page that uses one ground colour is
monotonous by construction. See §3.

**Two open colour decisions**, both awaiting the lead's sign-off: `--color-success` (the brand has no
success hue; if rejected, success states carry icon and label only) and `--color-accent-ink` for gold
emphasis text on light.

**`--color-text-muted` is a deepened tone, and that is deliberate.** The raw `var(--navy-300)` measures
4.32:1 on paper and 3.70:1 on sand, failing AA for the secondary text that carries most of both apps. All
three copies now ship `color-mix(in srgb, var(--navy-300) 84%, var(--navy))` — same hue, still visibly
quieter than `--color-text`, and 5.46:1 on paper, 4.63:1 on sand, 5.79:1 on white. Muted is safe on any
surface. Some lines on paper and sand still take `--color-text` from the era when it was not; restoring
muted there is a hierarchy decision, not a fix.

**Never encode meaning in colour alone.** Every capability, gap, confidence, error or success state also
carries an icon, a label, or a shape. This is WCAG and it is also the sceptic's requirement.

### 2.2 Typography

**Rubik, and only Rubik (LOCKED).** One family for Arabic and Latin. Hierarchy comes from weight and size
alone. A weight may be used in Latin only if Rubik ships it in Arabic too.

| Weight | Token | Use |
|---|---|---|
| 400 | `--weight-regular` | All body copy, both scripts |
| 500 | `--weight-medium` | Labels, emphasis, card titles, selected states |
| 600 | `--weight-semibold` | Subheads, section titles, verdicts |
| 700 | `--weight-bold` | Headlines. Latin freely; Arabic only in short headings and labels. |

**One typeface is not a licence to be timid.** Rubik at `--text-7xl` against 400-weight body is a strong
system on its own.

| Token | Value | Register |
|---|---|---|
| `--text-xs` | 12px | Metadata, table captions |
| `--text-sm` | 14px | Secondary text, chips, helper text, dense rows |
| `--text-base` | 16px | Body — the floor for anything a user reads |
| `--text-lg` | 18px | Card titles, lead paragraphs |
| `--text-xl` | 20px | Section titles in the workspace |
| `--text-2xl` | 24px | Sub-headlines |
| `--text-3xl` | 30px | Passage headings |
| `--text-4xl` | 36px | Page titles |
| `--text-5xl` | 48px | Stage sub-heroes |
| `--text-6xl` | `clamp(3rem, 6vw, 4rem)` | **Stage headlines** |
| `--text-7xl` | `clamp(3.75rem, 8vw, 5.5rem)` | **The one hero headline on the page** |

**Scale contrast is the cheapest source of visual life a system has.** A page whose largest text is 36px
reads like a form. Target a **4:1 or 5:1** ratio between the Stage headline and its body, not 1.5:1.
Audit finding: `--text-6xl` and `--text-7xl` are currently used **zero times in either app**. That is the
sterility complaint, measured. See §3.1.

**Line-height and measure.**

| Token | Value | Applies to |
|---|---|---|
| `--leading-tight` | 1.2 | Display and headings |
| `--leading-snug` | 1.35 | Lead paragraphs, bubble copy, two-line labels |
| `--leading-latin` | 1.5 | Latin body |
| `--leading-arabic` | 1.75 | Arabic body, on `[lang="ar"]` / `[dir="rtl"]` |
| `--measure` | 68ch | Prose columns |
| `--measure-narrow` | 48ch | Passage copy, bubbles, empty-state text |

**`--measure` binds prose, not data.** A table, a match grid, a dashboard row or a chip rail clamped to
68ch is the hospital look. Hold paragraphs to the measure and let structured data use the column it has.

#### Arabic typography (LOCKED behaviour)

Arabic is not Latin with different glyphs. All four of these are non-negotiable:

- **Never apply `letter-spacing` to Arabic.** It severs the cursive joins and destroys legibility. Guard
  every use of `--tracking-tight-latin` / `--tracking-wide-latin` behind `:lang(en)` or `[dir="ltr"]`.
- **Arabic body stays at 400.** Bold Arabic body reads heavy because the script is connected and
  thick-stroked. Reserve 600–700 for short Arabic headings and labels.
- **Arabic needs more vertical room** — `--leading-arabic` at 1.75, for the diacritics.
- **Arabic renders 10–15% smaller at equal px** — apply `--font-scale-arabic` (1.08) to Arabic body.

Latin tracking: `--tracking-tight-latin` (-0.02em) on display sizes, because large type sets too loose by
default; `--tracking-wide-latin` (0.08em) on eyebrow labels and small caps.

`--font-mono` is `ui-monospace, SFMono-Regular, Menlo, monospace` — for codes, IDs and parsed raw values
only, never for prose and never for Arabic. It is the one place the sole-typeface rule yields, because a
verification code has to read as separate characters rather than as a word.

### 2.3 Spacing and layout widths

A 4pt base: `--space-1` 4px through `--space-32` 128px, with `--space-5` 20px and `--space-10` 40px
present for the awkward in-betweens.

**Spacing is register-scoped.** One universal section rhythm is wrong: `--space-32` between dashboard
sections wastes a workspace, and `--space-8` between marketing sections makes a hero look cramped. Pick
from the register's column in §3.

**Container widths.** These were hard-coded in three places; they are canonical here.

| Purpose | Width | Where |
|---|---|---|
| Stage / marketing shell | 72rem, → 84rem ≥1440px, → 96rem ≥1920px | `.container` |
| App workspace shell | 74rem | `.main__inner` |
| Passage / flow column | 68rem | `.stage` |
| Prose | `--measure` 68ch | Any paragraph |
| Narrow prose | `--measure-narrow` 48ch | Passage copy, bubbles |

**Breakpoints are content-driven, and containers beat viewports.** The app already proves why: a viewport
breakpoint made a match card *narrower* at 900px than at 899px, because the sidebar took 272px out of the
column at exactly that width. Use `@container main (…)` for anything inside the app shell, with an
`@supports not (container-type: inline-size)` viewport fallback. Verify at 360, 768, 1024, 1440.

### 2.4 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Inputs, small controls, icon buttons |
| `--radius-md` | 12px | Buttons, wells, inline panels |
| `--radius-lg` | 20px | Cards, popovers, toasts |
| `--radius-xl` | 28px | Hero panels, feature surfaces, modals |
| `--radius-full` | 9999px | Chips, badges, avatars, meters |

**Radius carries hierarchy.** The bigger and more expressive the surface, the larger its corner. A page
where every rectangle is `--radius-lg` has thrown away a free hierarchy signal. `--radius-xl` is used
once across both apps; Stage and Passage panels should be reaching for it.

Corollary: **do not put a straight-edged element inside a rounded one.** A 3px straight accent bar on the
inline edge of a 12px-cornered panel is a straight edge fighting a curve, and it is one of the most
recognisable tells of a generated interface.

### 2.5 Borders and edges

Three weights of meaning, one weight of line. Everything is **1px**; the focus ring is the only 2px rule
in the system.

| Token | Meaning |
|---|---|
| `--color-border` | Default hairline. Structure without emphasis. |
| `--color-border-strong` | This edge is doing work — secondary buttons, hovered cards, dividers that separate rather than group. |
| `--color-border-accent` | **The one thing that matters on this screen.** Gold at `--gold-700`, which actually clears 3:1. |

Accent edges are a scarce resource. If two things on a screen have a gold edge, neither is the one that
matters.

### 2.6 Elevation

**Every shadow is two-part**: a tight key shadow for the contact edge, plus a wide soft ambient shadow
for the room the object sits in. A single `0 4px 12px` is the tell of a default template. All shadows are
**navy-tinted, never neutral grey** — a grey shadow on warm paper is what reads as "default template".

| Token | Reads as |
|---|---|
| `--shadow-xs` | Barely lifted — inline chips, tight rows |
| `--shadow-sm` | Resting card |
| `--shadow-md` | Hovered card, gold CTA |
| `--shadow-lg` | Feature panel, toast, sticky header |
| `--shadow-xl` | Modal, the one hero object |

**`--rim-light` is not optional on a raised surface.** A 1px inner highlight along the top edge is the
cheapest way to make a surface read as a physical object rather than a coloured rectangle. Compose it,
never use it alone: `box-shadow: var(--shadow-lg), var(--rim-light);`

**On dark, elevation inverts.** Height reads through a *lighter surface* plus the rim light, not through
a bigger blur. The tokens already do this; do not hand-tune shadows for dark mode.

**Glow is for emotional peaks only.** `--glow-gold` on the primary CTA's hover, the gap moment, a success
milestone. `--glow-gold-strong` for exactly one object per page, or none. A glow on every card is a
discount banner.

### 2.7 Material

These exist to stop flat fills from being the only answer. All of them are currently under-consumed.

| Token | Use | Never |
|---|---|---|
| `--gradient-gold` | Gold CTAs, gold panels | Behind body copy |
| `--gradient-gold-soft` | Warm section grounds | As a card fill in the workspace |
| `--gradient-navy` | The page's dark beat | On a small element |
| `--gradient-paper` | Feature panels, raised surfaces | Everywhere at once |
| `--gradient-sheen` | A low-angle sweep across a dark or gold panel | On light surfaces |
| `--glow-field-gold` / `-navy` | Hero and CTA grounds, on a pseudo-element under the content | **Centred.** Place at 70%/20% or 25%/15%. |
| `--texture-dot` @ `--texture-dot-size` | The page canvas, on `body::before` | Visible. If you can see the dots without looking, halve it. |
| `--texture-hairline` | Inside a well or a sunken panel | On a raised card |
| `--glass-bg` + `--glass-blur` | Sticky headers, overlays | Without shipping the real background colour too |

**A glow centred behind a headline is the single most recognisable stock-template move.** The same glow
off-centre reads as intentional lighting. This is one line of CSS and it decides whether a hero looks
designed.

`backdrop-filter` alone collapses to transparent where unsupported. Always pair it with `--glass-bg`.

### 2.8 Motion

Values live here; *whether* to animate is a UX decision; *how to choreograph* is `itqan-motion`.

| Token | ms | Use |
|---|---|---|
| `--duration-instant` | 100 | Focus, tiny taps |
| `--duration-quick` | 130 | Button press |
| `--duration-fast` | 160 | Hover, micro-interactions, tabs |
| `--duration-base` | 200 | Standard transition |
| `--duration-slow` | 300 | Toasts, drawers, screen-level |
| `--duration-slower` | 500 | Orchestrated moves, the gap-moment reveal |
| `--duration-story` | 700 | **Stage only** — hero choreography, draw-ons |

**Exits run ~20% faster than entrances**, everywhere.

Easing uses strong custom curves, because the built-in CSS keywords are too weak to read as intentional.
`--ease-out` for entrances and exits; `--ease-out-expo` for hero settles; `--ease-in-out` for on-screen
morph; `--ease-hover` for hover and colour; `--ease-drawer` for sheets. **Avoid `--ease-in` for UI.**

`--ease-overshoot` is **licensed, and should actually be used** — Passage entrances, empty states,
success milestones, Hud. It is barred inside the evidence fence (§3.4). Audit finding: it is currently
used zero times in either app.

Springs are JS-only (Motion / motion.dev). Two profiles: `product { duration 0.4, bounce 0 }` and
`expressive { duration 0.5, bounce 0.25 }`. Never exceed bounce 0.3.

**Performance floor: animate `transform` and `opacity` only.** Never width, height, margin, padding, top
or left.

**Reduced motion is a mechanism, not a kill switch.** The blanket `animation-duration: 0.01ms !important`
is **banned** — it does not honour the preference, it deletes the interface's feedback. Instead the
scalars collapse:

- `--motion-scale` → 0, `--reveal-rise` → 0, `--hover-lift` → 0, `--reveal-scale-from` → 1.
- Components multiply their travel by `var(--motion-scale)`. Movement disappears; opacity, colour and
  shadow keep transitioning at full duration.
- **Every keyframe animation ships its own `prefers-reduced-motion` swap beside it.** Generic CSS cannot
  catch a keyframe that moves. This is a component requirement.

Never entrance-scale from `scale(0)`. `--reveal-scale-from` is 0.97 for a reason.

---

## 3. Layout and density: the three registers

The old model had two registers, product and expressive, assigned **by route**. That is why the app feels
sterile: the whole dashboard inherited "hairlines, one shadow step, flat fills, no delight" because it
contains verdicts somewhere on it, and so every section header, empty state and page ground on that route
got built as though it were a confidence score.

**Registers are now assigned by surface, and evidence is a fence that travels with the data.** Three
registers describe density and posture; the fence (§3.4) overrides them locally wherever real AI output
is displayed.

| | **Stage** | **Passage** | **Workspace** |
|---|---|---|---|
| Where | Marketing site, hero, pricing, proof, about | Onboarding, upload, confirm, questions, empty, error, success | Dashboard, jobs, courses, documents, profile, settings, chat |
| Job | Convince a stranger in one screen | Carry one person through one step | Let a returning user work |
| Feels like | Confident, roomy, dimensional | Warm, paced, focused | Precise, dense, structured, *alive* |
| Headline | `--text-6xl` / `--text-7xl` | `--text-3xl` / `--text-4xl` | `--text-xl` / `--text-2xl` |
| Section rhythm | `--space-20` → `--space-32` | `--space-12` → `--space-16` | `--space-8` → `--space-10` |
| Card padding | `--space-8` | `--space-6` → `--space-8` | `--space-5` → `--space-6` |
| Grid gap | `--space-8` | `--space-6` | `--space-4` |
| Column width | up to 96rem | 68rem, prose at `--measure-narrow` | 74rem |
| Radius | `--radius-xl` | `--radius-lg` → `--radius-xl` | `--radius-lg` |
| Elevation | `--shadow-lg` / `-xl` + rim | `--shadow-md` / `-lg` + rim | `--shadow-sm` / `-md` + rim |
| Material | Everything in §2.7 | Gradients, warm grounds, one glow | Texture in wells, `--gradient-paper` on the primary panel, one dark beat in chrome |
| Motion ceiling | `--duration-story`, staggering, choreography | `--duration-slower`, overshoot licensed | `--duration-base`, no overshoot outside chrome |
| Hud | Welcome, animated | Welcome, animated | Chat surface only |
| Gold | May carry a whole surface | One accent per step | One anchor per view section |

### 3.1 Stage — marketing

The site's one job is to convince a stranger to create a free account. It is allowed to be impactful.

- **One hero headline at `--text-7xl`.** Not `--text-5xl`. The current homepage clamps its hero at
  `--text-5xl` and the display tier goes unused; that is the specific reason the site reads safe.
- **At least one navy beat** on any long page, so the eye gets a rest and the paper ground means
  something by contrast.
- **At least three of the five grounds** across the page. Alternate them between sections.
- **Asymmetry is the default, not the exception.** A 7:5 or 5:7 split beats 6:6. Let a figure break its
  container. Let a card overlap a section edge. Centred everything is what reads as generated.
- One off-centre `--glow-field-*` per long page, on a pseudo-element beneath the content.
- Motion may choreograph: staggered reveals, draw-ons, a hero settle at `--ease-out-expo`.

### 3.2 Passage — onboarding and flow states

One job per screen, one primary action, and the user is usually anxious. Roomy, warm, and paced.

- Single column at 68rem, prose at `--measure-narrow`. Do not spread a step across the full width.
- `--color-surface-warm` or `--gradient-paper` as the ground, so a flow never looks like a form on a
  blank page.
- Overshoot licensed on entrances. Stagger a list of options by 40–60ms.
- Hud is welcome, animated, at `md` or `lg`.
- **The confirm screen is the exception**: it is the first trust moment, so the whole screen sits inside
  the fence (§3.4) and Hud is forbidden on it.

### 3.3 Workspace — the app

Dense, structured, information-first, and **this is where "sterile" was actually happening**. Density is
not the same as flatness. A workspace should read like Linear: tight, fast, and unmistakably crafted.

- **Tighter spacing, same material vocabulary.** Rim light on cards, layered shadow, `--gradient-paper`
  on the one panel that leads the view, `--texture-hairline` inside wells.
- **The chrome carries the brand.** The sidebar is the dashboard's dark beat: `--color-surface-inverse`
  or `--gradient-navy`, with the reversed monochrome lockup. That is where a workspace gets its identity
  without touching the data.
- **Grids respond to their container, not the viewport.** `@container main`, with a viewport fallback.
  Columns are `minmax(0, 1fr)` — an implicit `auto` track grows to its widest item and a long job title
  will push a card out of its column.
- **Asymmetric splits are first-class here too.** A 22rem rail beside a `1fr` content column already
  exists as `.stage--split`; a 7:5 dashboard split is equally legitimate. Equal thirds are a default, not
  a decision.
- Row height, chip size and `--text-sm` secondary text keep density up. Touch targets stay ≥44px.
- Motion stays under `--duration-base` on anything a user touches dozens of times a day.

### 3.4 The evidence fence

**This is the only restraint that is absolute, and it is scoped to components, not pages.**

Inside the fence: **verdicts, confidence scores and badges, match cards' evidence chain, gap analysis
figures, extracted transcript data, the OCR confirmation screen, any table of parsed values.**

Inside the fence:

- No gradient behind data, no glow, no texture under a number, no decorative accent bars.
- No overshoot, no bounce, no entrance of its own. A figure that springs in reads as a reveal, and a
  reveal reads as a guess.
- **Hud is forbidden.** A mascot beside an extracted-data table reframes evidence as an opinion.
- Every value carries its confidence. Every recommendation carries its `why` and a real, live source
  link. Below the trust threshold it says "Suggested — confirm", never states it as fact.
- Capability before deficit: lead with what qualifies the user, then the gap, framed as "unlock" rather
  than "missing".

**Outside the fence, on the very same screen, everything in §2.7 is available.** The card *around* a
match may have a rim light and a gradient. The section heading above a table may be large. The empty
state where a table would be may be as warm and expressive as any onboarding step. The fence follows the
data, not the route.

---

## 4. Component patterns

Every interactive component defines all eight interaction states:
`default · hover · focus-visible · active/pressed · disabled · loading · selected · error`.
Missing one is a defect, not an omission. Every data view defines all five screen states:
`ideal · empty · loading · partial · error`. Designing the ideal state alone is the single most common
cause of awkward UI.

Values below are semantic tokens. Never hard-code a hex, px, ms or curve in a component.

### Buttons

Three variants. **One primary per view** — that is a hierarchy rule, not a quota on gold.

**Primary.** `--color-accent` fill, `--color-text-on-gold` text (navy, 8.1:1), `--radius-md`, padding
`--space-3 --space-5`, `--weight-medium`, `--shadow-sm` + `--rim-light`.
On Stage and Passage, use `--gradient-gold` instead of the flat fill; the page's one primary CTA may also
carry `--glow-gold`.

- **hover**: `--color-accent-hover`, `translateY(var(--hover-lift))`, `--shadow-md`, `--duration-fast
  --ease-out`. Guard the lift behind `@media (hover: hover) and (pointer: fine)`.
- **focus-visible**: 2px `--color-focus` ring at `outline-offset: 2px`. Never removed.
- **active**: `scale(0.97)`, lift removed, `--duration-quick`. **Required on every pressable element** — a
  button with no press state reads as broken, not as restrained.
- **disabled**: 40% opacity, `cursor: not-allowed`, no hover, still visibly a button.
- **loading**: label replaced by an inline spinner, **width held stable** so nothing jumps; pointer
  disabled, focus kept.

**Secondary**: transparent fill, 1px `--color-border-strong`, `--color-text`.
**Ghost**: no border, `--color-accent-ink` text on light (the brand gold fails as text),
`--color-accent-tint` on hover.

Buttons name their outcome — "See my matches", not "Submit" — and keep that name through the flow.

### Cards and surfaces

| Recipe | Composition |
|---|---|
| **Workspace card** | `--color-surface`, `--radius-lg`, 1px `--color-border`, `--shadow-sm`, padding `--space-6` |
| **Feature panel** | `--gradient-paper`, `--radius-xl`, `--shadow-lg` + `--rim-light`, padding `--space-8` |
| **Navy beat** | `--gradient-navy`, `--color-text-on-navy`, `--rim-light-dark`, an off-centre `--glow-field-gold` on a pseudo-element beneath the content. Reversed monochrome lockup only. |
| **Warm section** | `--color-surface-warm` — the gentlest way to change ground without a new hue |
| **Well / sunken** | `--color-surface-sunken`, no shadow, transparent border, optional `--texture-hairline` |
| **Glass header** | `--glass-bg` + `backdrop-filter: blur(var(--glass-blur))` + `border-block-end: 1px solid var(--glass-border)` |

Interactive cards hover to `--shadow-md` at `--duration-base --ease-out`; a Feature panel lifts by
`--hover-lift` to `--shadow-xl` and `--color-border-strong`. **Non-interactive cards do not hover** — a
hover state that leads nowhere is a lie about affordance.

**A long page whose every card is the same flat white rectangle is a blandness defect**, reported the
same way a contrast failure is.

### Forms and fields

- Label **always visible above the field**. Never placeholder-as-label.
- default: `--color-surface`, 1px `--color-border`, `--radius-sm`, min-height 44px.
- focus: `--color-focus` border plus a 2px ring at 20% of the focus colour.
- valid: no green needed — a check icon plus `--color-text` is enough.
- error: `--color-danger` border, **plus** an alert icon, **plus** a message that says what is wrong and
  how to fix it. Never a red border alone. Never a code, never blame, never the word "invalid".
- disabled: `--color-surface-sunken`, muted text.
- **Validate on blur or submit, not on every keystroke.** Never wipe input on error.
- RTL: label and text align to `start`; the input's own `dir` follows its content.

### Data tags: chips and badges

**Capability chip** — a skill the user already has: `--color-accent-tint` fill, navy text, check icon.
**Gap chip** — a skill to acquire: `--color-surface-sunken` fill, navy text, plus icon, framed as
"unlock". Distinct icon *and* shape, so the pair never depends on fill colour.
Selected: `--color-accent-tint` + `--color-accent` border + `--weight-medium` + `aria-pressed`.
A chip that needs a visible edge on light uses `--color-border-accent`, never the brand gold.
Chips wrap: `max-inline-size: 100%` and `overflow-wrap: anywhere`.

**Confidence badge.** High (≥ ~0.85): `--color-accent` fill, navy text, check icon, label "Strong match".
Below threshold: outline style, `--color-text-muted`, dashed or question icon, label "Suggested —
confirm". Colour, icon and word together, always.
**It never gets an entrance of its own** — no glow, no overshoot, no stagger delay. It may fade in as
part of its container, so it does not pop, but it must read as a fact rather than a reveal.

### Match card — the product's core object

The most trust-critical component in the system. In reading order (top-**right** first in RTL):

1. Role title and employer.
2. Confidence badge — never a bare number without a label and an icon.
3. **"Why this match"** — the evidence chain: transcript course → skill → posting requirement. Rendered
   as a sunken well: `--color-surface-sunken`, `--radius-md`, `--space-4`, `--text-sm`. **Fill only.** A
   straight gold bar on its inline edge is a second answer to a question the fill already answered, a
   straight edge fighting a 12px corner, and a generated-interface tell on the product's most important
   component.
4. A **source link** to the live posting. Provenance is mandatory. A dead or invented link loses the
   sceptic permanently.

The card sits inside the fence. The grid it sits in does not.

### Lists and tables

- Hairline row separators (`--color-border`), never a full grid of lines. Zebra striping only when a row
  spans more than five columns.
- Header row: `--text-sm`, `--weight-medium`, `--color-text-muted`, sticky in a long table.
- Numeric columns align to `end` and never mirror in RTL (§5).
- Row hover is a `--color-surface-sunken` wash — no lift, no shadow, no scale.
- **Below ~40rem a table becomes a definition list**: each row a card, each cell labelled by its column
  header through a `::before`. Do not horizontally scroll a data table on a phone.
- A table's own boxes go **inside** the cells; a `box-shadow` or `border-radius` on a `tr` breaks the
  table formatting context.

### Toasts, modals, popovers

- **Toast**: `--color-surface`, `--shadow-lg` + `--rim-light`, slides from the inline edge and fades at
  `--duration-slow --ease-out`. Use a **transition, not a keyframe** — toasts stack rapidly and a
  keyframe restarts from zero when interrupted. Auto-dismiss ≥5s, and never for anything the user must
  act on.
- **Modal**: `--color-surface`, `--radius-xl`, `--shadow-xl` + `--rim-light`. Overlay and panel animate
  as one unit; the panel scales from `--reveal-scale-from`, never from `scale(0)`, with
  `transform-origin: center`. Focus trap, focus returns to the trigger, `Esc` closes, first focusable
  element receives focus on open.
- **Popover / dropdown**: scales from its **trigger**, not its centre —
  `transform-origin: var(--transform-origin)`, `--duration-fast --ease-out`. `transform-origin` has no
  logical keywords, so mirror it by hand under `[dir='rtl']`. This is the detail nobody consciously
  notices and everybody feels.

### Meters and progress

Track `--color-surface-sunken`, fill `--color-border-accent`, `--radius-full`, transition on
`inline-size` at `--duration-slower --ease-out`, with a `prefers-reduced-motion` swap to `none`. Under
RTL set `transform-origin: right center`. **A number never stands alone** — a readiness ring carries its
figure and a sentence that says what the figure means.

### Hud, the mascot (LOCKED fence)

A fenced component, not a decorative image. Animated by default: `{pose}.webm` with a `{pose}.png`
poster, where the still is a fallback for WebKit alpha loss, refused autoplay and reduced motion, never a
design choice. Fluid sizes: `sm clamp(120px, 16vw, 140px)`, `md clamp(140px, 22vw, 180px)`,
`lg clamp(160px, 30vw, 250px)`; below 120px he is visual noise. `aria-hidden`, empty `alt`, never the
sole carrier of meaning. He sits on a blurred navy radial contact shadow, **not** a `drop-shadow` filter,
which rasterises at the composited layer's resolution and bands on iOS. Plays in the viewport, pauses
outside it.

**Forbidden**: verdicts, confidence scores, real matches, data tables, the OCR confirmation screen, the
logo, the favicon, and anything a user will act on. **One exception**: the chat surface, where the
assistant is named after him. There, exactly one Hud is on screen at a time, and **nothing actionable
lives in his prose** — a job or a course is *attached* to the message and rendered through the unchanged
`MatchCard` / `CourseCard`, so the `why`, the source and the confidence badge are inherited rather than
reimplemented.

---

## 5. RTL and localisation

Itqan is Arabic-first and its core content is inherently mixed-direction: Arabic course titles beside
`SQL`, `React`, `Data Engineer`. Getting this wrong is immediately visible to a native speaker and costs
the one thing the product cannot spend.

### 5.1 Direction is architecture

- **Logical properties only.** `margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
  `border-inline-*`, `text-align: start`, `padding-block`. A physical `left` or `right` is a bug waiting
  for the language toggle.
- `dir` is set on `<html>` and cascades. Per-element `dir` only to override mixed content.
- **Two exceptions that bite**: `transform-origin` has no logical keywords — mirror it by hand under
  `[dir='rtl']`; and a directional glyph inside a component needs `scaleX(-1)`, which then has to be
  composed with any other transform on that element (`scaleX(-1) translateX(…)`).
- Lint for physical properties and catch regressions with visual snapshots. RTL bugs are silent in an LTR
  dev environment.

### 5.2 Bidi — the transcript problem

The Unicode bidi algorithm treats Latin runs and numbers as opposite-direction islands inside Arabic and
will reorder them wrongly if left alone.

Wrap every inline English word, brand name, role title, course code, URL, email and phone number in
`<bdi>` or `<span dir="ltr">`. Without it, `خبرة في React وSQL` can render the Latin out of order. Phone
sequences (`+968 …`) must be isolated so the digits do not rearrange. **Treat every mixed string as
needing isolation** — in Itqan's parsed transcript lines and job cards this is the common case, not an
edge case.

### 5.3 Numerals

Default to **Western Arabic numerals** (0–9) for job data, dates and match scores. Offer Arabic-Indic
only if a real user need appears; do not auto-convert. Numbers read left-to-right even inside RTL text —
that is correct bidi behaviour, not a bug to fix.

### 5.4 What mirrors and what does not

**Mirror**: overall layout and reading order (top-**right** first), navigation, breadcrumbs, pagination,
sidebars, back/forward arrows, chevrons, progress arrows, horizontal **bar** charts (bars grow from the
right), and the emphasis side of an asymmetric split.

**Do not mirror**: numbers; numeric and time axes — **a line chart keeps its LTR time axis**, because
time still moves rightward; media and playback controls; non-directional icons (search, settings, user,
check) — flipping them just looks broken; logos and brand marks.

The rule: **mirror direction and flow, not meaning.** If an icon encodes real-world direction, flip it.
If it encodes a thing, leave it.

### 5.5 Padding balance and optical adjustment

Mirroring is not the whole job. An icon-plus-label control that looks balanced in Latin often looks
lopsided in Arabic, because Arabic's baseline weight sits differently and its ascenders are shorter.
Where a component has asymmetric inline padding (a removable chip's `padding-inline-end`, a select's
caret gutter), check it visually in both directions rather than trusting the logical property to have
done the work.

Arabic body copy at `--leading-arabic` and `--font-scale-arabic` needs its container to have room for the
extra height — density is genuinely worse in Arabic, and a card sized to fit English will clip.

### 5.6 Bilingual parity

Every string exists in both `ar.json` and `en.json`, in exact lockstep, **authored in both languages with
equal care and never machine-translated**. English is a first-class mode, not a degraded afterthought. A
"why this match" explainer must read naturally in whichever language the user chose.

`ar.json` types the dictionary, which makes the two failure modes asymmetric: a key added only to
`en.json` is a TypeScript error at every use site, while one added only to `ar.json` type-checks and then
crashes English at render.

**Never bake UI text into an image.** It cannot flip and it cannot translate.

### 5.7 Copy rules that constrain layout

- **No em or en dashes in product prose**, in either language, and no hyphenated compounds where a
  rewrite works ("sign up", "Arabic native"). The one exception is the locked badge label
  "Suggested — confirm". CSS and file identifiers keep their hyphens.
- No hype, no AI writing tells, no invented statistics, no accuracy figure, no promise of a job.
- Errors say what went wrong and how to fix it, in a calm voice. They do not apologise and are never
  vague.

### 5.8 Test matrix

Before any bilingual surface ships, verify **both directions × both languages × light and dark**, at 360
/ 768 / 1280: layout integrity, bidi on mixed strings, numeral rendering, icon mirroring, Arabic
line-height and size, and keyboard order (which is itself RTL-aware). This is an acceptance criterion,
not a polish pass.

---

## 6. Impeccable and anti-slop directives

### 6.1 What Impeccable owns, and what it may not touch

`impeccable` owns **direction**: composition, hierarchy, visual world, information density, how bold a
surface should be, and critique. Load it *before* deciding what a surface should look like, not after.

It may not change: the palette, the typeface, the logo programme, the Hud fence, the voice, or the trust
rules. Everything else it says outranks in-house habit.

The same applies to the other installed skills. `emil-design-eng` and the animation skills own motion
craft, overridden by Itqan on exactly three things: RTL-safe direction, the Hud fence, and the evidence
fence. `apple-design` supplies gesture, spring and optical-typography craft without importing iOS chrome
into a bilingual web product. `ui-ux-pro-max` is a generic recommender for non-brand questions; where it
differs from these tokens, the tokens win.

### 6.2 Build this

- **Reach for the display tier.** A Stage headline is `--text-6xl` or `--text-7xl`. If the largest text
  on a marketing page is 36px, the page is not finished.
- **Compose depth**: two-part shadow plus `--rim-light` on every raised surface.
- **Alternate the ground.** Three of the five surfaces on any long page; one dark beat.
- **Place light off-centre.** 70%/20%, not 50%/50%.
- **Make the split unequal.** 7:5 beats 6:6. Let something break its container.
- **Give gold one confident job per view section**, and make it the right one.
- **Make everything respond.** Hover, press, focus. A page where nothing responds is dead regardless of
  how good the static composition is.
- **Use the second heading tier.** If a card title and a section title render at the same size and
  weight, the DOM has a hierarchy the eye cannot see.
- **Design with real content**: Arabic and English, long employer names, mixed-direction transcript
  lines. Lorem ipsum hides exactly the layout and bidi problems this product has.

### 6.3 Never build this

**The anti-cliché law (LOCKED).** Brains, circuit patterns, robot faces, glowing neural networks,
synthetic futurism — banned in every register, forever. The brand animal is a real bird with a real
cultural argument precisely so this line is never crossed.

Banned by the same logic:

- Purple-to-blue SaaS gradients, aurora backgrounds, floating 3D blobs, glassmorphism for its own sake.
- Emoji as iconography. Icon sets that mix two visual languages.
- A centred hero over a centred glow. Three equal feature cards. A stat row of invented numbers.
- Decoration on a surface a user acts on. A gradient behind a number.
- Motion that delays a task the user performs dozens of times a day.
- A straight-edged accent bar inside a rounded container.
- Unbounded line length on prose. A single blur standing in for elevation. A neutral grey shadow on warm
  paper.
- The blanket `animation-duration: 0.01ms !important` reduced-motion override.
- `#D08C2F`, in any form.

### 6.4 The blandness review

Run this alongside the accessibility check. **Each failure is a defect, reported the same way a contrast
failure is.**

1. Is there more than one ground colour on this page?
2. Is the type scale contrast at least 3:1 between headline and body — 4:1 on Stage?
3. Does any surface have layered elevation, or is every shadow the same single blur?
4. Is there texture, gradient or light anywhere, or is everything a flat fill?
5. Is gold doing one confident job, or is it sprinkled?
6. Does anything on the page respond to the pointer?
7. Is the composition centred and evenly divided throughout?
8. Is the restraint on this surface actually protecting evidence, or did it leak out of the fence onto
   chrome that could have been alive?
9. Would this be recognisable as Itqan with the logo removed?

If the honest answer to 9 is no, the surface is not finished, however cleanly it passes an audit.

### 6.5 The one test

Does this read **considered** or **generated**? A gradient chosen because this panel is the page's dark
beat is considered. A gradient because gradients look modern is generated.

---

## 7. Pre-ship checklist

**Values.** Every value is a semantic token — no raw hex, px, ms or curve in a component. No `#D08C2F`.
Gold is fill, accent and state only; text on gold is navy; gold hairlines and icons on light use
`--gold-700`; gold emphasis text is `--gold-800`.

**Type.** Rubik only. Arabic body at 400, no `letter-spacing` on Arabic, `--leading-arabic` and
`--font-scale-arabic` applied. Prose held to `--measure`. Display tier used where the register calls for
it.

**Depth.** More than one ground. Layered elevation with rim light. Texture, gradient or light present.
Scale contrast met. Gold doing one job. The blandness review passed.

**States.** All five screen states and all eight interaction states. No meaning in colour alone. Press
state on every pressable element.

**Accessibility.** 4.5:1 body, 3:1 large text and UI. Keyboard-operable with visible focus. Labelled
inputs. 44px targets. Reduced motion via the scalars plus a per-component swap.

**Direction.** Logical properties throughout. Verified in both directions × both languages × light and
dark, at 360 / 768 / 1280. Bidi isolation on every mixed string.

**Trust.** Every extracted value carries its confidence. Every recommendation carries its `why` and a
real source. Nothing invented. The Hud fence and the evidence fence both hold.

**Rendered.** A design change is not done until it has been rendered and looked at. Typecheck, build and
a clean detector prove no defect was *detected*; they do not prove the result is good. A dashboard once
shipped with a progress track 12px off its markers and a fill overshooting by 45px, through three commits
that passed every automated check. If a global utility or a token changed, `grep` the class and open
every screen that consumes it.

---

## Appendix A: sources audited and merged

**Merged into this document** (these remain in place as skill payloads; this file is the precedent):

| File | What it contributed |
|---|---|
| `.claude/skills/itqan-design-system/SKILL.md` | Token architecture, locked brand rules, the pre-ship visual checklist |
| `.claude/skills/itqan-design-system/references/tokens.css` | The complete token set — colour, type, spacing, radius, elevation, material, motion |
| `.claude/skills/itqan-design-system/references/depth-and-materials.md` | The register model, the nine sources of visual life, material recipes, gold budget, the blandness review |
| `.claude/skills/itqan-design-system/references/components.md` | Component specs and their eight states |
| `.claude/skills/itqan-ux-craft/SKILL.md` | Screen states, laws of UX, forms and microcopy, responsive strategy, product patterns |
| `.claude/skills/itqan-ux-craft/references/rtl-bilingual.md` | Bidi, mirroring rules, numerals, Arabic typography craft, the test matrix |
| `.claude/skills/itqan-motion/SKILL.md` | Motion registers, easing decisions, RTL-aware motion, the performance floor |
| `.claude/skills/itqan-ui-review/SKILL.md` | The routing table and the locked/unlocked boundary |
| `.claude/skills/itqan-brand/SKILL.md` | Mission, personality, the anti-cliché law, the Hud fence, copy constraints |
| `itqan-website/CLAUDE.md` | Site locked rules, the dash rule, tokens-only mandate, verification workflow |
| `Onboarding/CLAUDE.md` | App locked rules, the RTL exceptions that bite, the motion scalar contract, verification |
| `itqan-website/MOTION.md` | The site's catalogued microinteractions |
| `Onboarding/src/styles/{tokens,app,chrome,global,map}.css` | Real layout, density, grid and container-query decisions, with their reasons |
| `itqan-website/src/styles/{tokens,global,forms}.css` | Container widths, section rhythm, the eight form states |
| `PRODUCT.md`, root `CLAUDE.md` | Positioning, pricing, the four questions, the not-a-translation-engine rule |

**Audited and deliberately not merged**: `BACKEND.md`, `LEGAL-BRIEF.md`, `itqan-website/PLACEHOLDERS.md`,
`README.md`, `tools/brand_voice.md`, `.claude/skills/impeccable/**`, `.agents/skills/**`,
`.github/skills/**` (a duplicate of `.claude/skills/impeccable`). None of these owns a design value.

**Three copies of `tokens.css` remain in lockstep** — the skill's, the site's, and the app's — with one
documented deviation (`--color-text-muted`) that this document ratifies. Do not collapse them without a
build step to distribute the file.

---

## Appendix B: what was loosened, and why

The unshackling had already started: `depth-and-materials.md` exists because the system was
over-corrected once, and it says so in its first paragraph. But the permissions it granted never reached
the code — `--text-6xl`, `--text-7xl`, `--gradient-gold`, `--glow-field-navy` and `--ease-overshoot` are
each used **zero times** across both apps, and `--radius-xl` once. Permission that nothing consumes is
not a loosened rule. These changes turn permissions into defaults.

| # | Was | Now | Why |
|---|---|---|---|
| 1 | Two registers, assigned **by route**: any page containing a verdict was "product register — hairlines, one shadow step, flat fills, no delight" | **Three registers by surface** (Stage / Passage / Workspace) plus an **evidence fence scoped to components** (§3.4) | This is the root cause of "sterile". The dashboard's section headers, empty states and page ground inherited a rule written for confidence scores. Restraint now follows the data, not the route. |
| 2 | Display sizes *permitted* on marketing | **A Stage headline is `--text-6xl`/`--text-7xl`. 36px is a defect there.** | Scale contrast is the cheapest visual life a system has, and the tier was going entirely unused. |
| 3 | "One gold anchor per **viewport**" | One gold anchor **per view section**; state, chip and hairline gold do not count against it | A viewport is a screen size, not a design unit. On a tall dashboard the old wording forbade a gold accent in the chrome *and* on the CTA. It is a hierarchy rule, not a quota. |
| 4 | `--space-24` / `--space-32` as the universal section rhythm | **Register-scoped spacing scales** (§3) | 128px between dashboard sections wastes a workspace; 32px between marketing sections makes a hero look cramped. Density is a decision, not a constant. |
| 5 | Only symmetric grids shipped (`.grid--2`, `.grid--3`), while the docs asked for asymmetry | **Asymmetric splits are first-class in all three registers**, with the container-query rules that make them safe | The toolkit contradicted the rule. Equal thirds are now explicitly a default rather than a decision. |
| 6 | Confidence badge "never animates in, **in any register**" | It **never gets an entrance of its own**, but may fade in as part of its container | The absolute banned even the parent's fade, which made badges pop. The trust intent — it must read as fact, not as a reveal — is fully preserved. |
| 7 | `--ease-overshoot` "licensed, not banned" | **The default for Passage entrances** of non-evidence objects; still barred inside the fence | Licensed and unused is the same as banned. |
| 8 | `--measure` applied as a global prose clamp | **Binds paragraphs. Tables, grids, chip rails and dashboard rows are exempt.** | A data table clamped to 68ch is precisely the hospital look. |
| 9 | One radius for everything in practice | **Radius carries hierarchy**: bigger, more expressive surfaces take `--radius-xl` | A free hierarchy signal was being thrown away. |
| 10 | Workspace read as "product register", i.e. as *plain* | **Workspace is dense, not flat** — same material vocabulary at tighter spacing, with the sidebar as the dashboard's dark beat | Density and flatness were conflated. Linear is dense and unmistakably crafted; that is the target. |
| 11 | The generic design skills were once described as not applying, since Itqan had "already locked style" | **Locked is six things.** Composition, hierarchy, density, depth, scale, boldness and choreography are open, and the specialist skill usually wins there | Stated in `itqan-ui-review` already, and it did not propagate. It is now in the precedence block at the top of this file. |

**Nothing locked was loosened.** The palette, the gold contrast rules, Rubik, the Arabic typography
rules, the Hud fence, the trust rules, the anti-cliché law, the reduced-motion mechanism and the WCAG AA
floor are all carried over unchanged.

---

## Appendix C: open decisions and known defects

**Awaiting the lead's sign-off**

- `--color-success` — the brand has no success hue. If rejected, success states carry icon and label
  only.
- `--color-accent-ink` for gold emphasis text on light.

**Defects found during this audit, since fixed**

- `--leading-snug` was consumed by `Onboarding/src/styles/chrome.css:128` and **defined in no token
  file**, so the declaration was invalid at computed-value time and Hud's bubble copy fell back to
  `normal`. Added at 1.35 to all three copies.
- `--font-mono` was consumed with an inline fallback in `VerifyPage.astro` and was not in the token set.
  Added; the fallback in the component was removed with it.
- `--color-text-muted` still shipped the AA-failing `var(--navy-300)` in the skill's copy while both apps
  carried a corrected value. Fixed upstream, which retires the documented three-way deviation. **All
  three `tokens.css` copies are now byte identical**, and the notes in `Onboarding/CLAUDE.md`,
  `itqan-website/MOTION.md`, `Onboarding/README.md` and `app.css` that described the deviation or the
  contrast failure were corrected with it.

One consequence is left open on purpose: `.subhead` and a few other lines on paper or sand still take
`--color-text` because muted used to fail there. They now have a legitimate muted option. Moving them is
a hierarchy decision for the lead, not a defect.

**Still TBD from the brand programme**

- The layout grid, the sub-32px icon, three of the four Hud poses, and the real reversed marks.
- `itqan-brand`'s reference files (`voice-writing.md`, `logo-program.md`, `hud-mascot.md`) are cited but
  not installed. If a locked detail is missing, **ask — do not invent a token, a lockup, a pose or a
  rule.**

`itqan-website/PLACEHOLDERS.md` lists every missing asset and placeholder value with its owner. Check it
before assuming something needs building.
