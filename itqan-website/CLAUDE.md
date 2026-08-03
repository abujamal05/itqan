# CLAUDE.md — Itqan marketing website

Read this first. It is the durable context for this project so a session does not have to re-derive it.
When it conflicts with a stale memory or a guess, this file and the installed skills win.

## What this is

A public marketing website for **Itqan**, an Arabic native career intelligence platform for graduates in
Oman and the Gulf. Its one job: convince a stranger to create a free account. Everything is free — no
pricing, no plans, no payment, ever. Do not imply otherwise anywhere.

**Scope stops at the sign up and log in pages.** The product (transcript upload, the AI pipeline,
results, dashboards, auth logic) is a separate application and is out of scope here. If a task feels like
product work, stop and ask.

## Stack and commands

- **Astro** + TypeScript, static output. Plain CSS with design tokens. No Tailwind, no UI framework, no
  component library. Client JS only where it earns its place (toggles, mobile menu, form validation,
  mascot player, scroll reveal). Total shipped JS is ~1KB compressed — keep it that way.
- Dev server config is in `.claude/launch.json` (name `itqan-website`, port 4321).

```bash
npm install
npm run dev                 # http://localhost:4321
npm run build               # static output in dist/
python scripts/audit.py src/    # the phase-gate audit (see below)
```

## Where things live

| Thing | Path |
|---|---|
| Every colour, size, spacing, radius, duration | `src/styles/tokens.css` — copied verbatim from the design-system skill. **Never invent or hardcode a value; reference a token.** |
| Base styles, fonts, buttons, reveal, utilities | `src/styles/global.css` |
| Form styles (8 interaction states) | `src/styles/forms.css` |
| All user-facing copy, per locale | `src/i18n/ar.json`, `src/i18n/en.json` — authored in both, never machine-translated |
| i18n helpers (locale, dir, alternate paths) | `src/i18n/index.ts` |
| Form endpoints, site URL, app URL | `src/config.ts` — the single place to point forms at the real API later |
| Page shell (head, hreflang, theme init, header, footer) | `src/layouts/Base.astro` |
| Route pages (thin wrappers) | `src/pages/{ar,en}/…`, `src/pages/404.astro`, `src/pages/index.astro` (redirect) |
| Page bodies and components | `src/components/…`, `src/components/pages/…` |
| Mascot component + file contract | `src/components/Hud.astro` |
| Logo/favicon/mascot assets | `public/logos/`, `public/` (favicons), `public/mascot/` |
| The audit script | `scripts/audit.py` |
| Every microinteraction, catalogued | `MOTION.md` — keep new motion consistent with it |

## Locked rules — do not relearn these each time

- **Tokens only.** No raw hex, px, ms, or curve values in components. The two `theme-color` metas in
  `Base.astro` are the sole literal-hex exception (HTML meta cannot read a CSS var) and are suppressed
  with a reasoned pragma.
- **RTL is the base architecture.** Logical properties only: `margin-inline-start`, `inset-inline-end`,
  `text-align: start`, `padding-block`, never physical `left`/`right`/`margin-left`/`text-align: left`.
  Arabic is the default locale and default design direction.
- **Bilingual parity.** Every string exists in `ar.json` and `en.json` (126 keys, kept in lockstep).
  Wrap inline Latin/mixed runs in `<bdi>`. Arabic body is weight 400, more line-height, never
  letter-spacing.
- **No dashes in prose.** No em or en dashes, no hyphenated compounds where a rewrite works ("sign up",
  "Arabic native", "first class"). Applies to both languages. The one exception is the design-system's
  locked badge label "Suggested — confirm"; skills win over the brief there. CSS/HTML/file identifiers
  keep their hyphens.
- **No hype / no AI writing tells.** See the banned lists in the brand voice and the brief. Lead with
  capability, never promise a job, never lead with the technology.
- **The logo swaps in dark mode.** Full colour on light, reversed on dark. Implemented via the
  `.brand-mark--light` / `.brand-mark--dark` pattern. Header uses the full horizontal lockup (team
  decision), footer and 404 too.
- **Hud (the mascot) is fenced.** Allowed on marketing pages, onboarding, empty states, errors. **Never
  beside anything that looks like a result** — he is absent from the worked-example blocks and the entire
  `/proof` page. Never the logo/favicon. All appearances go through `Hud.astro`; poses are assigned in
  the brief §9 table, nowhere else.
- **No invented statistics, no accuracy figure, no legal text.** None has been measured or drafted;
  writing one would break the core promise. Privacy/terms are structured placeholders for a lawyer.

## The audit (phase-gate)

`python scripts/audit.py src/` — static checker for the itqan-ui-review rule families (colour, brand,
RTL, a11y, states, motion, typography, copy). Exit 1 on any critical/high. `--severity high` shows only
ship-blockers; `--json` for CI. Suppress a genuine specimen with a reasoned pragma, never by weakening a
rule:

```
{/* itqan-audit-ignore-next-line: reason */}
/* itqan-audit-ignore-start: reason */ … /* itqan-audit-ignore-end */
```

**This is a local stand-in** for the skill's own `audit.py`, which is not installed here. It is static
text analysis and cannot see a rendered page. **Passing it is necessary, never sufficient** — always
follow with the render check: both themes, both directions, narrowest and widest widths, keyboard only.
On this project the browser-pane screenshot tool often times out; when it does, verify via DOM geometry
and computed styles (`javascript_tool`) instead of pixels, and say so.

## How to use the skills — READ THIS

The Itqan skills are the source of truth and split into clear roles. Load the one that owns the decision
before making it; do not answer a design question from memory when a skill owns it.

