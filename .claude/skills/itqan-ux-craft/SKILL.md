---
name: itqan-ux-craft
description: >
  Itqan's UI/UX craft knowledge base — how any Itqan interface must BEHAVE, and what an experienced
  product designer never forgets. Use WHENEVER designing, building, reviewing or critiquing any Itqan
  screen, flow, component or interaction; when structuring a page or navigation; when handling forms,
  validation, errors, empty and loading states, responsiveness, accessibility, motion decisions or
  bilingual/RTL behaviour; or when deciding what a screen should DO — even when the request never says
  "UX". Supplies usability heuristics, the laws of UX, required screen-state and interaction-state
  coverage, accessibility practice, responsive strategy, RTL/bilingual engineering, microcopy and a design
  process, tuned to Itqan's users. Owns BEHAVIOUR and PROCESS; pull values from itqan-design-system,
  identity from itqan-brand, taste from frontend-design.
---

# Itqan UX Craft

This skill makes design decisions like a senior product designer who has shipped real interfaces — and
adapts that craft to Itqan's specific users and stakes. It owns **how interfaces behave and how to arrive
at them**. It does **not** own visual values: for a colour, font, spacing, radius, or motion value, read
`itqan-design-system` (`references/tokens.css`, `references/components.md`). For aesthetic direction, read
the generic `frontend-design` skill. Reference those; never restate them here.

**Why Itqan needs more than generic best practice:** its users are an unemployed graduate who leaves
forever if the first screen shows deficits (Maryam), a skeptic who churns on one unverifiable claim
(Nasser), and an international student who reads the methodology and needs true bilingual parity (Yusuf).
Generic UX gets you a competent app; these patterns get you a *trusted* one. When a general principle and
an Itqan product pattern (below) tension, the product pattern wins.

---

## 1. Design process — how to approach any screen
Don't jump to layout. Work in this order:
1. **Job of the screen.** State the single most important thing the user must accomplish here, and who
   they are (which persona). One primary job per screen; one primary action.
2. **Content & data first.** What real content and data appear? Design with real strings (Arabic +
   English, long employer names, mixed-direction transcript lines), never lorem ipsum — fake content
   hides real layout and bidi problems.
3. **All states before polish.** Enumerate the five screen states and the interaction states (§3) *before*
   styling the ideal one. The ideal state designed alone is the #1 cause of awkward UI.
4. **Hierarchy.** Make the primary action visually dominant; everything else recedes. In RTL, hierarchy
   reads from the top-right.
5. **Direction before styling.** Decide what this surface should *feel* like and how bold it may be —
   load `impeccable` for that, and `itqan-design-system/references/depth-and-materials.md` for which of the
   two registers applies. Skipping this step is how a screen ends up correct and characterless.
6. **Then apply the visual system** (tokens/components) and **then critique** against the checklists (§8)
   *and* the blandness review in `depth-and-materials.md`.

## 2. Usability heuristics (Nielsen/NN-g — apply, don't recite)
Visibility of system status (always show what's happening — parsing, matching, saved). Match between
system and the real world (speak the graduate's language, not the system's). User control and freedom
(undo, back, cancel; escape hatches). Consistency and standards (same word for same thing everywhere).
Error prevention (stop the mistake before it happens — constrain, confirm destructive actions). Recognition
over recall (show options; don't make users remember). Flexibility (shortcuts for the Yusuf power user,
guidance for the Nasser newcomer). Aesthetic and minimalist design (every element earns its place).
Help users recognise/recover from errors (plain-language, actionable — see §6). Help and documentation
(a visible "how this works", especially for skeptics).

## 3. State coverage — the senior/junior tell (REQUIRED)

**Five screen states (the UI Stack — Scott Hurff).** Every screen/data view must design all five:
- **Ideal** — populated, everything working. Designed first, but not alone.
- **Empty** — no data yet. An invitation to act, never a dead blank. (First-time upload, no matches yet.)
- **Loading** — show progress, not just a spinner; users tolerate ~30s only when they see work happening
  (relevant to the A→B→C→D pipeline). Use skeletons for content shape.
- **Partial** — sparse/low-confidence data. Don't let it look broken; guide the next step. (Few matches;
  low-confidence parse lines.)
- **Error** — something failed. Explain what and offer recovery; never a dead end or a scary code.

**Eight interaction states** for every interactive element:
`default · hover · focus-visible · active/pressed · disabled · loading · selected · error`.
Visuals for each live in `itqan-design-system/references/components.md`. Missing one is a defect.

## 4. Laws of UX (use as design pressure, cite when useful)
- **Fitts's Law** — bigger/closer targets are faster; primary actions get size and reach; min 44×44px touch.
- **Hick's Law** — more choices = slower decisions; reduce options per step (fewer job filters shown at once).
- **Jakob's Law** — users expect Itqan to work like the sites they already use; don't reinvent standard
  patterns without reason.
- **Miller's Law** — chunk information (~5–7 per group); group skills, matches, and gaps.
- **Aesthetic–Usability Effect** — polished UI is perceived as more usable and more trustworthy. This is
  load-bearing for Itqan, not a nicety: a flat, lifeless interface is trusted *less* by the skeptic, not
  more. "Clarity before decoration" ranks the two; it does not delete the second. Never a substitute for
  actually working.
