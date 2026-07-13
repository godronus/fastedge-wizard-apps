# write-intents — Smoke Test Wizard

## What It Is

A step-by-step smoke test for every write intent in the FastEdge wizard bridge.
Not a customer-facing wizard — a developer tool for verifying the bridge
implementation end-to-end against a live portal.

## Tech Stack

Plain HTML + vanilla JavaScript. No framework. One build step (esbuild bundles
the SDK into `main.js`).

```
write-intents/
  src/
    index.html    ← HTML + CSS, loads ./main.js as a module
    main.js       ← all bridge logic; one import from @gcore/fastedge-wizard-sdk
  index.html      ← committed build output (served by proxy)
  main.js         ← committed build output (bundled SDK + logic)
  package.json
  .gitignore
```

## Build & Dev

```bash
cd write-intents
pnpm install
pnpm run build        # esbuild + cp → index.html + main.js at wizard root
pnpm run dev          # build then serve on http://localhost:8086
```

For the portal dev override in `wizard-host.dev.ts`:
```
url: 'http://localhost:8086/index.html?hostOrigin=https://portal.preprod.world'
```

## Template Config

To launch this wizard from the portal, the FastEdge template needs:

```
WIZARD_SPEC=1
WIZARD_SOURCE_CONFIG={"repo":"G-Core/FastEdge-Wizard-apps","path":"write-intents"}
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
# in write-intents/
pnpm add github:G-Core/fastedge-wizard-sdk#<new-tag>
pnpm run build
git add package.json pnpm-lock.yaml index.html main.js
git commit -m "chore(write-intents): bump SDK to <new-tag>"
```

## Change Log

| Date | Change |
|------|--------|
| 2026-07-13 | Ported from `fastedge-wizard-sdk/examples/write-intents`; updated to namespaced API (`fastedge.*`); removed `grantedCapabilities` display (capability grant layer removed in trust model v2) |
