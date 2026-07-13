# FastEdge Wizard Apps

> **Read `context/INDEX.md` first** — it is the discovery hub: wizard registry,
> proxy contract, SDK reference, and pointers to per-wizard docs.

## What This Repo Is

A monorepo serving wizard front-ends via GitHub Pages / jsDelivr. The FastEdge
portal proxies these files through a hardened WASM app that re-serves them under
a fixed origin with enforced CSP (`connect-src 'none'`, `frame-ancestors <portal>`).

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
<wizard>/
  src/                         ← source files (not served)
  index.html                   ← committed build output (served by proxy)
  main.js                      ← committed build output
  package.json
  .gitignore
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

1. Create `<name>/` with `src/`, `package.json`, `.gitignore`
2. Follow `write-intents/` as the pattern
3. `pnpm install && pnpm run build` — produces committed `index.html` + `main.js`
4. Add `context/wizards/<name>/DOCS.md`
5. Register it in `context/INDEX.md` wizard registry
6. Add `'<name>'` to `pnpm-workspace.yaml`

### Build a wizard

```bash
cd <wizard>
pnpm install
pnpm run build      # esbuild bundles src/main.js → main.js; copies src/index.html
```

Commit `index.html` and `main.js` — the proxy serves them from GitHub Pages.

### Run all wizard builds

```bash
pnpm run build      # from repo root — runs build in every workspace package
```

## Rules

- Committed build outputs (`index.html`, `main.js`) are not optional — the proxy
  serves them directly from GitHub Pages. Always rebuild and commit after source changes.
- Wizards are independent. No cross-wizard imports. No shared runtime code.
- `packages/*` is for shared build-time dependencies only (React components, utils).
  These are bundled away at build time — never fetched at runtime.
- Never commit `node_modules/`.
- Pin the SDK to a tag in any wizard whose output is committed for production use.
  `#main` is for local development only.