**When two sources conflict on a LOCKED thing, Itqan wins** — identity, marks, palette, typeface, the Hud
fence, the voice, the trust rules. **When they conflict on anything else, the specialist skill usually
wins.** Composition, hierarchy, depth, material, boldness, easing and physicality are *not* locked, and
treating them as locked is what produced the flat, lifeless output this system was corrected for in
August 2026. Read `itqan-design-system/references/depth-and-materials.md` before styling any surface.

### Authoritative — these DEFINE the locked things (obey, do not override)

| Skill | Owns | Load when |
|---|---|---|
| **itqan-brand** | Identity, voice, the logo programme, Hud the mascot, the three users. **The locked brand.** | Writing any copy; placing/scaling the logo; adding or restricting the mascot; any "is this on brand" call |
| **itqan-design-system** | Every design **value** — tokens for colour, type, spacing, radius, motion; dark mode. **The locked values.** | Choosing any colour/size/spacing/radius/shadow/duration; building or restyling any component |

### Guidance — these tell you HOW to build well (follow, they don't override brand/values)

| Skill | Owns | Load when |
|---|---|---|
| **itqan-ux-craft** | Behaviour and process — screen states, the 8 interaction states, forms, errors, accessibility, RTL/bilingual engineering | Structuring any screen or flow; forms; empty/loading/error states; responsive; a11y |
| **itqan-motion** | Motion choreography and implementation — the two registers, easing, duration, RTL-safe patterns, the animated mascot, reduced motion | Animating or reviewing motion of anything |
| **frontend-design** (generic) | General aesthetic taste | Broad visual direction, when nothing more specific owns it |

### Router / verifier

| Skill | Role |
|---|---|
| **itqan-ui-review** | Use **first** to decide which skill to read, and **last** to audit. Owns routing and verification only — no design values of its own. |

### Design strategy — impeccable (use it ALWAYS)

`impeccable` is installed at `.claude/skills/impeccable/` and is the **design strategy and direction**
authority for this project. Load it before deciding what a surface should look like — mode, visual world,
composition, hierarchy, how bold to go — and use its scoped commands (`critique`, `bolder`, `delight`,
`layout`, `typeset`, `animate`, `polish`, `audit`) rather than improvising.

- Product truth lives in the workspace-root `PRODUCT.md`, written by `/impeccable init`.
- It runs a design-detector hook after every UI file edit and on Stop. That is configured in
  `.claude/settings.local.json`; `/impeccable hooks status` reports it.
- **It never sets Itqan's palette, typeface, logo rules, mascot rules, or voice.** Those stay locked by
  `itqan-brand` and `itqan-design-system`. Everything else is its call.

### Motion craft — Emil Kowalski's skills

Installed at `.agents/skills/`, symlinked into `.claude/skills/`. These are the **implementation canon**
behind the easing and duration tokens; they do not compete with anything Itqan has locked.

| Skill | Use it for |
|---|---|
| **emil-design-eng** | The craft philosophy — easing, duration, physicality, springs, interruptibility, the invisible details |
| **review-animations** | Strict review of a diff's motion before shipping |
| **improve-animations** | A prioritised roadmap when a whole codebase's motion needs lifting |
| **find-animation-opportunities** | When a surface feels dead and you need to know what should move — and what shouldn't |
| **animation-vocabulary** | Naming an effect precisely before building it |
| **apple-design** | Gesture, spring, translucency, optical typography |

Itqan overrides them on exactly three things: RTL-safe direction, the Hud fence, and the product-register
limits on trust-critical surfaces. Everything else follows the canon.

### ui-ux-pro-max — general build helper ONLY

A general web-build design database (UI patterns, accessibility checklists, colour/type recommenders,
motion presets, chart types). **Its only job here is generic craft sanity-checking**, and `impeccable` now
covers most of what it was installed for.

- **Never** let it set or change Itqan's voice, brand identity, colour palette, typography, logo rules,
  or mascot rules.
- It is a *recommender*; Itqan has already made those choices. Where it suggests a style, palette, or
  font that differs from the tokens, **ignore it and use the tokens.**
- Rule of thumb: **it may inform HOW something is built; it never decides what Itqan looks like or sounds
  like.**

## Open decisions — do not invent these (flag and ask)

- The **brand reference files** the brief cites (`voice-writing.md`, `logo-program.md`, `hud-mascot.md`,
  etc.) are **not installed** — only the brand SKILL.md summaries exist. Work from those; if a specific
  locked detail is missing, ask rather than invent.
- The skill's own `audit.py` and its `rulebook.md` / `review-playbook.md` are **not installed**;
  `scripts/audit.py` here is the stand-in.
- Layout grid, sub-32px icon, three of four Hud poses, and the real reversed marks are TBD — see
  `PLACEHOLDERS.md`.
- **Pending sign-off in the design system:** the functional green `--color-success`, and the new
  `--color-accent-ink` (`--gold-800`) for gold-flavoured emphasis text on light.

## Palette revision — 2026-08-03 (NOT YET APPLIED TO THIS APP)

The final brand gold is **`#F39F1C`**. `#D08C2F` is **retired**, which resolves the long-standing
contradiction between the brand checklist and `tokens.css` — the checklist was right and the token was
stale. The skills have been updated; **this app has not.** `src/styles/tokens.css` still defines the old
gold and its old ramp, as does `Onboarding/src/styles/tokens.css`. Applying it is a separate, approved
piece of work — do not assume it has happened.

The same revision added a depth and material layer to the design system (layered shadows, rim light,
gradients, off-centre glows, texture, five surfaces, display type) and replaced the blanket
`prefers-reduced-motion` kill switch with motion scalars. None of that has reached this app's CSS either.

## Everything still pending

`PLACEHOLDERS.md` lists every missing asset, placeholder value, and legal text, with owners. Check it
before assuming something needs building.
