# write-intents — Smoke Test Wizard

## What It Is

A step-by-step smoke test for every write intent in the FastEdge wizard bridge.
Not a customer-facing wizard — a developer tool for verifying the bridge
implementation end-to-end against a live portal.

## Tech Stack

Plain HTML + vanilla JavaScript. No framework. One build step (esbuild bundles
the SDK into `main.js`).

```
wizards/write-intents/
  src/
    index.html    ← markup; loads ./main.js as a module
    main.js       ← all bridge logic; one import from @gcore/fastedge-wizard-sdk
    styles.css    ← design-token CSS; copied to dist alongside main.js
  fixtures/       ← committed mock-host data (see Fixtures section below)
    templates.json
    apps.json
    secrets.json
  dist/           ← gitignored intermediate build output
  package.json
  .gitignore
```

Build output (`dist/` → `release/write-intents/`) is **not committed** — CI
builds it and publishes to the `gh-pages` branch, which jsDelivr serves.

## Build & Dev

```bash
# Full build (from repo root) — builds all wizards then assembles into release/
pnpm run build

# Build this wizard only (intermediate dist/ — run assemble separately)
cd wizards/write-intents && pnpm run build

# Local dev with mock host — builds, then starts the dev.mjs mock host on :9999
cd wizards/write-intents && pnpm run dev:local
```

`dev:local` runs esbuild in watch mode and the SDK's `bin/dev.mjs` mock host
server in parallel. The mock host serves the wizard inside a real iframe bridge
at `http://localhost:9999/mock-host`, loading fixtures from `fixtures/` at
startup and using them to respond to intents instead of calling the real API.

For the portal dev override in `wizard-host.dev.ts` (when testing against real
preprod instead of the mock host):
```
url: 'http://localhost:9999/index.html?hostOrigin=https://portal.preprod.world'
```

## Fixtures

`fixtures/` holds committed JSON that the mock host (`dev.mjs`) loads at
startup and serves to the wizard as intent responses. This lets you develop
against realistic live-data shapes without hitting the real API.

| File | Schema | Intent(s) served |
|------|--------|-----------------|
| `templates.json` | `TemplateDetailSchema[]` | `fastedge.templates.list`, `fastedge.templates.read` |
| `apps.json` | `AppDetailSchema[]` | `fastedge.apps.list`, `fastedge.apps.get` |
| `secrets.json` | `SecretSummarySchema[]` | `fastedge.secrets.list` |

All resource IDs are fudged (sequential integers) — real account IDs are never
committed. Refresh fixtures from the live API with the `/sync-wizard-fixtures`
skill (`.claude/agents/sync-wizard-fixtures.md`).

To validate fixtures without starting the server:
```bash
cd wizards/write-intents && node ../../../fastedge-wizard-sdk/bin/dev.mjs dist --validate-only
```

## E2E Tests

Playwright visual-regression and accessibility tests live in `e2e/` at the repo
root. They build the release output, serve it on `:9000`, inject a minimal
bridge, and screenshot each wizard in both themes.

```bash
# From repo root
pnpm test:e2e

# Update baselines (delete old PNGs first — --update-snapshots won't overwrite passing tests)
rm e2e/snapshots/theme.spec.ts-snapshots/*.png
pnpm test:e2e -- --update-snapshots
```

Snapshots are committed at `e2e/snapshots/theme.spec.ts-snapshots/`.

## Template Config

To launch this wizard from the portal, the FastEdge template needs:

```
WIZARD_SPEC=1
WIZARD_SOURCE_CONFIG={"repo":"G-Core/FastEdge-Wizard-apps","path":"gh-pages/write-intents","cdn":"jsdelivr"}
```

No other env vars required on the wizard app itself — it creates resources
entirely through the bridge.

## Intents Tested

| Step | Intent | Trigger |
|------|--------|---------|
| 1 | handshake (`connect`) | auto |
| 2 | `fastedge.secrets.list` | auto |
| 3 | `fastedge.secrets.create` | optional action |
| 4 | `fastedge.templates.list` | auto |
| 5 | `fastedge.apps.create` | action (consent) |
| 6 | `fastedge.apps.list` | verify |
| 7 | `fastedge.apps.get` | verify |
| 8 | `fastedge.apps.update` | action (consent) |
| 9 | `deployment.plan` | action |
| 10 | `deployment.apply` | action (consent) |

Note: `deployment.*` intents are un-namespaced (top-level) by design — see
`fastedge-frontend/docs/wizards/04-intent-catalog.md`.

## SDK Version

See `context/INDEX.md` SDK version log. To bump:

```bash
# in wizards/write-intents/
pnpm add github:G-Core/fastedge-wizard-sdk#<new-tag>
# CI rebuilds and republishes on merge — no build output to commit
```

After bumping, re-validate fixtures — a schema change in the SDK may require
running `/sync-wizard-fixtures` or editing fixture files manually:

```bash
node ../../../fastedge-wizard-sdk/bin/dev.mjs dist --validate-only
```

## Change Log

| Date | Change |
|------|--------|
| 2026-07-16 | Added `fixtures/` with live-data snapshots (IDs fudged); added Playwright e2e suite; fixed stale snapshots showing `(connecting…)` |
| 2026-07-13 | Ported from `fastedge-wizard-sdk/examples/write-intents`; updated to namespaced API (`fastedge.*`); removed `grantedCapabilities` display (capability grant layer removed in trust model v2) |
