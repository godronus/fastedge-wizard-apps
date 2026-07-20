# write-intents

Developer smoke-test wizard for the FastEdge wizard bridge. Steps through every write intent in sequence against a live portal to verify the bridge end-to-end.

Not a customer-facing wizard.

## Run locally

```bash
pnpm install
pnpm run dev   # builds and serves on http://localhost:9999
```

Point the portal's dev override at `http://localhost:9999/index.html?hostOrigin=https://portal.preprod.world`.

## Build

```bash
pnpm run build   # bundles SDK into dist/main.js
```

Or from the repo root (`pnpm run build`) to build all wizards and assemble into `release/`.

## Intents covered

`fastedge.secrets.list/create` · `fastedge.templates.list` · `fastedge.apps.create/list/get/update` · `deployment.plan/apply`

See [`context/wizards/write-intents/DOCS.md`](../../context/wizards/write-intents/DOCS.md) for the full step table and SDK bump workflow.
