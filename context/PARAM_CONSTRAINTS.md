# Template Parameter Constraints

Templates expose their configuration through the `TemplateParam` array returned by
`session.fastedge.templates.read({id})`. Each param has:

| Field | Type | Purpose |
|-------|------|---------|
| `name` | `string` | Env-var key the app reads |
| `data_type` | enum | `string` \| `number` \| `bool` \| `date` \| `time` \| `secret` \| `store` |
| `mandatory` | `boolean` | Always required |
| `metadata` | `string?` | JSON bag (see below) |

The `mandatory` field covers the simple case. It cannot express conditional
requirements, values that must match across multiple apps, or a param that drives
a profile/variant branch. The convention below covers those cases.

## Convention — constraint annotations in `metadata`

The `metadata` field is a JSON string. The host portal reads only `default_value`
from it; everything else is purely for the wizard's own UI logic. Gcore internal
templates may carry these annotations; for others, wizards can derive equivalent
logic from the template's own documentation.

### Fields

```json
{
  "default_value": "...",

  "group": "session",

  "shared_across_apps": true,

  "constraint": "conditional-required",
  "when": { "param": "PROFILE", "eq": "B" },

  "profile_selector": true,
  "options": ["A", "B"]
}
```

| Field | Effect |
|-------|--------|
| `group` | Logical grouping for display (e.g. `"session"`, `"config"`) |
| `shared_across_apps` | This value must be identical on every app in the wizard group |
| `constraint: "conditional-required"` | Required when the condition (`when`) is met, even though `mandatory: false` |
| `when: {param, eq}` | Condition for `conditional-required` — true when `formValues[param] === eq` |
| `profile_selector` | This param drives a profile/variant branch |
| `options` | Valid values for a `profile_selector` param |

All fields are optional. Unknown fields are silently ignored.

## Reading constraint metadata

```js
function parseMeta(param) {
    try { return JSON.parse(param.metadata ?? '{}'); }
    catch { return {}; }
}

// Is this param required given the current form values?
function isRequired(param, formValues) {
    if (param.mandatory) return true;
    const meta = parseMeta(param);
    if (meta.constraint === 'conditional-required' && meta.when) {
        return formValues[meta.when.param] === meta.when.eq;
    }
    return false;
}

// Params that must have the same value (or secret ID) on every app in the group
const sharedParams = params.filter(p => parseMeta(p).shared_across_apps);
```

## Worked example — edge-totp

`edge-totp` deploys two templates:

- **Template 734** `TOTP - Challenge-Verify App` (`wasi-http`) — hosts the OTP
  challenge/verify UI and the `/enroll` endpoint
- **Template 735** `TOTP - MFA Enforcement Filter` (`proxy-wasm`) — verifies the
  `mfa_session` cookie on every CDN request

These templates use the **intersection pattern**: any param that appears on both
templates must carry the same value (or secret ID) on both apps, or the filter
fail-closes and rejects every session.

> The `metadata` in these real templates carries only `default_value` — the
> `shared_across_apps` and `conditional-required` annotations are not present.
> Wizards detect shared params by intersecting the two templates' param lists.

### Cross-app params (must be identical)

| Param | App 734 `mandatory` | Filter 735 `mandatory` | Notes |
|-------|---------------------|------------------------|-------|
| `MFA_SESSION_KEY` | `true` (secret) | `true` (secret) | HS256 key — create once, bind to both |
| `AUTH_PREFIX` | `false` | `false` | Default `/auth/totp`; must also match the CDN path rule |
| `MFA_SESSION_COOKIE` | `false` | `false` | Default `mfa_session`; must match |
| `MFA_AUDIENCE` | `false` | `true` | Optional on app but **filter fail-closes without it**; wizard treats as required |
| `MFA_ISSUER` | `false` | `false` | Leave unset to skip issuer check |

`MFA_AUDIENCE` is the key asymmetry: `mandatory: false` on the app (it can be
deployed standalone without a filter), but `mandatory: true` on the filter. When
deploying both apps, the wizard must treat `MFA_AUDIENCE` as required even though
the auth app's param definition says otherwise.

### App-only params (template 734 only)

`KV_STORE_ID` and `KV_STORE_NAME` (both `mandatory: true`, `data_type: "string"`)
identify the Gcore Edge Storage instance that holds TOTP seeds. These appear only on the auth
app — not on the filter. The wizard creates or picks an Edge Storage instance and passes both
the store ID and name.

Secrets exclusive to the auth app: `ENROLL_API_KEY` (gates the enroll endpoint),
`GCORE_API_TOKEN` (Edge Storage write access), `HANDOFF_KEY` (verifies origin handoff tickets).

Profile B branding/proof params (`MFA_PROOF_SIGNING_KEY`, `MFA_PROOF_PUBLIC_JWK`,
`MFA_PROOF_COOKIE`, `PROOF_TTL`) also appear only on the auth app.

### How the wizard detects shared params

```js
// After reading both templates via context.get() + templates.read():
const appDetail    = await session.fastedge.templates.read({ id: launchTemplateId });
const filterDetail = await session.fastedge.templates.read({ id: companionTemplateIds[0] });

// Params that appear on both templates must carry the same value
const filterParamNames = new Set(filterDetail.params.map(p => p.name));
const sharedParams = appDetail.params.filter(p => filterParamNames.has(p.name));
// → [MFA_SESSION_KEY, AUTH_PREFIX, MFA_SESSION_COOKIE, MFA_AUDIENCE, MFA_ISSUER]
// Collect these values/IDs once; bind the same result to both apps.

// For params shared with the filter, use the filter's mandatory flag as the
// binding requirement (MFA_AUDIENCE: mandatory on filter → wizard treats as required)
function isRequiredForPair(appParam, filterDetail) {
    if (appParam.mandatory) return true;
    const filterVersion = filterDetail.params.find(p => p.name === appParam.name);
    return filterVersion?.mandatory ?? false;
}
```

Template identification uses `launchTemplateId` (the template that launched this wizard) and
`companionTemplateIds` (its declared companion templates), both from `session.context.get()` —
see the SDK types for their shapes.

## Shared-secret recipe

When params that must match across apps have `data_type: "secret"`, create the
secret **once** and bind the same secret ID to both apps:

```js
// 1. Pick or create once. Passing { bytes } arms the picker's create-inline Generate button
//    with a host-generated random value; omit bytes for a secret the user brings.
const [mfaSessionKey] = await session.fastedge.secrets.pickOrCreate({
    name: 'totp-mfa-session-key',
    bytes: 32,  // 32-byte random key, HS256-safe
});

// 2. Bind the same secret ID to both apps — never let the user enter it twice
const authApp = await session.fastedge.apps.create({
    name: appName,
    api_type: 'wasi-http',
    source: { fromTemplateId: launchTemplateId },
    env: {
        AUTH_PREFIX,
        MFA_AUDIENCE,
        KV_STORE_ID,
        KV_STORE_NAME,
    },
    secretRefs: { MFA_SESSION_KEY: mfaSessionKey.id },
});

const mfaFilter = await session.fastedge.apps.create({
    name: filterName,
    api_type: 'proxy-wasm',
    source: { fromTemplateId: companionTemplateIds[0] },
    env: {
        AUTH_PREFIX,       // same value
        MFA_AUDIENCE,      // same value
    },
    secretRefs: { MFA_SESSION_KEY: mfaSessionKey.id },  // same id
});
```

**Invariant:** both apps carry the same secret reference. If they diverge the
filter rejects every session. Create once, bind everywhere.
