# CLAUDE.md — workspace root

The Itqan marketing website lives in [`itqan-website/`](itqan-website/). **Read
[`itqan-website/CLAUDE.md`](itqan-website/CLAUDE.md) before doing any work on it** — it holds the stack,
commands, locked rules, the audit gate, and the guide to which skill owns which decision.

Quick start:

```bash
cd itqan-website
npm install && npm run dev            # http://localhost:4321
python scripts/audit.py src/          # phase-gate audit
```

Source brand assets (logos, mascot art, the build brief) are in the parent `Itqan/` folder.
