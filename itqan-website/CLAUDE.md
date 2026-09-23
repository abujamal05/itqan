# CLAUDE.md — Itqan marketing website

Read this before touching anything here. Where it conflicts with a memory or a guess, this file and the
installed skills win.

## Read the apex documents first

This file holds the **local** rules: the stack, the commands, the gotchas and the verification for this
half. It does **not** hold the design system, and for a long time it never mentioned where that lives —
which is why `DESIGN.md` §3.1's hero rule was agreed and never built.

1. **[`../DESIGN.md`](../DESIGN.md) — wins on anything visual.** §3 registers and the evidence fence,
   **§3.5 mobile** (spacing table and length caps), §6 what to build and what never to, §7 pre-ship.
2. **[`../tools/itqan_voice.md`](../tools/itqan_voice.md)** (and `itqan_voice_ar.md`) — **wins on
   anything written**, in either language. The `itqan-content` MCP injects it verbatim.
3. **[`../PRODUCT.md`](../PRODUCT.md)** — product truth, when a claim needs checking.

Then this file, then the skill that owns the remaining decision (`itqan-ui-review` routes).

## What this is

The public site for **Itqan**, a career navigator for job seekers and job switchers in Oman and the Gulf.
Its one job: convince a stranger to create a free account.

The product answers four questions in order, and the site sells that, not a feature of step one:

1. Where do I stand today?
2. Which role should I aim for?
3. What is the shortest path there? In real courses and certifications.
4. Which jobs can I apply to now?

The pain is confusion and lost time: people applying to hundreds of roles that were never a fit. Every
answer is measured against live regional demand and carries its reason and a real source.

**Itqan is not a translation engine.** Turning a course into a skill is one step inside question one. An
earlier pitch led with it; if a page makes decoding a document the story, it is the superseded pitch.

**Pricing.** Most of what gets someone started is free and stays free: where they stand, the path,
their three strongest job matches, and the advisor. Premium opens the rest of the matches and raises
the daily token pool from **30 to 90**. It is 2.9 OMR a month, charged as $7.54 through Paddle.

**Tokens are ONE DAILY POOL, spent however the person likes**: a message costs 1, re-reading their
documents costs 19. There is no separate weekly rescan allowance any more and copy must not describe
one (decided 2026-08-25). Never write "free forever" or "no payment at any point", and never "nobody
pays to get hired" — that one is retired and now false.

**Scope stops at the sign up and log in pages.** The product itself is `../Onboarding/`. If a task feels
like product work, stop and ask.

## Stack and commands

Astro + TypeScript, static output. Plain CSS with design tokens. No Tailwind, no UI framework, no
component library. Client JS only where it earns its place.

```bash
npm install
npm run dev                  # http://localhost:4321  (config in .claude/launch.json)
npm run build                # static output in dist/
python scripts/audit.py src/ # phase-gate audit
```

**JS budget.** Astro inlines these scripts per page rather than emitting a shared bundle, so the cost is
per page view and is not cached across navigations. A content page is **2,857 bytes gzipped** (Hud's ask
panel is 752 of it); the three form pages carry 2,106 plus `form.js` at 1,344. Measure after any
`<script>` change rather than quoting those numbers:

```bash
node -e "const f=require('fs'),z=require('zlib');const h=f.readFileSync('dist/en/index.html','utf8');const s=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);console.log(z.gzipSync(Buffer.from(s.join('\n')),{level:9}).length)"
```

## Where things live

| Thing | Path |
|---|---|
| Every colour, size, spacing, radius, duration | `src/styles/tokens.css` — copied verbatim from the design-system skill |
| Base styles, fonts, buttons, reveal, utilities | `src/styles/global.css` |
| Form styles (8 interaction states) | `src/styles/forms.css` |
| All user-facing copy, per locale | `src/i18n/{ar,en}.json` — authored in both, never machine-translated |
| Form endpoints, site URL, app URL | `src/config.ts` |
| Page shell (head, hreflang, theme init, header, footer) | `src/layouts/Base.astro` |
| Route pages (thin wrappers) | `src/pages/{ar,en}/…` |
| Page bodies and components | `src/components/…`, `src/components/pages/…` |
| Mascot component + file contract | `src/components/Hud.astro` |
| Every microinteraction, catalogued | `MOTION.md` |

