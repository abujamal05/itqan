# Depth, Material and Visual Life

This file exists because the system was over-corrected. In trying to avoid AI slop, the rules were
tightened until "clarity before decoration" was being read as "remove everything", and the output came
back flat: white cards, one shadow, one gold, no texture, no scale contrast, nothing that suggests a
person made it. **Restraint is a budget, not a prohibition.** A restrained interface spends its visual
budget on few things and makes each of them excellent. It does not spend nothing.

Itqan's users are graduates in their twenties. The product must read as a *sharp, modern tool* — the
register of Linear, Raycast, Arc, Vercel — not as a government portal. Trustworthy and lifeless are not
the same thing, and the aesthetic-usability effect means the flat version is actually trusted *less*.

## The two registers

Every Itqan surface sits in one of two registers. Get this right first; most "it feels wrong" reports are
a surface built in the wrong register.

| | **Product register** | **Expressive register** |
|---|---|---|
| Where | Verdicts, matches, confidence, gap analysis, data tables, the OCR confirmation screen, forms, settings | Marketing and landing pages, onboarding, empty states, error states, success milestones, the gap moment |
| Feels like | Precise, quiet, fast, dense, factual | Confident, dimensional, warm, paced |
| Depth | Hairlines, one shadow step, flat fills | Gradients, glows, layered shadows, texture, large type |
| Motion | Under 200ms, no overshoot, no delight | Up to 700ms, overshoot allowed, staggering, choreography |
| Hud | Forbidden | Welcome, animated |
| Gold | Accent and state only, sparing | Can carry a whole surface |

**The locked trust rules apply in both.** Expressive never means inventing a statistic, dropping a
source link, hiding a confidence score, or putting a cartoon bird next to a result. It means the parts of
the product that are *not* evidence are allowed to be beautiful.

## The nine sources of visual life

When a design comes back bland, it is almost always missing several of these. Work down the list.

### 1. Scale contrast
The cheapest and most under-used. A page whose largest text is 36px reads like a form. Use `--text-6xl`
and `--text-7xl` on marketing surfaces and let the jump from headline to body be dramatic — a 4:1 or 5:1
ratio, not 1.5:1. Pair it with `--tracking-tight-latin` on Latin display type, because large type sets too
loose by default. Never on Arabic.

### 2. Layered shadow, not one blur
`--shadow-*` are all two-part: a tight key shadow for the contact edge plus a wide soft ambient shadow for
the room. A single `0 4px 12px` is the tell of a default template. Compose with `--rim-light` for the 1px
top highlight that makes a surface read as an object rather than a coloured rectangle.

```css
.panel {
  background: var(--gradient-paper);
  box-shadow: var(--shadow-lg), var(--rim-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}
```

### 3. Gradient over flat fill
On large surfaces only — heroes, CTA panels, navy sections, gold buttons. Never behind body copy.
`--gradient-navy` on a dark panel does more for perceived quality than any amount of extra copy.

### 4. Texture on the canvas
`--texture-dot` at `--texture-dot-size` on the page background, or `--texture-hairline` inside a well. A
canvas with a whisper of structure never reads as an empty div. Keep it near-invisible: if you can see the
dots without looking for them, halve the opacity.

### 5. Off-centre light
`--glow-field-gold` and `--glow-field-navy` are radial washes for hero and CTA grounds. **Position them
off-centre.** A glow centred behind a headline is the single most recognisable stock-template move; the
same glow at 70%/20% reads as intentional lighting.

### 6. Surface variety
The system now ships five surfaces: `--color-surface`, `--color-surface-sunken`, `--color-surface-warm`,
`--color-surface-inverse`, and the page `--color-bg`. A long page that uses one of them is why it feels
monotonous. Alternate ground between sections; put at least one inverse (navy) section on any long page so
the eye gets a beat.

### 7. Edges that mean something
`--color-border-accent` (`--gold-700`) is a gold hairline that actually clears the 3:1 non-text floor on
paper — the brand `--gold` does not (it measures 2.0:1) and must never be a meaningful border on light.
Use accent edges to mark the one thing that matters on a screen, and hairlines everywhere else.

