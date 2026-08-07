---
name: itqan-ui-review
description: >
  Itqan's design-intelligence router and automated auditor. Use FIRST, before any Itqan design work, to
  decide which knowledge to load — and LAST, before anything ships, to audit it. Trigger WHENEVER building,
  designing, restyling, reviewing, critiquing or debugging any Itqan interface, screen, component, page or
  visual; when asked to review, audit, check, polish, "make this look better", "is this on brand", "why
  does this feel off" or "find problems"; when writing HTML, CSS, React or Tailwind for Itqan; or when a
  design decision needs an authoritative source. Also: design review, UI audit, accessibility check,
  contrast check, WCAG, RTL check, design QA, pre-ship check. Routes to the other Itqan skills and runs
  scripts/audit.py to enforce the locked rules. Owns ROUTING and VERIFICATION only.
---

# Itqan UI Review

Two jobs, one at each end of the work:

1. **Route** — at the start, decide what to read, so a screen is built from the right rules rather than
   from memory.
2. **Verify** — at the end, prove it complies, mechanically and then visually.

This skill holds **no design values of its own**. It points at the four that do. If a value seems to be
defined here, that is a bug — go to the owning skill.

---

## 1. The router

Find the task. Read the listed files *before* producing anything.

| The task | Read, in order |
|---|---|
| **Starting any new screen** | `impeccable` (direction, mode, composition) → `itqan-ux-craft` (screen states, process) → `itqan-design-system/references/tokens.css` + `depth-and-materials.md` → this skill §3 |
| **Choosing a colour, size, spacing, radius, shadow** | `itqan-design-system/references/tokens.css`. Never invent a value. |
| **A surface that looks flat, safe or lifeless** | `itqan-design-system/references/depth-and-materials.md` → `impeccable bolder` / `delight` |
| **Depth, material, gradient, texture, elevation** | `itqan-design-system/references/depth-and-materials.md` |
| **Building a component** (button, card, form, badge, chip) | `itqan-design-system/references/components.md` → `itqan-ux-craft` for its states |
| **Anything with the logo** | `itqan-brand` §5 (`references/logo-program.md` is not yet written) |
| **Anything with the mascot** | `itqan-brand` §6 — check the forbidden zones *first*, then `itqan-motion` for the animated-Hud rules |
| **Writing any user-facing words** | `itqan-brand` §7 (`references/voice-writing.md` is not yet written) |
| **Animating anything** | `itqan-motion` (register, choreography, RTL) → `emil-design-eng` (craft) → tokens for values |
| **Reviewing existing animation** | `review-animations` for a diff, `improve-animations` for a codebase, `find-animation-opportunities` when a surface feels dead |
| **Arabic / RTL / bilingual work** | `itqan-ux-craft/references/rtl-bilingual.md` → `itqan-brand` §7 |
| **Loading, empty, error or partial states** | `itqan-ux-craft` → `itqan-motion` for the pipeline wait |
| **Displaying AI output** (matches, gaps, confidence, pathways) | `itqan-brand` §8. Non-negotiable. |
| **A decision that needs a user check** | `itqan-brand` §4 and `PRODUCT.md` — test against all three, not just Maryam |
| **Aesthetic direction in general** | `impeccable`, then generic `frontend-design` |
| **Scoping or planning delivery** | `itqan-brand` §10 open decisions and `PLACEHOLDERS.md` |

### Routing rules

- **When two sources conflict on a LOCKED thing, Itqan wins** — identity, marks, palette, typeface, the Hud
  fence, the voice, the trust rules. Always.
- **When they conflict on anything else, the specialist skill usually wins.** Composition, hierarchy, depth,
  boldness, easing, physicality and layout are not locked, and deferring to a thin in-house habit over
  `impeccable` or the Emil skills is how the output got bland.
- **When a value is missing, stop and ask.** Do not invent a token, a lockup, a pose, or a rule. The
  open-decisions list is `itqan-brand` §10.
- **Never answer a design question from memory** when a reference file owns it. That is how drift starts.

## 2. How the outside skills fit

The earlier version of this section said generic design tools "do not apply here" because Itqan had already
locked style, palette and font. That was half right and it did real damage: it was read as a licence to
answer every design question from in-house rules, and the in-house rules only cover *values*, not *design*.
The result was work that passed every check and looked like nothing.

What is locked: identity, marks, palette, typeface, the mascot fence, the voice, the trust architecture.
What is **not** locked, and never was: composition, hierarchy, information density, depth, material, scale,
boldness, choreography, and the decision about how much personality a surface should carry.

| Skill | Owns | Load it |
|---|---|---|
| **impeccable** | Design strategy and direction — mode, visual world, composition, critique, boldness | **Always**, before deciding what a surface should look like |
| **emil-design-eng** + `review-animations` / `improve-animations` / `find-animation-opportunities` | Motion craft and review | Any animation work, and before shipping it |
| **apple-design** | Gesture, spring, translucency, optical typography | Drag/sheet surfaces and depth work |
| **ui-ux-pro-max** | Generic craft checklists | Non-brand craft questions only; it is a recommender and Itqan has already chosen |

