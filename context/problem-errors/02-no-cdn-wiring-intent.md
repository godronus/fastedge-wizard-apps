# 02 — No CDN wiring intent in the SDK

**Hit while:** mapping the `edge-totp` deploy steps (README "Deploy" + CDN wiring)
to the wizard SDK.
**Severity:** blocks the core value proposition.

## What

`edge-totp` is only "deployed" once traffic is wired at the CDN (README +
`context/integration.md`):

1. Attach `otp-app` as a **CDN origin** on the `{AUTH_PREFIX}/*` path rule of the
   customer's CDN resource.
2. Attach `otp-filter` as the **CDN proxy app** in front of the protected paths
   (bypassing `{AUTH_PREFIX}` + `/health`).
3. Lock the origin to **edge-only** ingress.

None of this is expressible. The SDK has **no CDN namespace at all** — no
resources, no path rules, no origin attach, no proxy-app attach. `apps.create`
returns an app id/url; there is no follow-up to bind it into a CDN resource.

## Why it blocks

Profile A — the **default** and the whole selling point ("zero origin code, the
filter enforces") — depends entirely on step 2 (attach the filter as the CDN
proxy app). Without a CDN intent the wizard can create two apps that **do
nothing**: no traffic reaches them, and nothing is actually protected. Worse, a
half-wired setup is a **security footgun** (origin reachable directly ⇒ MFA
bypassed), so the wizard cannot silently stop at "apps created".

## What would resolve it

Either:
- a CDN intent set (list/create CDN resource, add/patch path rule, attach app as
  origin, attach proxy-wasm app as filter), **or**
- an explicit decision that CDN wiring stays manual — in which case the wizard's
  contract must include a **generated, accurate, ordered handoff checklist** and
  this limitation must be documented in `CONTRIBUTING.md` so wizard authors don't
  promise end-to-end deploys they can't deliver.
