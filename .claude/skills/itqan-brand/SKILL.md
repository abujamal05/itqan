---
name: itqan-brand
description: >
  Itqan's brand identity — mission, positioning, personality, the hoopoe logo programme and its lockups,
  Hud the mascot, the three users it serves, and the voice it writes in. Use WHENEVER working on anything
  Itqan-branded: placing or scaling the logo, choosing a lockup, adding or restricting the mascot, writing
  UI copy, microcopy, headlines, CTAs, error messages, landing pages, decks, social posts or emails; naming
  a feature; judging whether an illustration or visual is on-brand; asking "does this feel like Itqan?"; or
  checking a decision against Maryam, Yusuf or Nasser. Triggers on: logo, lockup, wordmark, clear space,
  misuse, mascot, Hud, hoopoe, tone of voice, brand personality, positioning, tagline, copywriting. Owns
  IDENTITY, MARKS, MASCOT and VOICE — not design values, interface behaviour or animation.
---

# Itqan Brand

This skill owns **who Itqan is and how it speaks**. The three sibling skills own the rest:

| Need | Skill |
|---|---|
| A colour, font, spacing, radius, depth or motion **value** | `itqan-design-system` |
| How a screen should **behave** (states, forms, errors, RTL, a11y) | `itqan-ux-craft` |
| How something should **move** | `itqan-motion` |
| Design **strategy and direction** — composition, hierarchy, how bold to go | `impeccable` |
| Aesthetic taste in general | generic `frontend-design` |

Never restate values from those skills here. Reference them.

**What this skill locks, and what it does not.** Identity, the marks, the mascot fence, the anti-cliché law
and the voice are locked. Composition, layout, depth, material, boldness and how a page is put together are
**not** — those belong to `impeccable` and the design system. Treating the whole of design as locked is what
produced flat, lifeless work; this skill's job is to keep Itqan *itself*, not to keep it plain.

## Files in this skill

| File | Read it when |
|---|---|
| `references/logo-program.md` | Placing, scaling, recolouring or reviewing the logo; choosing a lockup; checking clear space or misuse |
| `references/hud-mascot.md` | Adding, drawing, animating or restricting the mascot |
| `references/voice-writing.md` | Writing any user-facing words at all |
| `references/audience.md` | Any decision that should be checked against a real user; personas and the journey map |
| `references/trust-architecture.md` | Designing anything that displays AI output — matches, gaps, confidence, pathways |
| `references/delivery-pitfalls.md` | Planning, scoping or reviewing team delivery |
| `assets/README.md` | Looking for a logo file — the manifest and naming convention |

---

## 1. Mission

**Build the most trusted AI-powered career-development platform — optimised for the Arabic language and
the realities of the Arab world, while remaining globally competitive.**

The operative word is **trusted**, not smartest. When accuracy and trust conflict, trust wins: an honest
"suggested — confirm this" beats a confident guess. This single sentence explains why the mascot is
banned from verdict screens, why every recommendation links to a real source, and why affiliate
commissions are refused.

A gap analysis that is 85% right and shows its working is worth more than one that is 95% right and
cannot be checked.

## 2. Positioning

Itqan does not attack graduate unemployment in the aggregate. It attacks the **structural mismatch
between what a transcript says and what a labour market rewards** — the gap where a graduate cannot
translate "Database Systems II" into the word a recruiter searches for, "SQL".

**The thesis:** the commercial opportunity is not the unemployment rate — it is that Gulf nationalisation
policy turns skills-translation into a mandatory, funded institutional workflow, and no one is automating
it in Arabic.

**Scope boundary.** Itqan is a *translation* engine — not a job board, not a course shop. Anything that
does not help a graduate read their own evidence more accurately is out of scope. Beachhead Oman;
expansion Saudi Arabia.

## 3. Personality

Four traits in priority order. Where two conflict, the earlier wins.

1. **Mastery (إتقان)** — the name means doing something with excellence and care. Precision, not flourish.
2. **Intelligence** — demonstrated by the quality of reasoning shown, never by claiming to be clever.
3. **Craftsmanship** — considered, not generated. Every detail deliberate.
4. **Approachability** — warm and plain-spoken. The user arrives demoralised; never add distance.

### The anti-cliché law — LOCKED

No brains, circuit patterns, robot faces, glowing neural networks, or synthetic futurism — **ever**. The
work should read *considered, not generated*. This is why the brand animal is a real bird with a real
cultural argument rather than an abstract AI motif.