## Locked rules

- **Tokens only.** No raw hex, px, ms or curve values in components. The two `theme-color` metas in
  `Base.astro` are the sole literal-hex exception, suppressed with a reasoned pragma.
- **The brand gold is `#F39F1C`.** `#D08C2F` is retired and `audit.py` trips on it if it returns.
- **RTL is the base architecture.** Logical properties only: `margin-inline-start`, `inset-inline-end`,
  `text-align: start`, `padding-block`. Arabic is the default locale and the default design direction.
- **Bilingual parity.** Every string exists in both locale files, in exact lockstep. `ar.json` types the
  dictionary, so a key added only to `en.json` is a TS error at every use site, while one added only to
  `ar.json` type-checks and then crashes English at render. Wrap inline Latin runs in `<bdi>`.
- **No dashes in prose.** No em or en dashes, no hyphenated compounds where a rewrite works ("sign up",
  "Arabic native"). Both languages. The one exception is the locked badge label "Suggested — confirm".
  CSS and file identifiers keep their hyphens.
- **Copy follows [`../tools/itqan_voice.md`](../tools/itqan_voice.md).** Lead with capability, never
  promise a job, never lead with the technology. "No hype, no AI writing tells" used to be the whole rule
  here and it pointed nowhere — the ban list, the structural tells (contrast reflex, abstract subjects,
  choppiness, empty denials) and the *positive* voice all live in that file now. Read §4 and §8 before
  writing a string.
  **Warmth is not hype.** Positive, appealing, mildly stirring language is wanted; the ban is on the
  unearned claim. Ordinary interface words — "register", "your account", "log in", "settings" — are just
  words; they are only a problem when a *headline* leans on one instead of saying something specific.
  A directional arrow after a CTA is a UI affordance, not slop, where the control really means "travel".
- **The logo swaps in dark mode.** Full colour on light, reversed on dark, via
  `.brand-mark--light` / `.brand-mark--dark`.
- **Hud is fenced.** Allowed on marketing pages, onboarding, empty states, errors. **Never beside
  anything that looks like a result** — absent from the worked-example blocks and all of `/proof`. Never
  the logo or favicon. All appearances go through `Hud.astro`.
  **One exception:** the Hud chat panel (`HudChat.astro`), where the assistant is named after him. He
  greets and orients; he never states a verdict.
- **No invented statistics and no accuracy figure.** None has been measured.
- **The legal pages are now written, and that rule has changed.** `/privacy` and `/terms` carry a
  complete policy and a complete agreement as of 2026-08-24, on the lead's explicit instruction, to be
  taken to a lawyer for review rather than replaced by one. They are no longer under construction and
  must not say they are.
  **What still holds:** every factual claim in them is checkable against the product or against a
  vendor's published policy, and nothing in them may be softened into a promise the software does not
  keep. If you change what the software does with someone's data, the policy is part of that change.
  `privacyPolicyVersion` in `src/config.ts` is posted with the sign up consent and **must be bumped
  whenever the policy text changes**. `s.privacy.brief` stays in the locale files, unrendered, as the
  issue list for the lawyer; `../LEGAL-BRIEF.md` is the fuller version.
- **Motion:** `--motion-scale` is the live mechanism and components multiply their travel by it.
  `--reveal-rise` and `--hover-lift` are defined but unread; treat them as reserved.

## The audit, and the render check it does not replace

`python scripts/audit.py src/` — static checker for the itqan-ui-review rule families. Exit 1 on any
critical or high. Suppress a genuine specimen with a reasoned pragma, never by weakening a rule:

```
{/* itqan-audit-ignore-next-line: reason */}
```

