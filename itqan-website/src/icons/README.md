# Local SVG icons

Empty on purpose, and kept so the build stays quiet.

`astro-icon` scans this directory for hand-drawn SVGs. This site draws none —
every icon comes from the `ph:` set, allowlisted in `astro.config.mjs` — so the
directory did not exist, and every single build printed:

```
[WARN] [astro-icon] Failed to load icons from "src/icons":
ENOENT: no such file or directory, scandir '.../src/icons/'
```

Harmless, and that is the problem: a warning nobody can act on is a warning
everybody learns to scroll past, which is exactly where a real one goes
unnoticed. The build has no other warnings, and it should stay that way.

Drop a `.svg` in here to use one locally: `<Icon name="my-icon" />`.