- **Peak–End Rule** — users remember the peak and the end; make the "gap moment" (the correct transcript
  translation) and the end of the flow feel great.
- **Doherty Threshold** — keep response under ~400ms where possible; where impossible (the pipeline),
  animate the wait so it feels responsive.

## 5. Accessibility practice (WCAG AA is the floor)
- **Contrast:** ≥ 4.5:1 body text, ≥ 3:1 large text and UI/graphical elements. Verify (the locked rule:
  gold is never body text on light). Values come from the design system; the *obligation* lives here.
- **Never colour alone** — pair every state with icon/label/shape (colour-blind users; the Nasser "see the
  evidence" rule).
- **Keyboard:** everything operable without a mouse; visible `focus-visible`; logical tab order (which is
  RTL-aware); no traps except intentional modal focus-traps that return focus on close.
- **Semantics:** real headings in order, labelled inputs (never placeholder-as-label), `alt` text, ARIA
  only when native HTML can't express it. Announce async changes (parsing done, matches loaded) to screen readers.
- **Targets & motion:** ≥ 44×44px touch targets; honour `prefers-reduced-motion` by **removing movement and
  keeping opacity/colour transitions at full duration**. The mechanism is the motion scalars in
  `tokens.css` plus a per-component swap; the blanket `animation-duration: 0.01ms !important` override is
  banned, because a user who asked for less movement still needs an interface that responds. This skill
  decides *whether* to animate; for *how* to choreograph and implement motion (registers, RTL-safe
  patterns, the pipeline-wait sequence, component recipes, the animated mascot), use `itqan-motion`.

## 6. Forms & microcopy
- One clear label above every field (visible, not placeholder). Ask only for what's needed.
- **Validate at the right time:** on blur or submit, not on every keystroke; show success quietly, errors
  clearly. Never wipe a user's input on error.
- **Error messages** say *what went wrong and how to fix it*, in the interface's calm voice — never a code,
  never blame, never "invalid". Errors don't apologise and are never vague.
- **Empty states** give direction and one clear next action. **Buttons** name the exact outcome ("See my
  matches", not "Submit") and keep that name through the flow (button "Upload" → toast "Uploaded").
- Bilingual: author every string in Arabic and English with equal care (see rtl reference).

## 7. Responsive strategy (Itqan-specific)
Itqan is a **responsive web app**, mobile-accessible but with a deliberate exception: its two core tasks —
**document upload and gap-analysis visualisation — are desktop-favoured** and must be full-fidelity on a
large screen (uploading a PDF and reading a multi-axis gap chart are painful on a phone). **Job browsing is
the mobile-favoured surface.** So: design mobile-first for browse/notify, desktop-first for upload/analysis,
and make both work everywhere.
- Fluid, content-driven breakpoints (don't chase device sizes); test at ~360px, ~768px, ~1024px, ~1440px.
- Reflow, don't shrink: stack columns, don't just scale text down. Respect Arabic's larger line-height and
  size on small screens (density is worse in Arabic).
- Touch targets and spacing scale up on mobile; hover is not available — never hide essential actions
  behind hover.

## 8. Itqan product UX patterns (these are load-bearing — violating one breaks trust)
- **Lead with capability, not deficit (Maryam).** The first post-upload view shows a win — skills the user
  already has, jobs they qualify for — *before* any gap. Jobs and matched capability first, gaps second.
  Frame matches as "you qualify now"; show confidence as a number.
- **Show your work — provenance everywhere (Nasser).** Every recommendation links to its real source (live
  posting, real course). Nothing fabricated is displayable. A dead or invented link loses the skeptic permanently.
- **Honest confidence.** Below the trust threshold, label it "Suggested — confirm", never state it as fact.
  No hype language anywhere in the product.
- **Explain the match (Yusuf).** Every recommendation carries a "why this match" — the transcript→skill→
  posting evidence chain.
- **The OCR-confirmation step is the first trust moment**, not a chore: accurate, in-control, easy to
  correct, and it doubles as the consent checkpoint. Design its five states explicitly (see components.md).
- **Bilingual & RTL are first-class.** Read `references/rtl-bilingual.md` for any bilingual/RTL work — bidi
  on mixed transcript strings, mirroring rules, numerals, and Arabic typography.

## 9. Scope note
The admin / cohort-analytics dashboard is out of scope (B2C focus; the institution is a distribution
channel, not a product surface). Don't design admin/analytics UI unless a signed contract requires it.

## Pre-ship UX checklist
1. Screen job and primary action are singular and obvious; hierarchy reads correctly (top-right in RTL).
2. All five screen states designed; all eight interaction states present on every control.
3. Heuristics pass: status visible, errors preventable and recoverable, escape hatches exist, wording consistent.
4. Accessibility: contrast met, no meaning in colour alone, keyboard-operable, visible focus, labelled inputs, reduced-motion honoured.
5. Forms: validation timed right, errors actionable and kind, input never lost, buttons name outcomes.
6. Responsive: core tasks full-fidelity on desktop, browse works on mobile, nothing essential hover-only.
7. Bilingual/RTL: verified both directions × both languages × light/dark (see rtl reference).
8. Product patterns honoured: capability-first, provenance on every rec, honest confidence, why-this-match.
