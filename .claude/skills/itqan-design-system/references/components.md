# Itqan Component Specs

Every interactive component must define all applicable **interaction states**:
`default · hover · focus-visible · active/pressed · disabled · loading · selected · error`.
Missing a state is the most common defect — treat this list as required, not optional.
Values below are semantic tokens from `tokens.css`; never hard-code hex.

Colour never carries meaning alone (WCAG + the Nasser rule): every state that
communicates something also needs an icon, label, or shape change.

**Register.** Specs marked **[E]** are the expressive treatment — marketing, onboarding, empty, error,
success. The plain spec is the product treatment and is the default on any trust-critical surface. Both are
defined in `depth-and-materials.md`; don't apply the expressive one to a results view.

**Depth.** Every raised component composes a two-part `--shadow-*` with `--rim-light`. A single blur with no
rim is what makes a card look pasted onto the page rather than sitting on it.

---

## Button

Three variants: **primary** (one per view, the main action), **secondary**, **ghost**.

**Primary**
- default: fill `--color-accent` (gold `#F39F1C`), text `--color-text-on-gold` (navy, 8.1:1), `--radius-md`, padding `--space-3 --space-5`, weight `--weight-medium`, `--shadow-sm` + `--rim-light`.
- **[E]** default: fill `--gradient-gold` instead of the flat accent; the primary CTA on a marketing page may also carry `--glow-gold`.
- hover: fill `--color-accent-hover`; `translateY(var(--hover-lift))` + `--shadow-md`, `--duration-fast --ease-out`. **[E]** adds `--glow-gold` fading in.
- focus-visible: 2px ring `--color-focus`, `outline-offset: 2px`. Never remove the outline.
- active: `scale(0.97)`, remove lift, `--duration-quick`. **Required on every pressable element** — a button with no press state reads as broken, not restrained.
- disabled: 40% opacity, `cursor: not-allowed`, no hover; keep it visibly a button.
- loading: replace label with inline spinner + keep width stable (no layout jump); disable pointer, keep focus.

**Secondary**: transparent fill, 1px `--color-border-strong`, text `--color-text`. **Ghost**: no border, text `--color-accent-ink` on light (the brand gold fails as text), tint `--color-accent-tint` on hover.

Gold on gold-hover keeps navy text — verify contrast holds if you ever darken the fill further.
Guard the hover lift behind `@media (hover: hover) and (pointer: fine)`.

## Input / Field

- default: bg `--color-surface`, 1px `--color-border`, text `--color-text`, radius `--radius-sm`, min-height 44px (touch).
- focus: border `--color-focus`, 2px ring at 20% focus colour.
- filled/valid: no green needed; a check icon + `--color-text` is enough.
- error: border `--color-danger`, helper text `--color-danger` **plus** an alert icon and a text message (never red border alone). Message says what's wrong and how to fix it.
- disabled: bg `--color-surface-sunken`, muted text.
- Label always visible above the field (never placeholder-as-label). RTL: label and text align to `start`; input `dir` follows content (see rtl-bilingual in the UX skill).

## Card / Surface

- bg `--color-surface`, radius `--radius-lg`, 1px `--color-border`, `--shadow-sm`, padding `--space-6`.
- hover (if interactive): `--shadow-md`, `--duration-base --ease-out`. Non-interactive cards do not hover.
- **[E] Feature panel:** bg `--gradient-paper`, radius `--radius-xl`, `--shadow-lg` + `--rim-light`,
  padding `--space-8`; hover lifts `var(--hover-lift)` to `--shadow-xl` and `--color-border-strong`.
- **[E] Navy beat:** bg `--gradient-navy`, text `--color-text-on-navy`, an off-centre `--glow-field-gold`
  on a pseudo-element beneath the content. Any logo on it uses the reversed monochrome lockup.
- A long page whose every card is the same flat white surface is a blandness defect — alternate ground
  between sections and give the page at least one dark beat. See `depth-and-materials.md` §6.

## Match Card (Itqan-specific — the product's core object)

Shows one job matched to the graduate. Must contain, in order for RTL reading (top-right first):
1. Role title + employer.
2. **Match confidence** — a badge (see below), never a bare number without label/icon.
3. The **"why this match"** affordance — the mapped evidence (transcript course → skill → posting requirement).
4. A **source link** to the live posting (provenance is mandatory; see UX skill).
- Capability framing: lead with what qualifies the user, not what's missing.

## Confidence Badge (Itqan-specific)

- high (≥ ~0.85): fill `--color-accent` (gold), text navy, check icon, label "Strong match".
- suggested (below threshold): outline style, `--color-text-muted`, dashed or question icon, label "Suggested — confirm". Never present low confidence as fact.
- Colour + icon + word together; a colour-blind user must read the state without hue.
- **Never animates in, in any register.** It must read as fact, not as a reveal. No glow, no overshoot,
  no stagger delay of its own.

