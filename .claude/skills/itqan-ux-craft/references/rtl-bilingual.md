# RTL & Bilingual Engineering (Itqan)

Itqan is Arabic-first and bilingual, and its core content — transcripts and job postings — is inherently
mixed-direction (Arabic course titles beside English terms like SQL, React, "Data Engineer"). Getting
this wrong is *immediately* visible to native speakers and erodes trust, which is the one thing Itqan
cannot spend. This is craft, not translation.

## 1. Direction is a base architecture decision
- RTL is the default; LTR is the alternate. Build with **logical CSS properties** (`margin-inline-start`,
  `padding-inline-end`, `inset-inline-start`, `text-align: start`, `border-inline-*`) so one codebase
  serves both. Physical `left`/`right` are bugs waiting for the language toggle.
- Set `dir` on `<html>` and let it cascade. Per-element `dir` only for overriding mixed content (below).
- Lint for physical properties (a stylelint RTL plugin) and catch regressions with visual snapshots — RTL
  bugs are silent in an LTR dev environment.

## 2. Bidirectional (BiDi) text — the transcript problem
The Unicode bidi algorithm treats Latin runs and numbers as opposite-direction islands inside Arabic.
Left alone it *reorders* them wrongly. Fixes:
- Wrap inline English words, brand names, role titles, course codes, URLs, emails, and phone numbers in
  `<bdi>` or `<span dir="ltr">`. Without this, "خبرة في React وSQL" can render the English out of order.
- Phone/number sequences: `+968 …` must be isolated so bidi doesn't rearrange the digits.
- This applies directly to Itqan's parsed transcript lines and every job card — treat every mixed string
  as needing isolation, not as a rare edge case.

## 3. Numerals
- Western Arabic numerals (0–9) are standard across most Gulf UIs; Arabic-Indic (٠١٢٣) appear in some
  contexts. **Default Itqan to Western numerals** (job data, dates, match scores) and offer a preference
  only if a real user need appears — don't auto-convert.
- Numbers are read **left-to-right even inside RTL text** (they're weak-typed in the bidi algorithm).
  This is correct and expected; do not "fix" it by flipping them.

## 4. What mirrors vs. what does not
Mirror (flip for RTL):
- Overall layout, reading order (top-**right** first), navigation, breadcrumbs, pagination, sidebars.
- Directional icons: back/forward arrows, chevrons, progress arrows, "next step".
- Horizontal **bar** charts (bars grow from the right).

Do **not** mirror:
- Numbers, and numeric axes tied to time. **Line charts keep their LTR time axis** — time still moves
  rightward. This matters for any Itqan progress-over-time or trend visual.
- Media/playback controls, and universally-LTR concepts.
- Non-directional icons (search, settings, user, checkmark) — flipping them just looks broken.
- Logos and, generally, brand marks.
Rule: mirror *direction and flow*, not *meaning*. If an icon encodes real-world direction, flip it; if it
encodes a thing, leave it.

## 5. Arabic typography craft (interacts with the locked Rubik system)
- **Line-height:** Arabic needs ~1.6–1.8 vs ~1.4–1.5 Latin — diacritics (harakat) need vertical room.
  Use `--leading-arabic` on `[lang="ar"]`/`[dir="rtl"]` text.
- **Size:** Arabic glyphs read ~10–15% smaller at equal px. Apply `--font-scale-arabic` to Arabic body.
- **Weight:** bold Arabic body reads heavy (connected script, thick strokes). Keep Arabic body at 400;
  reserve 600–700 for short Arabic headings/labels only.
- **Letter-spacing:** never on Arabic — it severs the cursive joins and makes text unreadable. (Fine on
  Latin caps/labels if the design calls for it.)
- **Text in images can't flip or translate.** Keep all UI text as real text/CSS, never baked into an
  image, so both directions and both languages work.

## 6. Bilingual parity (the Yusuf requirement)
English is a first-class mode, not a degraded afterthought. Every screen, error, and empty state must be
authored in both Arabic and English with equal care. The transcript parser must accept non-GCC, English
transcripts without breaking. A "why this match" explainer must read naturally in whichever language the
user chose — not a machine-translated echo of the other.

## 7. Test matrix
Before shipping any bilingual surface, verify in **both directions × both languages × light/dark**:
layout integrity, bidi correctness on mixed strings, numeral rendering, icon mirroring, and Arabic
line-height/size. RTL correctness is a first-class acceptance criterion, not a polish pass.