Applies to: illustration, iconography, imagery, deck design, social graphics, loading states, and any
generated visual. Also banned by the same logic: purple-to-blue SaaS gradients, glassmorphism for its own
sake, floating 3D blobs, aurora backgrounds, emoji as iconography.

**Considered is not the same as plain.** This law bans a *vocabulary*, not ambition. Read literally as
"remove things", it produced exactly the failure it was written to prevent: flat, shadowless, single-surface
pages that read as generated because nothing in them was chosen. Itqan's users are graduates in their
twenties and the product must feel like a sharp modern tool. Depth, gradient, texture, scale contrast and
motion are all on the table — see `itqan-design-system/references/depth-and-materials.md`. The test is
whether each choice has a reason: a dark section because the page needs a beat is considered; a gradient
because gradients look modern is generated.

## 4. Audience — check every decision against three people

They fail in different directions, which is the point.

- **Maryam** — unemployed Omani IT graduate, the anchor user. Leaves if the first screen shows deficits.
  → *Lead with capability. Jobs before gaps. Arabic-first.*
- **Yusuf** — international graduate needing a Gulf sponsor. Leaves if the product is Arabic-only or
  dishonest about visas. → *Co-equal English. "Why this match" everywhere. Non-GCC transcripts must parse.*
- **Nasser** — underemployed AI-skeptic. Leaves permanently on one unverifiable claim.
  → *Radical transparency. Zero hallucination. No hype language.*

Full personas, research findings and the six-stage journey map: `references/audience.md`.

**Out of scope:** the institutional buyer persona. A university career office is a *distribution channel*,
not a product surface. No admin or cohort-analytics dashboard is being built. Revisit only if a paying
institution demands it as a signed condition.

## 5. The marks — essentials

The mark pairs the **hoopoe** with a bilingual wordmark: Arabic إتقان above Latin *itqan*. Both scripts
are always present in the full lockup. Arabic is not a translation of the brand — it **is** the brand.

Five rules that must never be broken. Everything else: `references/logo-program.md`.

1. **Spelling.** The Arabic must read **إتقان** — hamza beneath the alif. Never اتقان. For a brand whose
   promise is Arabic-native mastery, a misspelled name is the most quietly damaging error available.
   Verify at full size with a native reader before anything ships.
2. **The reversal rule.** On any dark surface, use the **reversed monochrome** lockup — never the
   full-colour one. *Verified by compositing the real asset onto navy:* the wordmark, crest tips, eye and
   beak are all navy and vanish entirely, leaving only the gold crest — a broken bird with no name.
3. **Clear space.** 25% of the lockup's height on every side; 20% for the icon. Nothing enters it.
4. **Minimum sizes.** Full lockup 140px wide; icon 24px, 32px preferred.
5. **Never** stretch, squash, recolour, rotate, add effects to, crowd, or place the mark on a busy
   background or on full-strength gold.

Approved colourways: **full colour**, **monochrome navy**, **reversed (paper on dark)**. No others.

The full-colour mark carries the brand gold **`#F39F1C`** and navy `#071055`. The previous gold `#D08C2F`
is retired — any asset still carrying it needs re-exporting, and its presence in code is a defect rather
than a variant.

## 6. Hud the mascot — the scope rule is the whole point

Hud is a **hoopoe** — هدهد — the messenger-scout of Solomon in Surah An-Naml, who travels where no one
else can see, finds what is hidden, and *brings the news back*. That is what Itqan does to a transcript.
The mascot is **an argument, not a decoration**: culturally resonant for the core user, native to Oman,
and free of every AI cliché the brand bans.

### LOCKED: Hud never appears beside a trust-critical moment

A cartoon bird next to a verified result reframes evidence as a cute guess — exactly what the skeptical
user rejects. Research found respondents named "AI-powered where it's not needed" and "forcing AI on
everything" as reasons they distrust a tool.

| Hud belongs | Hud is forbidden |
|---|---|
| Marketing and landing pages | Gap-analysis verdicts |
| Onboarding | Confidence scores |
| Empty states | Real job matches |
| The pipeline wait (scanning pose) | Data tables |
| Genuine success milestones | The OCR confirmation screen |
| Errors, with empathy | **Anything a user will act on** |

This is not a style preference. Breaking it costs the product its moat. Full spec — personality, poses,
motion, drawing rules: `references/hud-mascot.md` (not yet written; work from this section and ask).

### LOCKED: where Hud is allowed, use the ANIMATED version

Hud is a messenger-scout who travels, finds and returns. A frozen bird contradicts the whole argument — and
in practice a still figure gets *looked at* while an animated one is *glanced at*, which is the behaviour the
mascot is supposed to produce. A static mascot is the clearest single signal that a surface was assembled
rather than designed.