## Capability Chip / Gap Chip (Itqan-specific)

- capability (a skill the user already has): `--color-accent-tint` bg, navy text, check icon.
- gap (a skill to acquire): `--color-surface-sunken` bg, navy text, plus icon. Framed as "unlock", not "missing".
- Distinct shapes/icons so the two never rely on fill colour alone.
- If a chip needs a visible edge on light, it is `--color-border-accent` (`--gold-700`), never the brand
  gold — the brand gold measures 2.0:1 on paper and fails the 3:1 non-text floor.

## Toast / Notification

- enter: slide from the inline edge + fade, `--duration-slow --ease-out`; exit ~20% faster. Use a CSS
  **transition**, not a keyframe — toasts stack rapidly and keyframes restart from zero on interruption.
- success uses check icon + text; error uses `--color-danger` + alert icon + text.
- auto-dismiss ≥ 5s for reads; never auto-dismiss anything the user must act on.
- surface: `--color-surface` + `--shadow-lg` + `--rim-light`, so it reads as floating above the page.

## Modal / Dialog

- overlay + panel animate as one unit (same duration/easing), panel scaling from `--reveal-scale-from`.
  **Never from `scale(0)`.** Modals keep `transform-origin: center` — they are not anchored to a trigger.
- panel: `--color-surface`, `--radius-xl`, `--shadow-xl` + `--rim-light`.
- focus trap; focus returns to the trigger on close; `Esc` closes; first focusable element receives focus on open.

## Popover / Dropdown

- scales from its **trigger**, not its centre: `transform-origin: var(--transform-origin)`.
  `--duration-fast --ease-out`. This is the detail nobody consciously notices and everybody feels.
- surface as Card, one elevation step above its parent.

## Tabs / Segmented control

- selected: `--weight-medium`, underline or fill `--color-accent`; **plus** `aria-selected` — not colour alone.
- high-frequency, so speed transitions up (`--duration-fast`).

## Transcript Upload + Confirm (Itqan-specific, the first trust moment)

- Upload zone: large drop target, clear accepted formats, desktop-optimised (uploading a PDF on mobile is friction).
- Parse → **confirmation screen**: the extracted course list, editable inline, shown before anything downstream runs. Make correction obvious and low-effort. This screen doubles as the consent checkpoint — surface the consent control here, not buried.
- States to design explicitly: empty (nothing uploaded), loading (parsing — show progress, users tolerate ~30s only when they see work happening), partial (some lines low-confidence — flag them for review), error (unreadable scan — offer re-upload/retake, never a dead end), ideal (clean parse, confirm to proceed).
- **Hud is forbidden on the confirmation screen** — it is the first trust moment and a mascot beside an
  extracted-data table reframes evidence as a guess. He is welcome on the empty and error states.

## Hud (the mascot)

Not a decorative image — a fenced component. Identity and the fence live in `itqan-brand` §6; choreography
in `itqan-motion`.

- **Animated by default.** `{pose}.webm` + `{pose}.png` poster. The still is a fallback for WebKit alpha
  loss, refused autoplay, alpha lost elsewhere, and reduced motion — never a design choice.
- Sizes are fluid ranges, not fixed px: `sm clamp(120px, 16vw, 140px)`, `md clamp(140px, 22vw, 180px)`,
  `lg clamp(160px, 30vw, 250px)`. Below 120px he becomes visual noise.
- Decorative: `aria-hidden`, empty `alt`, never the sole carrier of meaning.
- Sits on a contact shadow (a blurred navy radial, not a `drop-shadow` filter — filters rasterise at the
  composited layer's resolution and band on iOS). The shadow inverts on dark.
- Plays only in the viewport; pauses outside it. Above-the-fold instances load eagerly.
- **Forbidden:** verdicts, confidence scores, real job matches, data tables, the OCR confirmation screen,
  the logo, the favicon, and anything a user will act on.

## Page ground / Section

Not a component so much as the thing that decides whether a page has life at all.

- Canvas: `--color-bg` with `--texture-dot` at `--texture-dot-size` on a `body::before` layer.
- **Alternate ground between sections.** The system ships five surfaces (`--color-surface`,
  `--color-surface-sunken`, `--color-surface-warm`, `--color-surface-inverse`, `--color-bg`); a long page
  that uses one of them is monotonous by construction.
- **[E]** Give any long page at least one navy beat and one off-centre `--glow-field-*`. A glow centred
  behind a headline is the stock-template move; the same glow at 70%/20% reads as intentional lighting.
- Section rhythm uses `--space-24` / `--space-32`. Generous vertical gaps are what let a page breathe.
- Body copy is held to `--measure`. Unbounded line length is the most common slop tell.