None of these may set or change a locked thing. All of them may — and should — improve everything else.

The other half Itqan needs from this category is **audit and enforcement**. That is §3.

## 3. The audit

### Run it

```bash
python3 scripts/audit.py <file-or-directory>          # human-readable report
python3 scripts/audit.py src/ --severity high         # only what blocks a ship
python3 scripts/audit.py src/ --json                  # for CI
```

Exit code is **1** if any CRITICAL or HIGH finding exists, so it can gate a commit or a build.

What it checks — full rule list, severity and rationale in `references/rulebook.md`:

| Family | Catches |
|---|---|
| **Colour** | Retired ochre `#D08C2F` (brand gold is `#F39F1C`), hardcoded hex bypassing tokens, off-palette values, brand gold used as text or as a meaningful hairline on light, white-on-gold |
| **Brand** | Arabic name missing the hamza, mascot beside a trust-critical surface |
| **RTL** | `margin-left`, `text-align: left`, physical offsets — anything that breaks Arabic |
| **Accessibility** | Removed focus rings, missing `alt`, placeholder-as-label, touch targets under 44px, missing `prefers-reduced-motion` |
| **States** | Interactive elements with no hover / focus-visible / disabled styling |
| **Motion** | Non-token durations, `ease-in` on UI, animating layout properties, the banned global reduced-motion kill switch, `scale(0)` entrances |
| **Typography** | Letter-spaced Arabic, bold Arabic body |
| **Copy** | Hype vocabulary, empty-verb CTAs |

### Suppressing a finding

Specimen content — a palette swatch showing literal hex, a deliberately-bad example — is legitimate.
Suppress it explicitly, never by weakening a rule:

```html
<!-- itqan-audit-ignore-next-line: intentional banned-contrast specimen -->
<!-- itqan-audit-ignore-start: swatch chips must show literal hex -->
<!-- itqan-audit-ignore-end -->
<!-- itqan-audit-ignore-file -->
```

Every suppression needs a reason after the colon. An unexplained pragma is a defect.

### What the audit cannot see — this matters

It is a **static text analyser**. It reads source, never a rendered page. It cannot catch:

- **Cascade and specificity bugs** — a modifier class silently losing to a base rule, so a tile renders
  on the wrong background. *This has actually happened on this project.*
- Layout collapse, overflow, inline elements that needed `display: block`
- Grid items landing in the wrong cells
- Visual hierarchy, crowding, balance
- Anything only visible in dark mode, at a breakpoint, or in RTL
- **Blandness.** Every rule in the audit is a prohibition, so a page that does nothing passes perfectly.
  This is the failure mode the project actually hit: clean audits, lifeless output. A static checker
  structurally cannot catch it — §4 step 5 is the only defence.

**Passing the audit is necessary and never sufficient.** A clean audit means no rule was broken; it says
nothing about whether the design is any good, and on this project a parse-level check once passed cleanly
while five visible defects shipped — including one in the very section that claimed to be verified.

## 4. Review workflow

1. **Route** — §1. Load the owning references *and* `impeccable` before building.
2. **Build.**
3. **Audit** — `python3 scripts/audit.py <path>`. Fix every critical and high. Triage the rest.
4. **Render check** — screenshot or open it. Light and dark. Narrow and wide. Keyboard-only once.
5. **Blandness check** — the eight questions in
   `itqan-design-system/references/depth-and-materials.md`. A failure here is a defect, reported like any
   other. If the surface would be unrecognisable as Itqan with the logo removed, it is not finished.
6. **Motion check** — `review-animations` over the diff if anything moves.
7. **User check** — walk it against Maryam, Yusuf and Nasser. Each fails differently.
8. **Brand check** — the checklist in `itqan-brand` §9.

Steps 3, 4 and 5 are not interchangeable. Skipping 4 is how visible defects shipped; skipping 5 is how the
flat work shipped.

## 5. Reporting a review

When asked to review something, structure the response as:

1. **Verdict** — one honest sentence. Not encouragement.
2. **Blocking** — critical and high findings, each with the rule, the location, and the fix.
3. **Worth fixing** — medium findings.
4. **Nits** — low.
5. **What could not be checked** — name it explicitly. If the render was not seen, say so.

Never report a clean audit as "this is good." Report it as "no rule violations found; the visual review
is still outstanding." The distinction is the whole point of this skill.

**Bland is a finding, not a matter of taste.** If the surface has one ground colour, one shadow blur, no
texture or gradient, a headline barely larger than its body copy, or nothing that responds to the pointer,
say so under **Blocking** with the specific fix from `depth-and-materials.md`. "It complies but it is
lifeless" is a legitimate and necessary verdict, and withholding it because everything technically passed is
how this system failed before.