- **Default to the animated clip.** `public/mascot/{pose}.webm` with a `{pose}.png` poster; the `Hud.astro`
  component picks the pair up automatically. Poses shipped today: `flying-in`, `idle`, `waving`, `thinking`,
  `analyzing`, `error`. Source masters are in `Hud Animations MP4/`.
- **Prefer arrival then settle** — a play-once pose handing over to a loop (`flying-in` → `idle`) reads as a
  character; an immediate bare loop reads as a decorative GIF.
- **The still is a failure path, not a design choice.** It is correct in exactly four cases: WebKit
  discarding the clip's alpha channel, playback that never starts, alpha lost on another engine, and
  `prefers-reduced-motion`. Never ship the poster because it was easier.
- **Animation does not buy him entry anywhere.** The fence above is unchanged, and he must not even *transit*
  a trust-critical region on his way somewhere else.

Choreography, pose-to-moment mapping and the loading rules live in `itqan-motion`.

## 7. Voice — essentials

Itqan speaks like **a knowledgeable person who refuses to oversell.** Calm, plain, specific. It never
performs enthusiasm and never hides a limitation to look more capable.

Three rules that govern everything:

1. **Lead with capability.** Say what the user has before what they lack.
2. **Show the working.** "Because your transcript shows X" beats "our AI determined Y".
3. **Be honest about limits.** Naming a constraint builds more trust than hiding it. Honesty converts;
   hype loses.

**Never write:** revolutionary, magical, seamless, effortless, game-changing; "AI-powered" as a selling
point; *missing / deficient / unqualified*; vague hedges like "might be a good fit".

**Always available:** "suggested — confirm this" for anything below threshold; "why this match" as the
standing name for the evidence chain; "you already have…" for capabilities, "unlock" for gaps.

Sentence case everywhere. Active voice. Buttons name the outcome ("See my matches", never "Submit").
Arabic and English are both *authored*, never translated. Full system: `references/voice-writing.md`.

## 8. Displaying AI output

Anything that shows a match, gap, confidence or recommendation is governed by the trust architecture —
four sequential agents whose errors compound (four stages at 90% ≈ 73% end-to-end). Every stage must
expose its own uncertainty rather than passing a clean-looking answer downstream.

Non-negotiables when designing these surfaces:

- Every match links to the **live source** with its retrieval date.
- Every recommendation carries a specific **"why this match"** evidence chain.
- Anything below threshold is labelled **"suggested — confirm"**, never stated as fact.
- The **human-confirmation screen** (user edits extracted courses) runs before anything downstream.
- **No fabricated courses, ever.** Recommend only from a verified catalogue.
- **No accuracy figure may be published that has not been measured.**

Detail: `references/trust-architecture.md`.

## 9. Brand review checklist

Run before anything ships.

- [ ] Arabic wordmark reads **إتقان** with the hamza — checked at full size
- [ ] Correct lockup for the surface; reversed monochrome on anything dark
- [ ] Clear space respected — 25% of lockup height, 20% for the icon
- [ ] Logo not stretched, recoloured, rotated, shadowed or crowded
- [ ] Brand gold is `#F39F1C`; **no retired ochre `#D08C2F` anywhere** — grep before shipping
- [ ] Hud absent from every verdict, score, match, table and confirmation screen
- [ ] Where Hud does appear, he is **animated**, not a still poster
- [ ] No AI clichés — no brains, circuits, robots or neural glow
- [ ] Not bland: more than one ground colour, real depth, scale contrast, something responds to the pointer
      (run the blandness review in `itqan-design-system/references/depth-and-materials.md`)
- [ ] No hype vocabulary; every claim has evidence behind it
- [ ] Capability leads; deficit never leads
- [ ] Checked against all three users, not just the anchor one

## 10. Open decisions — do not invent these

Marked TBD deliberately. If work requires one, **flag it and ask**; do not quietly author it.

Vision statement · brand archetype · vector (SVG) masters · Arabic-only and Latin-only lockups ·
sub-32px simplified icon · three of four Hud poses (scanning, celebrating, empathetic) · UI icon style
system · layout grid · photography direction · Arabic grammar conventions (punctuation, numerals, dates,
bidi strings) · social and email templates · Rubik's Arabic weight coverage (a verification, not a
decision — if a weight is missing in Arabic, remove it from the system entirely) · pipeline accuracy
figures (blocked on validating 20–30 real transcripts).
