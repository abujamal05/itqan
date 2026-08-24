"""
Itqan content MCP — brand-constrained copy generation through Gemini.

WHAT THIS IS FOR. Itqan's copy is authored in two languages, both of them by
hand, and the fastest way to ruin it is to paste in something that reads as
generated. This server does not remove the human step; it front-loads the
constraints so the draft that arrives is already inside the brand, and then
hands it to Claude to judge. Generation is one half. The review loop in
`generate_brand_content`'s docstring is the other, and it is not optional.

THE RULESET LIVES IN `brand_voice.md`, NOT IN THIS FILE. One source of truth,
loaded at startup and injected verbatim. If someone edits the ruleset the
server picks it up on restart; if the file is missing the server REFUSES TO
START rather than falling back to a default it made up, because a silent
fallback here would generate confident off-brand copy that looks fine.

The `BANNED_*` lists below are a deliberate exception and a deliberate subset.
They exist only to FLAG obvious failures in the returned draft so the reviewer
knows where to look first. `brand_voice.md` is authoritative; a term absent
from these lists is not thereby allowed. The linter is a net, not the law.

Requires: fastmcp, google-genai. Key in GEMINI_API_KEY or GOOGLE_API_KEY.
"""

from __future__ import annotations

import os
import re
import statistics
import sys
from pathlib import Path
from typing import Any, Literal

from fastmcp import FastMCP

# --------------------------------------------------------------------------
# The ruleset
# --------------------------------------------------------------------------

BRAND_VOICE_PATH = Path(__file__).with_name("brand_voice.md")

try:
    # encoding is explicit ON PURPOSE. This file is developed on Windows, where
    # the default text encoding is cp1252, and the ruleset is roughly a third
    # Arabic. Reading it with the platform default raises UnicodeDecodeError at
    # best and mangles the Arabic silently at worst.
    BRAND_VOICE = BRAND_VOICE_PATH.read_text(encoding="utf-8")
except FileNotFoundError:  # pragma: no cover - startup guard
    raise SystemExit(
        f"itqan-content: {BRAND_VOICE_PATH} is missing. That file IS the brand "
        "ruleset; without it this server would generate unconstrained copy. "
        "Restore it from git rather than starting without it."
    )

# WHY NOT gemini-2.5-pro. It was the model this server was written against and
# it still appears in `models.list()`, but `generateContent` on it returns 404
# for a key created after Google closed it: "no longer available to new users.
# Please update your code to use models/gemini-3.1-pro-preview". The listing
# lies; the call does not.
#
# `gemini-3.1-pro-preview`, its named replacement, is not reachable either on
# the free tier: the quota is not a rate limit but a flat `limit: 0`, so no
# amount of retrying gets a request through. Pro needs billing enabled.
#
# SO THE DEFAULT IS FLASH, which is a compromise and worth naming as one. Pro
# is the better model for this job and the one originally specified. Flash is
# here because it RUNS, and a copywriter that 404s is worth nothing. With
# billing on, flip the env var and take the quality:
#
#     ITQAN_GEMINI_MODEL=gemini-3.1-pro-preview
#
# PINNED, NOT `gemini-flash-latest`/`gemini-pro-latest`. An alias that tracks
# the newest model would change the voice of generated copy underneath us with
# no commit and no diff to point at. Overridable for a deliberate switch, never
# a silent one.
MODEL = os.environ.get("ITQAN_GEMINI_MODEL", "gemini-3-flash-preview")

SYSTEM_INSTRUCTION = f"""\
You are the staff copywriter for Itqan. You are not an assistant helping with
copy: you are the person whose name is on it, writing the final line that
ships. You write English and Arabic to the same standard, and you author each
one rather than translating between them.

Everything below is your brief, your style guide and your list of hard
failures. Follow it exactly. A draft that breaks one banned item is a failed
draft no matter how good the rest of it is.

{BRAND_VOICE}

--- END OF RULESET ---

Two standing reminders, because they are the two that get forgotten:

1. Return ONLY the copy. No preamble, no explanation, no sign-off, no
   "Here's a draft". The response is pasted straight into a locale file.
2. Never invent a fact, a statistic, a customer, or an accuracy figure. If the
   brief cannot be written without one, return a single `BLOCKED:` line
   naming what is missing.
"""

