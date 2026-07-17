---
name: sync-wizard-fixtures
description: Fetch live Gcore FastEdge data, present it for selection, then write chosen templates/apps/secrets into a wizard's fixtures/ directory. Fudges IDs so real resource IDs are not committed to source control.
---

Sync live Gcore API data into wizard fixture files, with interactive selection.

## When to use

Run after account data changes (new templates, new apps, new secrets) or when setting up a new wizard, to give the mock host realistic stub data.

If fixture schema validation fails at the end, it means the installed SDK schemas have drifted from the live API. Run `/check-api-drift` in the `fastedge-wizard-sdk` repo to update `types.ts`, then bump the SDK pin and reinstall before re-running this skill.

## Args

`[wizard-name]` — name of the wizard under `wizards/`. Omit to sync all wizards that have a `fixtures/` directory.

## Steps

### 1 — Determine target wizard(s)

If a wizard name is given, target `wizards/<name>/fixtures/`. If omitted, find all directories matching `wizards/*/fixtures/` (skip `_template`).

### 2 — Fetch available data from the Gcore API

Run all three fetches in parallel:

**Templates** — `GET /fastedge/v1/template?limit=200`
Response: `{ count, templates: TemplateShort[] }` where each has `{ id, name, short_descr, api_type, owned }`.

**Apps** — `GET /fastedge/v1/apps?limit=200`
Response: `{ count, apps: AppShort[] }` where each has `{ id, name, api_type, status, url, template }`.

**Secrets** — `GET /fastedge/v1/secrets?limit=200`
Response: `{ count, secrets: SecretShort[] }` where each has `{ id, name, app_count }`.

### 3 — Present selection menus

Display three numbered lists to the user and ask them to select which items to include in the fixtures.

Format each list clearly. For templates, show owned vs shared (owned = created by this account):

```
Available templates (26):
  Public / shared:
    1.  Geolocation-based redirect  [wasi-http]  — Redirect to the server configured for the user's country
    2.  GitHub artifact             [wasi-http]  — Get GitHub Actions artifact
    ...
  Owned by this account:
    12. CDN Debug                   [wasi-http]  — CDN Debugging utility
    13. shop-front                  [wasi-http]  — Basic ShopFront static site
    ...

Which templates? (numbers, names, "all", "none", or describe what you want)
```

For apps, show `status` translated (0=draft, 1=enabled, 2=disabled) and the template name if present:

```
Available apps (N):
    1. my-app-name  [wasi-http, enabled]  — from template: CDN Debug
    ...

Which apps? ("all", "none", numbers, names, or describe)
```

For secrets, just show the list:

```
Available secrets (N):
    1. MY_API_KEY        (used by 2 apps)
    2. SIGNING_SECRET    (used by 1 app)
    ...

Which secrets? ("all", "none", numbers, or names)
```

Accept flexible input — the user can say "just the CDN Debug and Markdown renderer", "all owned templates", "the SSO ones", "all", "none", etc. Filter accordingly using name matching or the user's description. If the intent is ambiguous, ask for clarification before proceeding.

### 4 — Fetch full details for selected items

For each **selected template**, fetch full details to get `binary_id` and `params`:
```
GET /fastedge/v1/template/{id}
```
Response has `binary_id`, `params[]`, `name`, `short_descr`, `long_descr`, `api_type` but NOT `id` — merge `id` from the list call.

Build the full template object:
```json
{
  "id": <from list>,
  "name": <name>,
  "short_descr": <default "">,
  "long_descr": <default "">,
  "api_type": <api_type>,
  "binary_id": <from detail>,
  "params": <from detail, default []>
}
```

Each param: keep only `{ name, data_type, descr, mandatory }` plus optional `metadata`. Drop any extra fields.

For each **selected app**, fetch full details to get `env` and `secrets`:
```
GET /fastedge/v1/apps/{id}
```

Build the app object:
```json
{
  "id": <from list>,
  "name": <name>,
  "api_type": <api_type>,
  "status": <status>,
  "url": <url, default "">,
  "template": <template id or null>,
  "env": <from detail, default {}>,
  "secrets": <convert secrets Record to [{ id, name }], default []>
}
```

The API returns `secrets` as `Record<string, { id, name, comment }>` on the full App — convert to `[{ id, name }, ...]`.

**Secrets** need no detail fetch — `SecretShort` is sufficient.

### 5 — Fudge IDs

Replace all real resource IDs with sequential integers to avoid committing actual account IDs to source control.

Build three maps:
- `templateIdMap`: real_id → 1, 2, 3... (order by position in the selected list)
- `appIdMap`: real_id → 1, 2, 3...
- `secretIdMap`: real_id → 1, 2, 3...

Apply maps:
- Each template: `id = templateIdMap[id]`
- Each app: `id = appIdMap[id]`, `template = templateIdMap[template] ?? null`, and in `secrets[]`: `id = secretIdMap[id]`
- Each secret: `id = secretIdMap[id]`

### 6 — Validate against SDK schemas

Load `fixtureSchemas` from the wizard's installed SDK:
`wizards/<name>/node_modules/@gcore/fastedge-wizard-sdk/dist/schemas.js`

Parse:
- `fixtureSchemas.templates.parse(selectedTemplates)`
- `fixtureSchemas.apps.parse(selectedApps)`
- `fixtureSchemas.secrets.parse(selectedSecrets)`

If any parse fails, report the Zod error and stop — do NOT write files. Suggest running `/check-api-drift` in `fastedge-wizard-sdk`.

### 7 — Write files

Write to `wizards/<name>/fixtures/` (create directory if needed):

- `templates.json` — pretty-printed JSON array
- `apps.json` — pretty-printed JSON array
- `secrets.json` — pretty-printed JSON array

Report: how many of each were written, and remind the user that IDs have been fudged (real IDs are not in these files).
