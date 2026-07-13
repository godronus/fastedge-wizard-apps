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

The proxy (`WIZARD_ALLOWED_REPOS = ["G-Core/FastEdge-Wizard-apps", ...]`) resolves
wizard assets via two CDN backends. Paths with no file extension resolve to `/index.html`.

### GitHub Pages

```
Proxy:    /pages/G-Core/FastEdge-Wizard-apps/<wizard>/<asset>
Resolves: https://G-Core.github.io/FastEdge-Wizard-apps/<wizard>/<asset>
```

Publishes on every push to `main`. Use for development and staging.

### jsDelivr (pinned)

```
Proxy:    /jsdelivr/G-Core/FastEdge-Wizard-apps/<git-ref>/release/<wizard>/<asset>
Resolves: https://cdn.jsdelivr.net/gh/G-Core/FastEdge-Wizard-apps@<git-ref>/release/<wizard>/<asset>
```

Immutable once tagged, CDN-cached. Use for production by pinning to a git tag.

### Wiring a wizard to the portal

Set on the FastEdge template that launches this wizard:

```
WIZARD_SPEC=1
WIZARD_SOURCE_CONFIG={"repo":"G-Core/FastEdge-Wizard-apps","path":"release/<wizard-dir>"}
```

The portal reads `WIZARD_SOURCE_CONFIG` and passes `?repo=…&path=…` to the proxy.

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

---

## Orange's Repo

Orange (`Orange/gcore-wizards`) has their own allow-list entry on the proxy.
Their repo follows the same structure as this one: each wizard is a subdirectory
with `src/`, committed build output, and the same `@gcore/fastedge-wizard-sdk`
dep. They manage their own SDK version pins and builds independently.

---

## Wizard Registry

| Wizard | Directory | Status | Docs |
|--------|-----------|--------|------|
| Write-intents smoke test | `write-intents/` | Active | [`context/wizards/write-intents/DOCS.md`](wizards/write-intents/DOCS.md) |

_Add rows here when new wizards are added._
