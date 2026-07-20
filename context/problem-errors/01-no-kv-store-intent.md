# 01 — No KV store intent in the SDK

**Hit while:** mapping `edge-totp` `otp-app` params to the wizard SDK.
**Severity:** blocks a complete TOTP deploy.

## What

`otp-app` requires two mandatory KV params (from `otp-app/registry.json`):

- `KV_STORE_NAME` — the KV store name
- `KV_STORE_ID` — the **numeric** store id (used for the Gcore KV write REST API)

The wizard has no way to obtain these. The SDK's `WizardSession.fastedge` exposes
only `templates`, `apps`, `secrets` — **no `stores`/`kv` namespace**. There is no
create-store, list-stores, or pick-store intent.

The only trace of KV in the surface is `TemplateParam.data_type: '… | store'`
(`types.d.ts`) — i.e. a template can *declare* a store-typed param, but the SDK
gives a wizard no operation to create one or resolve a name→id. So the wizard
would have to ask the user to paste a name and a numeric id it cannot validate.

## Why it blocks

Both are `mandatory: true`. `/verify` and `/enroll` are non-functional without a
real KV store. A wizard that can't create/select the store, or at least resolve
its numeric id, can't deliver a working deploy — it just relays a raw id field,
which is the manual step the wizard was supposed to remove.

## What would resolve it

A KV intent set, e.g. `session.fastedge.stores.list()` / `.create({name})` /
`.pick()` returning `{ id, name }` — mirroring the `secrets.pick()` pattern so a
store-typed param renders as a picker/create button. Then a `store`-typed
`TemplateParam` maps to it directly.
