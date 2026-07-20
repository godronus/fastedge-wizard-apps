# 04 — Fixtures + mock host stub fastedge only (no KV / no CDN)

**Hit while:** planning local dev of the TOTP wizard.
**Severity:** blocks local iteration on the KV/CDN steps.

## What

The mock host (`dev.mjs`) loads `fixtures/{templates,apps,secrets}.json` and
serves them as intent responses (INDEX "Mock host"; write-intents DOCS). That
covers exactly the three fastedge namespaces the SDK exposes. There are **no
fixtures for KV stores or CDN resources**, because there are no intents for them
(see problem-errors 01, 02).

There are also no TOTP fixtures — `write-intents/fixtures/templates.json` is a
generic set (geo-redirect, S3, etc.), not templates 189/190.

## Why it blocks

Even the buildable parts of the TOTP wizard (two-app plan/apply) can't be
exercised locally without `templates.json` entries for the two TOTP templates
with their real `params[]`. And the blocked parts (KV, CDN) have nothing to mock
against at all — so there's no way to develop or screenshot-test those steps
before the intents exist.

## What would resolve it

- A TOTP `fixtures/` set (templates 189/190 with fudged ids, matching
  `registry.json` params) — buildable today via `/sync-wizard-fixtures` once the
  templates exist on an account.
- KV/CDN fixture schemas + mock-host handlers — but only after 01/02 define the
  intents.