### 8. Asymmetry and overlap
Centred everything is the default that reads as generated. Let a figure break its container, let a card
overlap a section edge, let a two-column split be 5:7 rather than 6:6. In RTL the emphasis side flips —
use logical properties so it does.

### 9. Motion with a point of view
Covered by `itqan-motion`, but it belongs on this list: a page where nothing responds is a page that feels
dead regardless of how good the static composition is.

## Composing a surface: the material recipes

**Raised card (product register)**
```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-sm);
```

**Feature panel (expressive register)**
```css
background: var(--gradient-paper);
border: 1px solid var(--color-border);
border-radius: var(--radius-xl);
box-shadow: var(--shadow-lg), var(--rim-light);
```

**Navy section — the page's dark beat**
```css
background: var(--gradient-navy);
color: var(--color-text-on-navy);
box-shadow: var(--rim-light-dark);
/* layer the glow on a pseudo-element so text stays above it */
&::before { content: ''; position: absolute; inset: 0; background: var(--glow-field-gold); }
```
Remember the reversal rule: the logo on this surface is the reversed monochrome lockup, never full colour.

**Gold CTA**
```css
background: var(--gradient-gold);
color: var(--color-text-on-gold);      /* navy, always — 8.1:1 with #F39F1C */
box-shadow: var(--shadow-md), var(--rim-light);
/* :hover adds --glow-gold. Reserve --glow-gold-strong for the one primary CTA on the page. */
```

**Glass header**
```css
background: var(--glass-bg);
backdrop-filter: blur(var(--glass-blur));
border-block-end: 1px solid var(--glass-border);
```
Always ship the real background colour with the filter — `backdrop-filter` alone collapses to transparent
where it is unsupported.

**Warm accent section**
```css
background: var(--color-surface-warm);   /* --gold-50 on light */
```
The gentlest way to change ground without introducing a new hue.

## Gold: how much, and where

The failure mode in both directions is real. Too little and the brand disappears into navy-and-white
corporate. Too much and it reads as a discount banner.

- **One gold anchor per viewport.** The primary CTA, or the accent panel, or the marker — not all three.
- Gold **fills** (buttons, badges, chips, panels) carry navy text at 8.1:1. Safe and strong.
- Gold **hairlines and icons** on light must use `--color-border-accent` / `--gold-700`, never `--gold`.
- Gold **text** on light: only `--color-accent-ink` (`--gold-800`, 5.4:1), only for emphasis and small
  headings, never for body copy. The brand gold as body text stays locked out.
- Gold **glow** marks emotional peaks — the gap moment, a success milestone, the primary CTA on hover.
  Not a hover effect for every card.
- On dark, `--color-accent` lifts to `--gold-400` automatically. Do not hand-pick a tone.

## What still counts as slop

The anti-cliché law has not moved, and this file does not license any of it:

- Brains, circuit patterns, robot faces, neural glow, synthetic futurism — banned, in every register.
- Purple-to-blue SaaS gradients, glassmorphism for its own sake, floating 3D blobs, aurora backgrounds.
- Emoji as iconography. Icon sets that mix two visual languages.
- Decoration that carries no meaning on a surface a user acts on.
- Motion that delays a task the user does dozens of times a day.
- Centred hero, centred glow, three equal feature cards, a stat row with invented numbers.

The test is the brand's own: does this read **considered** or **generated**? A gradient chosen because
this panel is the page's dark beat is considered. A gradient because gradients look modern is generated.

## Reviewing for blandness

Add these to any visual review. Each one failing is a defect, reported the same way a contrast failure is.

1. Is there more than one ground colour on this page?
2. Is the type scale contrast at least 3:1 between the headline and body?
3. Does any surface have layered elevation, or is every shadow the same single blur?
4. Is there texture, gradient, or light anywhere, or is everything a flat fill?
5. Is gold doing one confident job, or is it sprinkled?
6. Does anything on the page respond to the pointer?
7. Is the composition centred and evenly divided throughout?
8. Would this be recognisable as Itqan with the logo removed?

If the honest answer to 8 is no, the surface is not finished — regardless of how cleanly it passes the
audit.