# --------------------------------------------------------------------------
# The flagging net (a subset — see the module docstring)
# --------------------------------------------------------------------------

BANNED_EN = [
    "unleash", "elevate", "delve", "revolutionize", "revolutionise",
    "revolutionary", "seamless", "robust", "game-changer", "game changer",
    "game-changing", "tapestry", "testament", "power up", "supercharge",
    "streamline", "turbocharge", "effortless", "magical", "cutting-edge",
    "cutting edge", "empower", "leverage", "holistic", "harness", "bespoke",
    "in today's fast-paced", "in today's competitive", "in an era where",
    "take your", "to the next level", "unlock your potential",
    "transform your career", "we are on a mission", "imagine a world",
    "the future of", "at your fingertips", "say goodbye to", "dive in",
    "buckle up", "one-stop shop", "actionable insights", "more than just",
    "we've got you covered", "the ultimate guide", "join thousands",
    "ai-powered", "ai powered", "dream job", "get hired", "get you hired",
    "land the role", "land the job", "land a job", "land your",
    "free forever", "nobody pays to get hired",
]

# Structural throat-clearing and closers. Matched at a sentence opening only,
# which is why these are patterns rather than substrings.
BANNED_EN_OPENERS = [
    r"it'?s worth noting", r"in order to\b", r"when it comes to",
    r"one of the most important", r"there are many reasons",
    r"as you may know", r"in conclusion", r"ultimately,",
    r"at the end of the day", r"ever wondered", r"what if there",
    r"we'?re excited to announce", r"let'?s\b",
]

BANNED_AR = [
    "في عالمنا المتسارع", "في ظل التطور السريع", "إطلاق العنان", "رحلتك نحو",
    "نقلة نوعية", "حلول جذرية", "حلول ثورية", "قواعد اللعبة", "لا مثيل له",
    "انطلق الآن", "حقّق أحلامك", "حقق أحلامك", "مستقبلك يبدأ من هنا",
    "بلا حدود", "فريدة من نوعها", "الحل الأمثل", "الرائدة في مجالها",
    "نحن نؤمن", "دعنا نساعدك", "كن جزءًا من", "اكتشف الفرق",
    "بضغطة زر", "وداعًا لـ", "على الإطلاق", "خارج الصندوق",
    "في نهاية اليوم", "صمم خصيصا", "صُمم خصيصاً",
]

# Translation artifacts. These are not banned outright — each has a legitimate
# use — so they are counted and flagged only past a density that indicates
# English structure survived into the Arabic.
AR_ARTIFACTS: dict[str, tuple[str, int]] = {
    r"\bتم\s": ("passive تم", 1),
    r"من خلال": ("من خلال as all-purpose via", 1),
    r"\bقم\s+ب": ("قم بـ periphrastic imperative", 0),
    r"الخاص\s+ب|الخاصة\s+ب": ("الخاص بك possessive", 0),
    r"بشكل\s+\S+": ("بشكل adverbial", 1),
}

_SENTENCE_SPLIT = re.compile(r"[.!?؟]+[\s\n]+|\n+")


