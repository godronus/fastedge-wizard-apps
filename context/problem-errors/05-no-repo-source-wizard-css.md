# 05 — No repo-level source `wizard.css`

**Hit while:** checking how base/token styling is provided to a new wizard.
**Severity:** friction; can't self-check the CI styling gate locally.

## What

`CONTRIBUTING.md` says the portal injects `/styles/v1/wizard.css` (classless base
+ `--gc-*` tokens) into every wizard, so authors write semantic HTML with no
`<link>`. But there is **no maintained source `wizard.css` at the
`fastedge-wizard-apps` repo level**. What exists:

- `release/styles/v1/wizard.css` — a build artifact (gitignored output).
- `node_modules/@gcore/fastedge-wizard-sdk/mock-host/wizard.css` — the SDK's copy,
  used by the mock host.

So the token base a wizard is styled against is owned by the SDK, not visible or
version-pinned in this repo as source.

## Why it matters

- A contributor can't easily read the **canonical token list** the CI lint gate
  enforces (`var(--gc-*)`) — CONTRIBUTING says "the token reference is in
  `context/INDEX.md`", but INDEX has no token table.
- Local render depends on whichever `wizard.css` the installed SDK ships; the
  production-injected one could differ, so light/dark self-checks aren't
  authoritative.

## What would resolve it

Either commit the canonical `styles/v1/wizard.css` (or a token reference) as
source in this repo and have the build/mock-host consume it, or add an explicit
`--gc-*` token table to `context/INDEX.md` and state which artifact is
authoritative.
