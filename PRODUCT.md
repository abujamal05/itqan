# Product

<!-- impeccable:product-schema 1 -->

Workspace-level product truth for **Itqan**. Both front-ends in this workspace inherit it:
`itqan-website/` (public marketing site) and `Onboarding/` (the onboarding app). The AI pipeline itself is
a separate application and is out of scope for both.

Sources: `itqan-website/CLAUDE.md`, the `itqan-brand` skill, `itqan brief v1.1.pdf`, and the confirmed
answers of 2026-08-03. Nothing here is inferred from a template.

## Platform

web

## Stack

Established, not chosen here. `itqan-website/` is Astro + TypeScript, static output, plain CSS with design
tokens — no Tailwind, no UI framework, no component library, ~1KB shipped JS. `Onboarding/` is React +
Vite, structured so the view layer can be lifted to React Native later. Both consume the same
`src/styles/tokens.css`, copied from the `itqan-design-system` skill.

## Users

Three people, who fail in different directions. Every decision is checked against all three, not just the
anchor.

- **Maryam** — unemployed Omani IT graduate. The anchor user. Arrives demoralised. **Leaves for good if
  the first screen shows deficits.** Needs capability before gaps, jobs before analysis, Arabic first.
- **Yusuf** — international graduate needing a Gulf sponsor. **Leaves if the product is Arabic-only or
  dishonest about visas.** Needs co-equal English, "why this match" everywhere, non-GCC transcripts that
  parse. The power user who reads the methodology.
- **Nasser** — underemployed, actively AI-skeptic. **Leaves permanently on one unverifiable claim.**
  Needs radical transparency, zero hallucination, no hype language, a visible "how this works".

**Out of scope as a product surface:** the institutional buyer. A university career office is a
*distribution channel*, not a user. No admin or cohort-analytics dashboard is being built. Revisit only if
a paying institution makes it a signed condition.

## Product Purpose

Build the most trusted AI-powered career-development platform, optimised for the Arabic language and the
realities of the Arab world, while remaining globally competitive.

The operative word is **trusted**, not smartest. When accuracy and trust conflict, trust wins: an honest
"suggested — confirm this" beats a confident guess. A gap analysis that is 85% right and shows its working
is worth more than one that is 95% right and cannot be checked.

Success for the marketing site is one thing only: a stranger creates a free account. Everything is free —
no pricing, no plans, no payment, ever, and nothing may imply otherwise.

## Positioning

Itqan does not attack graduate unemployment in the aggregate. It attacks the **structural mismatch between
what a transcript says and what a labour market rewards** — the gap where a graduate cannot translate
"Database Systems II" into the word a recruiter searches for, "SQL".

**The thesis a neighbouring product could not truthfully copy:** the commercial opportunity is not the
unemployment rate — it is that Gulf nationalisation policy turns skills-translation into a mandatory,
funded institutional workflow, and no one is automating it in Arabic.

**Scope boundary.** Itqan is a *translation* engine — not a job board, not a course shop. Anything that
does not help a graduate read their own evidence more accurately is out of scope. Beachhead Oman;
expansion Saudi Arabia.

## Operating Context

- The graduate uploads a real transcript (PDF or a phone photo of one), often mixed Arabic/Latin, often a
  scan of variable quality. **Transcript upload and gap-analysis reading are desktop-favoured** and must be
  full-fidelity on a large screen. **Job browsing is the mobile-favoured surface.**
- The pipeline runs four sequential agents (parse → extract skills → match jobs → build pathway) taking
  ~20–60 seconds. Errors compound: four stages at 90% is roughly 73% end to end, so every stage must expose
  its own uncertainty rather than passing a clean-looking answer downstream.
- A **human confirmation screen** — the user edits the extracted course list — runs before anything
  downstream. It is the product's first trust moment and doubles as the consent checkpoint.
- Users arrive from a public marketing site whose scope stops at the sign-up and log-in pages.

## Capabilities and Constraints

- **Bilingual and RTL-native.** Arabic is the default locale and the default design direction, not a mirror
  bolted on. Every string is authored in both languages, never machine-translated. Logical CSS properties
  only.
- **Provenance is mandatory.** Every match links to the live source with its retrieval date. Every
  recommendation carries a specific "why this match" evidence chain. No fabricated courses — recommend only
  from a verified catalogue.
- **Honest confidence.** Anything below threshold is labelled "Suggested — confirm", never stated as fact.
- **No published accuracy figure may be one that has not been measured.** None has been.
- Terminology that is fixed: "why this match" for the evidence chain; "you already have…" for
  capabilities; "unlock" for gaps; never *missing / deficient / unqualified*.
