# 03 — `secrets.create` can't set the secret value

**Hit while:** planning secret handling for the TOTP shared keys.
**Severity:** degrades UX; forces manual entropy + manual matching.

## What

`SecretCreateParams` is literally `{ name: string; comment?: string }`
(`types.d.ts`) — **no value field** — and `secrets.create` "opens the portal's
create-secret modal" (write-intents DOCS, step 3). So the *user* types the value
in the portal; the wizard never sees or sets it.

## Why it matters for TOTP

Three params are "long random string" secrets: `MFA_SESSION_KEY`, `HANDOFF_KEY`,
`ENROLL_API_KEY` (plus Profile B's `MFA_PROOF_SIGNING_KEY`, an ES256 PEM).

- The wizard would like to offer **generate-for-me** (`crypto.getRandomValues`,
  and `crypto.subtle.generateKey` for the ES256 pair) so users don't invent weak
  keys. It can't — it can't push the generated value into the secret.
- `MFA_SESSION_KEY` must be **byte-identical on both apps**. The structural fix is
  "create one secret, reuse its `secretRef` id on both `apps.create` calls" — this
  *does* work (secretRefs is `Record<string, number>`), so identity is safe. But
  the wizard still can't guarantee the *value* was generated well, only that both
  apps point at the same secret.

## What would resolve it

A create-with-value path (host-side, value never logged/echoed back), or a
`secrets.generate({ name, bytes })` intent where the host mints the random value
and returns only the ref. Public, non-secret material (Profile B's
`MFA_PROOF_PUBLIC_JWK`) is fine — it's a plain env var the wizard can set.

## Resolution-path note

Whether a value-setting create exists but is undocumented should be confirmed
against the **SDK repo** (`godronus/fastedge-wizard-sdk`, public) — the installed
`.d.ts` shows no value field, but the repo's consumption guide is the tiebreaker.
See problem-error 06 on making that guide easier to find.
