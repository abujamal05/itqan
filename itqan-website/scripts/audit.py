#!/usr/bin/env python3
"""
Itqan UI audit — project-local phase gate.

This is a stand-in for the audit referenced by the itqan-ui-review skill
(scripts/audit.py), which is not installed in this environment. It implements
the same rule families the skill documents, so the end-of-phase gate can run.

It is a STATIC TEXT analyser. It cannot see a rendered page: cascade bugs,
layout collapse, dark-mode-only issues, RTL visual breaks and contrast are NOT
catchable here. Passing this is necessary, never sufficient — always follow with
the render check (both themes, both directions, narrow and wide, keyboard only).

Usage:
    python scripts/audit.py src/
    python scripts/audit.py src/ --severity high     # only ship-blockers
    python scripts/audit.py src/ --json              # machine readable

Exit code is 1 if any CRITICAL or HIGH finding survives suppression, so it can
gate a commit or a build.

Suppress a deliberate specimen (never weaken a rule to pass):
    {/* itqan-audit-ignore-next-line: reason */}
    /* itqan-audit-ignore-start: reason */ ... /* itqan-audit-ignore-end */
    <!-- itqan-audit-ignore-file: reason -->
Every suppression needs a reason after the colon; an empty one is itself a defect.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1}

# Only these are scanned. Docs (.md) are deliberately excluded: they discuss the
# banned words and colours and would false-positive endlessly.
MARKUP_EXTS = {".astro", ".html", ".svelte", ".vue", ".jsx", ".tsx"}
STYLE_EXTS = {".css"}
CODE_EXTS = {".ts", ".js"}
COLOUR_EXTS = MARKUP_EXTS | STYLE_EXTS
SKIP_DIRS = {"node_modules", "dist", ".git", ".astro", ".vscode", ".cache"}
# The design system is the source of truth for values; it is inherently a
# "specimen" of every literal it defines. Never audit it for hardcoded values.
SKIP_FILES = {"tokens.css"}

HYPE_WORDS = [
    "revolutionary", "revolutionise", "revolutionize", "magical", "seamless",
    "effortless", "game-changer", "game changer", "game-changing", "cutting-edge",
    "cutting edge", "unlock your potential", "empower", "delve", "elevate",
    "leverage", "robust", "holistic", "tapestry", "testament to", "harness",
    "transform your career", "in today's competitive", "we are on a mission",
    "imagine a world", "the future of",
]
# "AI-powered" and "AI powered" as a *selling point*. Neutral mentions in
# honest copy ("we do not force AI") are fine; this catches the hype framing.
AI_HYPE = re.compile(r"\bAI[- ]powered\b", re.IGNORECASE)

EMPTY_CTAS = ["submit", "click here", "learn more", "read more", "get started"]


@dataclass
class Finding:
    severity: str
    family: str
    rule: str
    message: str
    file: str
    line: int
    excerpt: str


# Each rule: (family, rule_id, severity, compiled regex, message, applies_to)
# applies_to is a set of extension groups: "colour", "markup", "style", "copy".
RULES = [
    # ---- Brand -------------------------------------------------------------
    ("brand", "arabic-hamza", "critical",
     re.compile("اتقان"),  # bare alif: اتقان, not إتقان
     "Arabic name spelled without the hamza. Must read إتقان (hamza beneath the alif).",
     {"markup", "style", "copy"}),

    # ---- Colour ------------------------------------------------------------
    ("colour", "retired-ochre", "critical",
     re.compile(r"#[dD]08[cC]2[fF]"),
     "Retired ochre / raw brand-gold hex. Use var(--color-accent).",
     {"colour"}),
    ("colour", "hardcoded-hex", "high",
     re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b"),
     "Hardcoded colour bypassing tokens. Use a semantic --color-* token.",
     {"colour"}),
    # Static analysis cannot tell a gold icon (allowed) from gold body text
    # (forbidden), so this is a MEDIUM note prompting the render check, not a
    # blocker. The anchor avoids matching accent-color / background-color.
    ("colour", "gold-as-text", "medium",
     re.compile(r"(?:^|[;{\s])color\s*:\s*var\(--color-accent\)", re.MULTILINE),
     "color set to gold. Confirm this is an icon or accent, never body text (gold is never body text).",
     {"style"}),

    # ---- RTL ---------------------------------------------------------------
    ("rtl", "physical-margin-padding", "high",
     re.compile(r"\b(?:margin|padding|border)-(?:left|right)\b"),
     "Physical left/right property. Use the logical -inline-start / -inline-end form.",
     {"colour"}),
    ("rtl", "physical-text-align", "high",
     re.compile(r"text-align\s*:\s*(?:left|right)\b"),
     "Physical text-align. Use text-align: start / end.",
     {"colour"}),
    ("rtl", "physical-inset", "high",
     re.compile(r"^\s*(?:left|right)\s*:", re.MULTILINE),
     "Physical inset (left/right). Use inset-inline-start / inset-inline-end.",
     {"style"}),
    ("rtl", "physical-float", "medium",
     re.compile(r"float\s*:\s*(?:left|right)\b"),
     "Physical float. Use inline-start / inline-end.",
     {"colour"}),

    # ---- Accessibility -----------------------------------------------------
    ("a11y", "focus-removed", "medium",
     re.compile(r"outline\s*:\s*(?:none|0)\b"),
     "Focus outline removed. Keep a visible focus indicator (replace with a ring, do not delete it).",
     {"style"}),
    ("a11y", "img-no-alt", "high",
     re.compile(r"<img(?![^>]*\balt\s*=)[^>]*>"),
     "Image without an alt attribute. Decorative images need alt=\"\".",
     {"markup"}),

    # ---- Motion ------------------------------------------------------------
    ("motion", "layout-animation", "high",
     re.compile(r"transition\s*:\s*[^;]*\b(?:width|height|margin|padding|top|left|right|bottom)\b"),
     "Animating a layout property. Animate only transform and opacity.",
     {"style"}),
    ("motion", "nontoken-duration", "medium",
     re.compile(r"(?:transition|animation)(?:-duration)?\s*:\s*[^;]*\b\d+(?:\.\d+)?m?s\b"),
     "Literal duration. Use a --duration-* token so timing stays consistent.",
     {"style"}),
    ("motion", "ease-in-ui", "medium",
     re.compile(r"\bease-in\b(?!-out)(?!\s*[-:])"),
     "ease-in on UI motion feels sluggish. Use --ease-out / --ease-in-out.",
     {"style"}),

    # ---- Typography --------------------------------------------------------
    ("typography", "letter-spacing", "medium",
     re.compile(r"letter-spacing\s*:\s*(?!(?:0(?:px|rem|em|ch|%)?|normal)\s*;)[^;\s][^;]*"),
     "Letter-spacing. Never on Arabic (it severs the joins); avoid unless the design calls for it on Latin caps.",
     {"style"}),

    # ---- Copy (i18n strings only) -----------------------------------------
    ("copy", "empty-cta", "medium", None,
     "Empty-verb CTA. Buttons should name the outcome (\"See my matches\", not \"Submit\").",
     {"copy"}),
    ("copy", "hype", "medium", None,
     "Hype vocabulary. Itqan never performs enthusiasm; say the concrete thing.",
     {"copy"}),
]


def ext_groups(path: Path) -> set[str]:
    ext = path.suffix
    groups: set[str] = set()
    if ext in MARKUP_EXTS:
        groups |= {"markup", "colour"}
    if ext in STYLE_EXTS:
        groups |= {"style", "colour"}
    if ext in CODE_EXTS:
        groups |= {"code"}
    if ext == ".json" and "i18n" in path.as_posix():
        groups |= {"copy"}
    return groups


def suppressed_lines(text: str, lines: list[str]) -> tuple[set[int], bool, list[Finding]]:
    """Return (suppressed line numbers, whole-file-suppressed, pragma defects)."""
    defects: list[Finding] = []
    if re.search(r"itqan-audit-ignore-file", text):
        m = re.search(r"itqan-audit-ignore-file\s*:?\s*(.*)", text)
        reason = (m.group(1).strip() if m else "")
        return set(), True, defects

    suppressed: set[int] = set()
    in_block = False
    for i, raw in enumerate(lines, start=1):
        if "itqan-audit-ignore-start" in raw:
            in_block = True
            if not re.search(r"itqan-audit-ignore-start\s*:\s*\S", raw):
                defects.append(Finding("low", "process", "pragma-no-reason",
                    "Suppression pragma without a reason.", "", i, raw.strip()))
            continue
        if "itqan-audit-ignore-end" in raw:
            in_block = False
            continue
        if in_block:
            suppressed.add(i)
        if "itqan-audit-ignore-next-line" in raw:
            suppressed.add(i + 1)
            if not re.search(r"itqan-audit-ignore-next-line\s*:\s*\S", raw):
                defects.append(Finding("low", "process", "pragma-no-reason",
                    "Suppression pragma without a reason.", "", i, raw.strip()))
    return suppressed, False, defects


def scan_file(path: Path, rel: str) -> list[Finding]:
    if path.name in SKIP_FILES:
        return []
    groups = ext_groups(path)
    if not groups:
        return []
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return []
    lines = text.splitlines()
    suppressed, whole_file, findings = suppressed_lines(text, lines)
    for d in findings:
        d.file = rel
    if whole_file:
        return []

    for family, rule_id, severity, pattern, message, applies in RULES:
        if not (applies & groups):
            continue

        # Copy rules run on the VALUE side of a JSON pair only, so keys like
        # "submit": never trip the empty-CTA / hype checks.
        if rule_id == "empty-cta":
            for i, line in enumerate(lines, start=1):
                if i in suppressed:
                    continue
                value = line.split(":", 1)[1] if ":" in line else ""
                for cta in EMPTY_CTAS:
                    if re.search(r'"\s*' + re.escape(cta) + r'\s*"', value, re.IGNORECASE):
                        findings.append(Finding(severity, family, rule_id, message,
                                                rel, i, line.strip()))
            continue

        if rule_id == "hype":
            for i, line in enumerate(lines, start=1):
                if i in suppressed:
                    continue
                value = (line.split(":", 1)[1] if ":" in line else "").lower()
                for w in HYPE_WORDS:
                    if w in value:
                        findings.append(Finding(severity, family, rule_id,
                            message + f" (\"{w}\")", rel, i, line.strip()))
                if AI_HYPE.search(value):
                    findings.append(Finding(severity, family, rule_id,
                        message + " (\"AI-powered\")", rel, i, line.strip()))
            continue

        for m in pattern.finditer(text):
            line_no = text.count("\n", 0, m.start()) + 1
            if line_no in suppressed:
                continue
            findings.append(Finding(severity, family, rule_id, message, rel,
                                    line_no, lines[line_no - 1].strip()
                                    if line_no - 1 < len(lines) else ""))
    return findings


def collect(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    targets = [root] if root.is_file() else [
        p for p in root.rglob("*")
        if p.is_file() and not any(part in SKIP_DIRS for part in p.parts)
    ]
    base = root.parent if root.is_file() else root
    for p in targets:
        rel = p.relative_to(base).as_posix() if not root.is_file() else p.name
        findings.extend(scan_file(p, rel))
    return findings


def main() -> int:
    ap = argparse.ArgumentParser(description="Itqan UI static audit.")
    ap.add_argument("path", help="File or directory to scan (e.g. src/).")
    ap.add_argument("--severity", choices=list(SEVERITY_ORDER),
                    help="Only show findings at this severity or above.")
    ap.add_argument("--json", action="store_true", help="Machine-readable output.")
    args = ap.parse_args()

    # Arabic in findings must survive a Windows cp1252 console.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

    root = Path(args.path)
    if not root.exists():
        print(f"path not found: {root}", file=sys.stderr)
        return 2

    findings = collect(root)
    floor = SEVERITY_ORDER[args.severity] if args.severity else 0
    findings = [f for f in findings if SEVERITY_ORDER[f.severity] >= floor]
    findings.sort(key=lambda f: (-SEVERITY_ORDER[f.severity], f.file, f.line))

    blocking = [f for f in findings if SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER["high"]]

    if args.json:
        print(json.dumps({
            "summary": {
                "total": len(findings),
                "blocking": len(blocking),
                "by_severity": {
                    s: sum(1 for f in findings if f.severity == s)
                    for s in SEVERITY_ORDER
                },
            },
            "findings": [asdict(f) for f in findings],
        }, ensure_ascii=False, indent=2))
        return 1 if blocking else 0

    if not findings:
        print("No rule violations found.")
        print("Static audit is necessary, never sufficient — do the render check next.")
        return 0

    icons = {"critical": "CRIT", "high": "HIGH", "medium": "MED ", "low": "LOW "}
    for f in findings:
        print(f"[{icons[f.severity]}] {f.family}/{f.rule}  {f.file}:{f.line}")
        print(f"        {f.message}")
        if f.excerpt:
            print(f"        > {f.excerpt}")
    print()
    counts = {s: sum(1 for f in findings if f.severity == s) for s in SEVERITY_ORDER}
    print(f"{len(findings)} finding(s): "
          f"{counts['critical']} critical, {counts['high']} high, "
          f"{counts['medium']} medium, {counts['low']} low.")
    if blocking:
        print("FAIL: fix every critical and high before moving on "
              "(or suppress a genuine specimen with a reasoned pragma).")
    else:
        print("PASS (no critical/high). Render check still outstanding.")
    return 1 if blocking else 0


if __name__ == "__main__":
    raise SystemExit(main())
