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
anchor. Two are looking for a first job and one is switching; the product serves both, and copy that
addresses only new graduates leaves out half the audience.

- **Maryam** — unemployed Omani IT graduate. The anchor user. Arrives demoralised. **Leaves for good if
  the first screen shows deficits.** Needs capability before gaps, jobs before analysis, Arabic first.
- **Yusuf** — international graduate needing a Gulf sponsor. **Leaves if the product is Arabic-only or
  dishonest about visas.** Needs co-equal English, "why this match" everywhere, non-GCC transcripts that
  parse. The power user who reads the methodology.
- **Nasser** — in work, underemployed, switching into a different role, and actively AI-skeptic.
  **Leaves permanently on one unverifiable claim.** Needs radical transparency, zero hallucination, no
  hype language, a visible "how this works". He is also the switcher: his experience counts for more
  than his job title says, and nothing may assume he is starting from zero.

**Out of scope as a product surface:** the institutional buyer. A university career office is a
*distribution channel*, not a user. No admin or cohort-analytics dashboard is being built. Revisit only if
a paying institution makes it a signed condition.

## Product Purpose

Build the most trusted AI-powered career-development platform, optimised for the Arabic language and the
realities of the Arab world, while remaining globally competitive.

The operative word is **trusted**, not smartest. When accuracy and trust conflict, trust wins: an honest
"suggested — confirm this" beats a confident guess. A gap analysis that is 85% right and shows its working
is worth more than one that is 95% right and cannot be checked.

Success for the marketing site is one thing only: a stranger creates a free account.

**Pricing.** The parts that get someone into work are free and stay free: where they stand, the path,
the job matches and the advisor. A premium tier covers extended use of the AI. Never write an absolute
like "free forever" or "no payment at any point"; they were true of an earlier model and are not now.

"Extended use" is two allowances, decided 2026-08-21. Free is **one document rescan a week and 30
messages a day** with Hud; paid is **three rescans a week and 90 messages a day**. The paid tier raises
only these — it does not put any of the four answers behind a payment. The profile screen shows a person their own
consumption against these limits, never the price list — the tier comparison belongs on a plan page of
its own. The contract behind it is [`BACKEND.md`](BACKEND.md) §4; where it is unavailable, no screen may
show a usage number at all.

## Positioning

Itqan does not attack unemployment in the aggregate. It attacks the **distance between where someone is
and the role they actually want** — a distance nobody measures for them, so they discover it only after
months of applying and hearing nothing.

**The pain, in the user's own terms:** confusion, and time lost. They are applying to hundreds of roles
that were never a fit, cannot tell which are worth the evening, and have nobody telling them what to fix
first. Itqan exists to narrow that, not to hand them another list.

It starts from where they want to go, not from a job listing. They name a target role, or Itqan suggests
roles they are already close to. Then it answers four questions in order:

1. **Where do I stand today?**
2. **Which role should I aim for?**
3. **What is the shortest path there?** In real courses and certifications.
4. **Which jobs can I apply to now?** Matched to that position and their stated preferences.

Every answer is measured against **live regional demand and what those openings currently ask for**, not
a generic checklist of what a role is supposed to need, and every one carries its reason and a real
source.

**Reading the documents is how the measuring starts. It is not the product.** An earlier pitch called
Itqan a translation engine, and that framing keeps resurfacing in copy. Turning a course into a skill is
one step inside question one. The product is the position, the goal, the path, and the fit.

**The thesis a neighbouring product could not truthfully copy:** the commercial opportunity is not the
unemployment rate — it is that Gulf nationalisation policy turns placing nationals in real roles into a
mandatory, funded institutional workflow, and no one is doing it against live regional demand.

**Scope boundary.** Itqan is a *career navigator* — not a job board, not a course shop, not a CV parser.
Anything that does not help someone see the distance to the role they want, or close it, is out of scope.
Beachhead Oman; expansion Saudi Arabia.

## Operating Context

- The user uploads whatever they already have: a CV, certificates, an academic record. Often mixed
  Arabic and Latin, often a phone photo of variable quality. The CV is the one required document. **Document upload and gap-analysis reading are desktop-favoured** and must be
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

  **Exception, added 2026-08-17: the Hud chat surface.** The assistant is named after him, so he is
  present throughout it, including alongside recommendations. This was decided deliberately, with the
  conflict on the table, and it is not a rule that drifted. Do not "correct" it back.

  The exception is bounded, and the boundary is what keeps the fence's original argument intact.
  **Hud may talk, but nothing actionable lives in his prose.** The moment an answer becomes something
  to act on it is handed over as its own card carrying its own evidence: `why this match`, a real
  source with its retrieval date, and an honest confidence label. Jobs and courses render through the
  same `MatchCard` and `CourseCard` the rest of the product uses, so the trust rules cannot drift on
  this screen independently of the others. A score or a match written into his sentences breaks the
  exception rather than using it.

  That separation is the point rather than a technicality: the hoopoe of An-Naml carried a report that
  was verified before anyone acted on it, which is exactly the relationship this surface asks the user
  to have with it.

  **One Hud on screen at a time**, and never one per message. The chat screen mounts exactly one
  instance and moves it between the greeting and the page header as state changes. The 120px floor
  still applies, so on a narrow screen mid-conversation he steps aside rather than shrinking; one is a
  ceiling, never a quota.

  The fence is unchanged everywhere else — he stays off the dashboard, the profile screen, the job
  match card in its own right, the OCR confirmation screen and `/proof`.
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
3. **Show the working.** "Because your documents show X" beats "our AI determined Y". Every claim carries
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
