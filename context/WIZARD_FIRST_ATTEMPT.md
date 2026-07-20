# WIZARD_FIRST_ATTEMPT — experiment protocol (how to re-run, cold)

This is a **reproducible experiment**: measure where an agent hits walls building a
*real, complex* wizard, given only what a new external contributor would have.
Run it once, log the walls, fix the platform, delete the logs, run it again — the
walls should be gone (and new ones will surface). This file is the charter; keep
it free of findings so each run starts uncontaminated.

> **If you are the agent running this: do not read past this file's protocol for
> hints.** Do not read `fastedge-frontend/docs/wizards/` and do not read any
> leftover `context/problem-errors/` from a prior run. Those are exactly the
> "prior info" a fresh contributor would not have. Discover everything yourself.

## Your role

You are a **brand-new external contributor** to `FastEdge-Wizard-apps`. Your only
entry point is `fastedge-wizard-apps/CONTRIBUTING.md` and whatever it legitimately
leads you to:

- what `CONTRIBUTING.md` links (e.g. `context/INDEX.md`),
- the existing example wizard(s) under `wizards/`,
- the SDK's typed surface after `pnpm install` (the installed
  `@gcore/fastedge-wizard-sdk` types are fair game — a real contributor has them),
- the target template's own repo/docs (below — you're integrating against it).

**Off-limits** (you would not have these as an external contributor):
`fastedge-frontend/docs/wizards/` and any prior `context/problem-errors/`.

## The task

Build a **React-based wizard** that makes deploying the **`edge-totp`** template a
seamless journey for a new user. Source template:

```
backend/repos/fastedge-coordinator/FastEdge-templates/edge-totp
```

It is deliberately hard: two deployables (a wasi-http app + a proxy-wasm filter),
shared keys/config, a KV store, secrets, and CDN wiring. You are **not** expected
to fully succeed — the point is to discover where it becomes impossible.

## Procedure

1. **Follow `CONTRIBUTING.md`** to learn how wizards are built here (SDK, mock
   host, styling/token rules, build, PR flow). Do a `pnpm install`.
2. **Inspect the `edge-totp` template** end to end — its README, both components'
   `registry.json` and `.env.example`, and its integration/architecture docs — so
   you understand every step a human does today to deploy and wire it up.
3. **Write generic notes** — "what a wizard should provide" — before writing any
   wizard code. Append them to this file under a dated `## Attempt <YYYY-MM-DD>`
   heading (leave this protocol section on top, intact).
4. **Attempt the wizard.** As you hit each wall, log it as one focused file in
   `context/problem-errors/` (what it is, where it bit, what would resolve it).
   Create that directory fresh.
5. **If you get completely stuck, ask — do not invent concepts, intents, or APIs.**
   If the information isn't available to you, log it as a problem-error and stop;
   the maintainer will grant access on request.

## What "done" looks like for a run

- A dated attempt section in this file with the generic wizard requirements.
- A populated `context/problem-errors/` (or, ideally on a later run, a nearly
  empty one — that's the signal the platform work paid off).
- Whatever wizard code you got working under `wizards/`, honest about what's
  stubbed or handed off vs. actually functional.

## After a run

The maintainer turns the logged walls into tasks (`docs/wizards/tasks/`), works
them, then **deletes `context/problem-errors/`** and re-runs this protocol to
verify. The delta between runs is the result.