def _lint(copy: str) -> list[str]:
    """
    Flag the mechanical failures so the reviewer starts where the problems are.

    This CANNOT judge whether copy is good, and it is not meant to. Everything
    it catches is a thing a regex can be sure about; rhythm, register, whether
    the sentence actually means anything, and whether the Arabic reads as
    Arabic are all left to the human-equivalent review.
    """
    found: list[str] = []
    low = copy.lower()

    for term in BANNED_EN:
        if term in low:
            found.append(f"banned EN term: {term!r}")

    for pattern in BANNED_EN_OPENERS:
        # Sentence-initial only, so "let's" inside a quote does not trip it.
        if re.search(rf"(?:^|[.!?]\s+|\n){pattern}", low):
            found.append(f"banned EN structure: {pattern!r} at a sentence opening")

    for term in BANNED_AR:
        if term in copy:
            found.append(f"banned AR term: {term!r}")

    for pattern, (label, allowance) in AR_ARTIFACTS.items():
        hits = len(re.findall(pattern, copy))
        if hits > allowance:
            found.append(f"AR translation artifact: {label} x{hits}")

    if "—" in copy or "–" in copy:
        # The one sanctioned use is the locked badge label, in either locale.
        # Both forms are copied verbatim from `src/i18n/{en,ar}.json`; do not
        # retype them from memory, the Arabic carries a shadda and a kasra.
        if not any(x in copy for x in ("Suggested — confirm", "مقترح — أكِّده")):
            found.append("em/en dash in prose (banned in both languages)")

    # PER LINE, not per document. `language="both"` returns the English and the
    # Arabic in one string, and a whole-string test saw the semicolon in an
    # English sentence, saw Arabic script elsewhere in the response, and
    # reported Latin punctuation inside Arabic. It was reading across the two
    # languages. A semicolon in English prose is fine; only Arabic lines are
    # asked the question.
    for line in copy.splitlines():
        if re.search(r"[؀-ۿ]", line) and re.search(r"[a-z؀-ۿ][,;]\s", line):
            found.append(f"Latin comma/semicolon in Arabic text (use ، and ؛): {line[:60]!r}")

    # Rhythm. Even cadence is the single most reliable tell that survives a
    # clean vocabulary pass, so it is measured rather than eyeballed.
    #
    # COEFFICIENT OF VARIATION, NOT RAW DEVIATION, and the reason is bilingual.
    # Arabic carries more meaning per word, so its sentences are shorter in
    # word count and their spread is narrower for the same felt rhythm; a raw
    # stdev threshold tuned on English flags good Arabic. CV is scale-free, so
    # one number serves both.
    #
    # 0.20 is measured, not picked: across every multi-sentence string in both
    # shipped locale files the minimum CV is 0.22, so this floor clears the
    # entire corpus with nothing to spare, while the deliberately flat test
    # sample sits at 0.15.
    sentences = [s for s in _SENTENCE_SPLIT.split(copy.strip()) if s.strip()]
    lengths = [len(s.split()) for s in sentences]
    if len(lengths) >= 3 and statistics.mean(lengths):
        cv = statistics.pstdev(lengths) / statistics.mean(lengths)
        if cv < 0.20:
            found.append(
                f"uniform sentence length (word counts {lengths}, "
                f"CV {cv:.2f} against a 0.20 floor) — rhythm is flat"
            )

    # The symmetrical three-point list, approximated by three list items of
    # near-identical weight. Low confidence by design; it is a prompt to look.
    bullets = re.findall(r"^\s*(?:[-*•]|\d+[.)])\s+(.+)$", copy, re.MULTILINE)
    if len(bullets) == 3:
        counts = sorted(len(b.split()) for b in bullets)
        if counts[0] and counts[2] / counts[0] < 1.3:
            found.append(
                f"possible symmetrical 3-point list (word counts {counts})"
            )

    return found


# --------------------------------------------------------------------------
# Gemini
# --------------------------------------------------------------------------

_client: Any = None


def _get_client() -> Any:
    """
    Build the client on first use, not at import.

    Deliberate: `claude mcp add` and every `tools/list` must work on a machine
    with no key configured. Failing at import would make the whole server
    disappear from Claude's tool list with no explanation of why.
    """
    global _client
    if _client is not None:
        return _client

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError(
            "No API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in the "
            "environment the MCP server runs in, then restart it."
        )

    from google import genai  # imported late for the same reason

    _client = genai.Client(api_key=key)
    return _client


mcp = FastMCP(
    name="itqan-content",
    instructions=(
        "Brand-constrained copywriting for Itqan through Gemini. Call "
        "generate_brand_content for any user-facing string in either language. "
        "Its output is a DRAFT: read it, judge it against the returned "
        "`violations` and against the brand voice, and call again with "
        "`previous_draft` and `feedback` until it passes. Never paste the "
        "first response straight into a locale file or a component."
    ),
)


