# CLAUDE.md — workspace root

**Itqan is a career navigator for job seekers and job switchers in Oman and the Gulf.** It answers four
questions in order, and everything in this workspace exists to answer one of them:

1. Where do I stand today?
2. Which role should I aim for?
3. What is the shortest path there? In real courses and certifications.
4. Which jobs can I apply to now?

Every answer is measured against live regional demand and what those openings currently ask for, and
carries its reason and a real source. The pain being attacked is confusion and lost time: people applying
to hundreds of roles that were never a fit, with nobody telling them what to fix first.

**Itqan is not a translation engine.** Turning a course into a skill is one step inside question one. An
earlier pitch led with it and the framing still resurfaces; if a page, deck or headline makes decoding a
document the story, it is reproducing a superseded pitch.

**Pricing.** Most of what gets someone started is free and stays free: where they stand, the path,
their three strongest job matches, and the advisor. Premium opens the rest of the matches and raises
AI usage. It is 2.9 OMR a month, charged as $7.54 through Paddle. Never write "free forever" or "no
payment at any point", and never "nobody pays to get hired" — that one is retired and now false.

## The two front ends

| | Path | What it is | Read first |
|---|---|---|---|
| Marketing site | [`itqan-website/`](itqan-website/) | Astro, static. Scope stops at sign up and log in. | [`itqan-website/CLAUDE.md`](itqan-website/CLAUDE.md) |
| The app | [`Onboarding/`](Onboarding/) | React + Vite. Everything after the session exists. | [`Onboarding/CLAUDE.md`](Onboarding/CLAUDE.md) |

Each has its own CLAUDE.md holding the stack, commands, locked rules and gotchas for that half. **Read the
relevant one before touching either.** The AI pipeline is a separate application and out of scope for both.

```bash
cd itqan-website && npm install && npm run dev   # http://localhost:4321
cd Onboarding    && npm install && npm run dev   # http://localhost:4333/app/
```

## The other durable docs

- [`PRODUCT.md`](PRODUCT.md) — product truth: users, positioning, constraints, brand commitments. The
  source every other doc and skill defers to.
- [`DESIGN.md`](DESIGN.md) — the consolidated design system: tokens, the three registers and the evidence
  fence, component patterns, RTL, and the anti-slop directives. **It wins on anything visual.** The
  `itqan-*` skills and the three `tokens.css` copies remain in place; where they disagree with this file,
  they are the bug.
- [`BACKEND.md`](BACKEND.md) — every HTTP call either front end makes, and which ones do not exist yet.
- [`LEGAL-BRIEF.md`](LEGAL-BRIEF.md) — the obligations behind the legal pages, what was verified against
  the running system, and the questions still open for a person. Oman's PDPL has been enforceable since
  5 February 2026.
  **`/privacy` and `/terms` are now written in full** (2026-08-24, the lead's call) and go to a lawyer
  for review rather than being replaced by one. They are no longer placeholders and must not describe
  themselves as drafts. Every claim in them is checkable against the product or a vendor's published
  policy; if you change what the software does with someone's data, the policy changes with it.
- [`README.md`](README.md) — how the two apps are built and why the load bearing decisions went the way
  they did.

Source brand assets (logos, mascot art, the build brief) are in the parent `Itqan/` folder.