- Deliberately undecided: layout grid, sub-32px simplified icon, UI icon style system, photography
  direction, Arabic grammar conventions (punctuation, numerals, dates, bidi strings), social and email
  templates, vision statement, brand archetype.

## Brand Commitments

Binding. Owned by the `itqan-brand` and `itqan-design-system` skills; summarised here so product work does
not have to re-derive them.

- **Name and mark.** The Arabic must read **إتقان** — hamza beneath the alif, never اتقان. The mark pairs a
  hoopoe with a bilingual wordmark; both scripts always appear in the full lockup. On any dark surface, the
  reversed monochrome lockup — never the full-colour one.
- **Palette (final, 2026-08-03).** Navy `#071055` (ink and primary brand), gold `#F39F1C` (fill, accent,
  state only), paper `#FAF8F3`, sand `#EEE6D8`, maroon `#820000`. `#D08C2F` is **retired** and is a defect
  wherever it appears. The brand gold is never body text on light.
- **Typeface.** Rubik only, Arabic and Latin. Hierarchy by weight and size alone. Never letter-space Arabic;
  Arabic body stays weight 400.
- **Hud the mascot** is a hoopoe — هدهد, the messenger-scout of Surah An-Naml. He is an argument, not a
  decoration. **Fenced:** allowed on marketing, onboarding, empty states, errors, the pipeline wait and
  genuine success milestones; **forbidden** beside any verdict, confidence score, real job match, data
  table, the OCR confirmation screen, or anything a user will act on. Where he is allowed, use the
  **animated** clip, not the still.
- **The anti-cliché law.** No brains, circuit patterns, robot faces, glowing neural networks or synthetic
  futurism, ever. The work reads *considered*, not generated.
- **Voice.** A knowledgeable person who refuses to oversell. Lead with capability; show the working; be
  honest about limits. Sentence case, active voice, buttons name the outcome. Banned: revolutionary,
  magical, seamless, effortless, game-changing, "AI-powered" as a selling point. No em or en dashes in
  prose, in either language.

## Evidence on Hand

- Real brand assets: logo lockups, icon and wordmark in `public/logos/` (webp, full-colour and reversed);
  source art and the build brief in the parent `Itqan/` folder.
- **Animated Hud clips exist and are the default**: `public/mascot/{pose}.webm` with `{pose}.png` posters,
  for `flying-in`, `idle`, `waving`, `thinking`, `analyzing`, `error`. Source MP4/MOV masters are in
  `Hud Animations MP4/`. The still is a fallback for WebKit alpha loss, refused autoplay, and reduced
  motion — not a design choice.
- **Absences future work must not fabricate:** no measured pipeline accuracy figure (blocked on validating
  20–30 real transcripts), no testimonials, no customer names, no benchmarks, no press, no drafted legal
  text. Privacy and terms are structured placeholders awaiting a lawyer. Three of four Hud poses and the
  brand reference files (`voice-writing.md`, `logo-program.md`, `hud-mascot.md`) are not yet written —
  work from the skill summaries and ask rather than invent.

## Product Principles

1. **Trust beats cleverness.** Every surface that shows AI output exposes its own uncertainty. An honest
   "suggested — confirm" beats a confident guess, always.
2. **Capability leads, deficit follows.** The first thing a graduate sees is what they already have. This
   is a product rule, not a copy preference — violating it loses the anchor user permanently.
3. **Show the working.** "Because your transcript shows X" beats "our AI determined Y". Every claim carries
   a source a skeptic can click.
4. **Arabic is the brand, not a translation.** Bilingual parity is architecture, not localisation.
5. **Considered, not generated — and considered is not plain.** The users are graduates in their twenties;
   the product must read as a sharp modern tool. Trustworthy and lifeless are not the same thing.

## Accessibility & Inclusion

WCAG AA is a floor and is never traded for aesthetics. Meaning is never carried by colour alone — every
capability, gap, confidence and error state also carries an icon, label or shape. Everything is
keyboard-operable with a visible focus ring and an RTL-aware tab order. Touch targets ≥ 44×44px. Labels are
always visible, never placeholder-as-label.

`prefers-reduced-motion` is honoured by **removing movement while keeping opacity and colour transitions**
— the blanket `animation-duration: 0.01ms` kill switch is banned, because a user who asked for less
movement still needs an interface that responds.
