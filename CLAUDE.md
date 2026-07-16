# FastEdge Wizard Apps

> **Read `context/INDEX.md` first** — it is the discovery hub: wizard registry,
> proxy contract, SDK reference, and pointers to per-wizard docs.

## What This Repo Is

A monorepo of wizard front-ends. `main` holds **source only**; CI builds every
wizard and publishes the output to the `gh-pages` branch, which **jsDelivr**
serves from git (`cdn.jsdelivr.net/gh/<repo>@gh-pages/<wizard>/...`). The
FastEdge portal proxies those files through a hardened WASM app that re-serves
them under a fixed origin with enforced CSP (`connect-src 'none'`,
`frame-ancestors <portal>`). The GitHub Pages *feature* is disabled org-wide —
`gh-pages` is just a build-artifact branch, not a Pages site.

## Repo Layout

```
CLAUDE.md                      ← this file (rules + entry point)
AGENTS.md                      ← agent orchestration
context/
  INDEX.md                     ← read this second: discovery map
  wizards/
    <name>/
      DOCS.md                  ← per-wizard detail (read when working on that wizard)
packages/
  <name>/                      ← shared packages (empty until first React wizard)
    CLAUDE.md                  ← only if the package is complex enough to warrant it
wizards/
  <name>/
    src/                       ← source files (the ONLY thing committed on main)
    package.json
    .gitignore
  _template/                   ← starter skeleton — not deployed to gh-pages
release/                       ← build output — gitignored; CI builds it and
                                 publishes to the gh-pages branch. Never committed.
```

## Working Here

### Determine scope first

| Task | Read |
|------|------|
| Work on a specific wizard | `context/wizards/<name>/DOCS.md` |
| Add a new wizard | This file + `context/INDEX.md` |
| Cross-wizard or proxy concerns | `context/INDEX.md` |
| Shared package work | That package's `CLAUDE.md` (if present) |

### Adding a new wizard

1. Create `wizards/<name>/` with `src/`, `package.json`, `.gitignore`
2. Follow `wizards/write-intents/` as the pattern (any package manager is fine)
3. Commit **`src/` and the lockfile** — CI builds and publishes on merge to `main`
4. Add `context/wizards/<name>/DOCS.md`
5. Register it in `context/INDEX.md` wizard registry

### Build a wizard

```bash
cd wizards/<name>
pnpm install
pnpm run build      # esbuild bundles src/main.js → dist/; copies index.html + styles.css
```

Building locally is for testing only. **Do not commit build output** — CI is
the sole builder (see `.github/workflows/deploy.yml`).

### Run all wizard builds

```bash
pnpm run build      # from repo root — runs build in every workspace package
```

## Rules

- **Never commit build output.** `main` is source-only; CI builds on merge and
  publishes to `gh-pages`, which jsDelivr serves. Committed `dist/`/`release/`
  files are gitignored and rot against source — don't reintroduce them.
- Wizards are independent. No cross-wizard imports. No shared runtime code.
- `packages/*` is for shared build-time dependencies only (React components, utils).
  These are bundled away at build time — never fetched at runtime.
- Never commit `node_modules/`.
- Pin the SDK to a tag in any wizard that ships to production. `#main` is for
  local development only.
