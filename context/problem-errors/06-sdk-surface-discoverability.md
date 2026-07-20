# 06 — SDK intent surface is under-discoverable

**Hit while:** the whole study — figuring out what the wizard can actually do.
**Severity:** meta; every future contributor re-does this archaeology.

## What

The authoritative wizard capability surface is the SDK's typed `WizardSession`
(`node_modules/@gcore/fastedge-wizard-sdk/dist/types.d.ts` + `sdk.d.ts`). That's
what settles "can a wizard create a KV store / wire CDN / set a secret value" —
the answers to problem-errors 01–03 all came from it.

But nothing points a new contributor there directly:

- `CONTRIBUTING.md` shows two API *calls* (`connect`, `templates.list`) and
  otherwise defers to `context/INDEX.md`.
- `INDEX.md` hand-maintains a **"Session API (current)"** code block. It's close
  but not the source of truth — a prose list that can (and will) drift from the
  real `.d.ts` (e.g. it can't convey that `SecretCreateParams` has no value
  field, which is the crux of problem-error 03).
- The SDK repo's own consumption guide is a single easily-missed row in INDEX's
  component table ("SDK migration + consumption guide →
  `fastedge-wizard-sdk/context/INDEX.md`").

Net: to answer "what can a wizard do", you must know to dig into `node_modules`
`.d.ts` files — not obvious, and not mentioned.

## Why it matters

This is the first question every wizard author has, and the one that decides
scope. Leaving it to archaeology means each contributor repeats this study (and
risks trusting the drifting prose summary).

## What would resolve it (answers the "should this be easier to find?" ask)

- In `CONTRIBUTING.md`, add: *"The authoritative wizard capability surface is the
  SDK's `WizardSession` type — `@gcore/fastedge-wizard-sdk/dist/sdk.d.ts` /
  `types.d.ts` (source: `godronus/fastedge-wizard-sdk`)."*
- In `INDEX.md`, mark the "Session API (current)" block as a **convenience
  summary** and link the `.d.ts` / SDK repo as the source of truth, so the two
  can't silently diverge.
- The SDK repo is public — linking it prominently is safe and removes the
  node_modules-spelunking step entirely.
