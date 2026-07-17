# Context Index

> Discovery hub for this repo. Read after `CLAUDE.md`. Jump to the section
> relevant to your task; do not read everything upfront.

## System Overview

FastEdge wizards are interactive setup forms that run inside the Gcore portal
in a hardened iframe. A wizard talks to the portal over a `MessageChannel`
bridge using a narrow intent catalog — the portal calls the Gcore API on the
wizard's behalf. The wizard never holds a credential.

**This repo** hosts the static wizard front-end files. The portal does not
frame them directly — the wizard proxy WASM app fetches them server-side and
re-serves them under a single origin with enforced headers.

Full system design: `fastedge-frontend/docs/wizards/README.md` (read that first
for architecture, protocol, trust model, and intent catalog).

### Other system components

| Component | Location |
|-----------|----------|
| Portal host (Angular, bridge, intent router) | `fastedge-frontend` |
| Guest SDK (`@gcore/fastedge-wizard-sdk`) | `G-Core/fastedge-wizard-sdk` |
| Proxy WASM app | `FastEdgeApps-coordinator/.../wizardApp` |
| Design docs (architecture, protocol, trust model) | `fastedge-frontend/docs/wizards/` |
| SDK migration + consumption guide | `fastedge-wizard-sdk/context/INDEX.md` |

---

## Proxy URL Contract

The proxy (`WIZARD_ALLOWED_REPOS = ["G-Core/FastEdge-Wizard-apps", ...]`) supports
two CDN backends. Paths with no file extension resolve to `/index.html`.

### jsDelivr — the backend we use

CI publishes built output to the `gh-pages` branch (`.github/workflows/deploy.yml`);
jsDelivr serves it from git. The ref is a **stable branch** (`gh-pages`), not a
per-release tag — so `WIZARD_SOURCE_CONFIG` is set once and never rewritten per
deploy. Note there is **no `release/` prefix**: `peaceiris` publishes the
`release/` dir *as the branch root*, so a wizard sits at `gh-pages/<wizard>`.

```
Proxy path: /jsdelivr/G-Core/FastEdge-Wizard-apps/<ref>/<wizard>/<asset>
                                                    ^ref  ^wizard-subpath
Resolves:   https://cdn.jsdelivr.net/gh/G-Core/FastEdge-Wizard-apps@<ref>/<wizard>/<asset>
```

**Freshness:** jsDelivr caches branch refs for up to 7 days, and nothing else
caches (the WASM proxy runs every request; no edge cache). So each publish
**purges** the changed assets from jsDelivr — that purge is the only thing making
a deploy visible promptly.

### GitHub Pages — not used here

The proxy also has a `/pages/` backend (`<org>.github.io/<repo>/...`), but the
GitHub Pages *feature* is disabled org-wide, so it does not resolve for this
repo. jsDelivr reads the git branch directly and needs no Pages feature.

### Wiring a wizard to the portal

Set on the FastEdge template that launches this wizard (first path segment is the
git ref, the rest is the wizard subdir):

```
WIZARD_SPEC=1
WIZARD_SOURCE_CONFIG={"repo":"G-Core/FastEdge-Wizard-apps","path":"gh-pages/<wizard-dir>","cdn":"jsdelivr"}
```

The portal reads `WIZARD_SOURCE_CONFIG` and builds the proxy path from `repo` +
`path` + `cdn`.

---

## SDK

| | |
|--|--|
| Package | `@gcore/fastedge-wizard-sdk` |
| Repo | `G-Core/fastedge-wizard-sdk` (standalone public repo) |
| Install | `"github:G-Core/fastedge-wizard-sdk#<tag>"` in `package.json` |
| Build | `esbuild src/main.js --bundle --format=esm --outfile=main.js` |
| Why bundled | Proxy enforces `connect-src 'none'` — no runtime CDN fetch allowed |

The SDK has a `prepare` script, so `pnpm install` auto-builds `dist/` from the
GitHub source. Types are included. No npm publish needed.

### SDK version log

| Tag / ref | Notes |
|-----------|-------|
| `v0.0.8` | Current pin for `write-intents` (hosted at `godronus/fastedge-wizard-sdk` during dev; will move to `G-Core/` org) |
| `main` | Development — do not pin committed wizards to this |

_Add rows when tags are published._

### Session API (current)

```js
session.context.get()
session.fastedge.templates.list(params?)
session.fastedge.templates.read({ id })
session.fastedge.apps.list()
session.fastedge.apps.get({ id })
session.fastedge.apps.create(params)        // consent required
session.fastedge.apps.update(params)        // consent required
session.fastedge.apps.link(params)          // consent required
session.fastedge.secrets.list()             // wizard-managed scope only
session.fastedge.secrets.create(params)     // opens portal modal
session.fastedge.secrets.pick()             // opens portal picker
session.deployment.plan(params)             // dry-run, no consent
session.deployment.apply({ planId })        // consent required
session.on('deployment.progress', handler)
session.dispose()
```

### Mock host

The SDK ships a development server (`bin/dev.mjs`) that acts as a mock portal
host — it serves the wizard inside a real iframe, runs the full bridge protocol,
and responds to intents using data from the wizard's `fixtures/` directory. Each
wizard that has a `fixtures/` dir gets realistic intent responses without hitting
the real API. Run via `pnpm run dev:local` inside a wizard directory.

The mock host validates `fixtures/*.json` against the SDK's Zod schemas at
startup and warns on any mismatch. Pass `--validate-only` for a CI-safe check.

---

## Developer Skills

Claude Code skills (`.claude/agents/`) automate the recurring workflows:

| Skill | What it does |
|-------|-------------|
| `/sync-wizard-fixtures` | Fetches live Gcore templates/apps/secrets, presents selection menus, fudges IDs, writes `fixtures/` and validates against SDK schemas |

---

## Orange's Repo

Orange (`Orange/gcore-wizards`) has their own allow-list entry on the proxy.
Each wizard is a subdirectory with `src/` and the same `@gcore/fastedge-wizard-sdk`
dep. They manage their own SDK version pins, builds, and publish/serve strategy
independently — their `WIZARD_SOURCE_CONFIG` ref/cdn need not match ours.

---

## Wizard Registry

| Wizard | Directory | Status | Docs |
|--------|-----------|--------|------|
| Write-intents smoke test | `wizards/write-intents/` | Active | [`context/wizards/write-intents/DOCS.md`](wizards/write-intents/DOCS.md) |

_Add rows here when new wizards are added._