It is static text analysis and cannot see a rendered page. **Passing it is necessary, never sufficient.**
Every rule in it is a *prohibition*, so a page that does nothing passes perfectly — that is the exact
failure this project hit. It also checks a **subset** of the voice file's bans, so a clean run does not
mean the copy is clean.

Follow with the render check: **375px first**, then 768 and 1280; both themes, both directions, keyboard
only. Phone width is where this site's surfaces actually fail, so checking it last means finding it last.
Then the 13-question blandness review in `../DESIGN.md` §6.4 — its questions 9 to 11 are the mobile ones,
and 12 is the one that stops "simple" being reported as a defect when it was a decision.

**Screenshots work. A timeout means you are addressing a background tab.** The pane only composites the
FRONTED tab. Starting a second preview server creates a new tab and fronts it, orphaning the one you were
using. Fix it with `tabs_context`, then `tabs_select <tabId>`, then capture.

DOM geometry via `javascript_tool` is a complement, not a substitute. It answers "is this 12px out of
alignment"; it cannot tell you a meter is ten times too long or a plural is wrong. When the two disagree,
trust the measurement over an eyeballed estimate from a scaled-down capture.

## Which skill owns which decision

Load the skill that owns the decision before making it. **On a LOCKED thing Itqan wins** — identity,
marks, palette, typeface, the Hud fence, the voice, the trust rules. **On anything else the specialist
skill usually wins.** Composition, hierarchy, depth, material, boldness and easing are *not* locked, and
treating them as locked is what produced flat, lifeless output once already. Read
`itqan-design-system/references/depth-and-materials.md` before styling any surface.

| Skill | Owns | Load when |
|---|---|---|
| **`../DESIGN.md`** (not a skill) | **Apex on anything visual** — registers, the evidence fence, mobile, depth, anti-slop, pre-ship | **First, always** |
| **`../tools/itqan_voice.md`** (not a skill) | **Apex on anything written**, both languages | **Before any string** |
| **itqan-brand** | Identity, logo programme, Hud, the three users, the three locked voice rules. **Locked.** | The logo; the mascot; "is this on brand" |
| **itqan-design-system** | Every design **value** — tokens, dark mode. **Locked.** | Any colour, size, spacing, radius, shadow, duration |
| **itqan-ux-craft** | Behaviour — screen states, forms, errors, a11y, RTL engineering | Structuring a screen or flow |
| **itqan-motion** | Motion choreography, easing, RTL-safe patterns, reduced motion | Animating or reviewing motion |
| **itqan-ui-review** | Routing and verification only | First, to pick a skill; last, to audit |
| **impeccable** | Design strategy and direction, and its scoped commands | Before deciding what a surface should look like |
| **Emil's skills** (`.agents/skills/`) | Motion implementation canon | Easing, springs, physicality, animation review |

`impeccable` never sets Itqan's palette, typeface, logo, mascot rules or voice. Emil's skills are
overridden by Itqan on exactly three things: RTL-safe direction, the Hud fence, and product-register
limits on trust-critical surfaces. `ui-ux-pro-max` is a generic recommender only; where it differs from
the tokens, use the tokens.

## Open decisions — flag and ask, do not invent

- **The voice is no longer an open decision.** `voice-writing.md` was never written and is not coming;
  [`../tools/itqan_voice.md`](../tools/itqan_voice.md) and `itqan_voice_ar.md` replaced it and are the
  apex for copy. `logo-program.md` and `hud-mascot.md` are still **not installed**; only the SKILL.md
  summaries exist. If a locked detail is missing there, ask.
- The skill's own `audit.py` and rulebook are not installed; `scripts/audit.py` is the stand-in.
- Layout grid, sub-32px icon, three of four Hud poses, and the real reversed marks are TBD.
- Pending design-system sign-off: `--color-success`, and `--color-accent-ink` for gold emphasis on light.

`PLACEHOLDERS.md` lists every missing asset, placeholder value and legal text with owners. Check it
before assuming something needs building.