@mcp.tool
def generate_brand_content(
    brief: str,
    surface: str = "",
    language: Literal["en", "ar", "both"] = "en",
    max_words: int | None = None,
    previous_draft: str = "",
    feedback: str = "",
    variants: int = 1,
    temperature: float = 1.0,
) -> dict[str, Any]:
    """
    Draft Itqan copy under the full brand ruleset and anti-AI blacklist.

    THE OUTPUT IS A DRAFT AND MUST BE REVIEWED BEFORE IT IS USED. The intended
    loop, which the caller is responsible for running:

      1. Call this with a brief.
      2. Read `copy`. Read `violations` — but do not stop there, because a
         clean lint only means no regex caught anything.
      3. Judge it: is the rhythm varied or flat? Are the nouns concrete? Does
         it lead with capability? Does the Arabic read as Arabic or as English
         in Arabic script? Does it claim anything Itqan cannot evidence?
      4. If it fails, call again with `previous_draft` set to what came back
         and `feedback` naming what specifically is wrong. Vague feedback
         produces a vague revision; quote the offending line.
      5. Only once it passes does it go into `src/i18n/*.json` or a component.

    Args:
        brief: What the copy has to do, and any facts it may state. Be
            specific about the promise; do not leave the model to infer it.
        surface: Where it goes, e.g. "pricing page hero", "primary button on
            /jobs", "empty state when no matches are found". Shapes length
            and register.
        language: "en", "ar", or "both". "both" authors each independently
            and returns them labelled, rather than translating one.
        max_words: Hard ceiling. Omit for prose; set it tight for UI strings.
        previous_draft: The draft being revised. Triggers refinement mode.
        feedback: What was wrong with `previous_draft`. Required when it is
            set, and the more specific it is the better the revision.
        variants: Distinct options to return. Use for headlines and CTAs
            where choice is genuinely useful; leave at 1 for body copy.
        temperature: 1.0 by default. Formulaic output is the failure mode
            here, so this is not lowered for "reliability" — the ruleset does
            the constraining, not a cold sampler.

    Returns:
        copy: the draft, exactly as returned, unmodified.
        violations: mechanical failures found. Empty is necessary, not
            sufficient.
        refined: whether this was a revision.
        model, language, blocked: metadata. `blocked` is true when the model
            reported it could not write the brief without inventing a fact.
    """
    if previous_draft and not feedback:
        return {
            "error": "previous_draft was given without feedback. A revision "
                     "with nothing to fix produces a lateral rewrite. Say what "
                     "is wrong with the draft.",
        }

    lang_line = {
        "en": "Write in English only.",
        "ar": "اكتب بالعربية فقط. Write in Arabic only, authored in Arabic "
              "rather than translated from an English draft.",
        "both": "Write BOTH languages. Author each one from the brief "
                "independently; do not translate one into the other. Label "
                "them exactly `EN:` and `AR:` on their own lines, nothing "
                "else around them.",
    }[language]

    parts = [f"BRIEF: {brief.strip()}"]
    if surface:
        parts.append(f"SURFACE: {surface.strip()}")
    parts.append(lang_line)
    if max_words:
        parts.append(f"HARD LIMIT: {max_words} words. Under is fine.")
    if variants > 1:
        parts.append(
            f"Return {variants} distinct options, numbered. Make them "
            "genuinely different in angle, not the same sentence reworded."
        )

    if previous_draft:
        parts.append(
            "This is a REVISION, not a fresh start. Here is the draft that "
            "was rejected:\n\n"
            f"<<<DRAFT\n{previous_draft.strip()}\nDRAFT>>>\n\n"
            "Here is what is wrong with it:\n\n"
            f"<<<FEEDBACK\n{feedback.strip()}\nFEEDBACK>>>\n\n"
            "Fix exactly what the feedback names. Keep what was working; a "
            "revision that discards the good parts to avoid the bad one is a "
            "failure too. Return only the revised copy."
        )

    try:
        client = _get_client()
        from google.genai import types

        response = client.models.generate_content(
            model=MODEL,
            contents="\n\n".join(parts),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=temperature,
            ),
        )
        copy = (response.text or "").strip()
    except Exception as exc:  # surfaced, never swallowed
        return {"error": f"{type(exc).__name__}: {exc}"}

    if not copy:
        return {"error": "Gemini returned an empty response."}

    return {
        "copy": copy,
        "violations": _lint(copy),
        "refined": bool(previous_draft),
        "blocked": copy.startswith("BLOCKED:"),
        "language": language,
        "model": MODEL,
        "review_required": (
            "Do not paste this anywhere yet. Judge rhythm, concreteness, "
            "capability-first framing and Arabic naturalness by reading it, "
            "then either refine or accept."
        ),
    }


if __name__ == "__main__":
    print(
        f"itqan-content: ruleset loaded from {BRAND_VOICE_PATH} "
        f"({len(BRAND_VOICE)} chars), model {MODEL}",
        file=sys.stderr,  # stdout belongs to the MCP protocol
    )
    mcp.run()
