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
  `@gcoredev/fastedge-wizard-sdk` types are fair game — a real contributor has them),
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
verify. The delta between runs is the result. Only the **latest** run's results
are tracked below — replace this section on each re-run, don't append.

---

## Attempt 2026-07-21

Cold run against `edge-totp`. Entry point: `CONTRIBUTING.md` → `context/INDEX.md`,
`PARAM_CONSTRAINTS.md`, `_template-react`, `_example-intents`, `wizard-step-kit`,
the installed SDK `.d.ts`, and the `edge-totp` source repo. Did not read
`docs/wizards/`.

### Generic notes — what a wizard *should* provide (written before wizard code)

A wizard for a two-deployable template like this needs to:

1. **Identify the target templates at runtime** via `context.get()`
   (`launchTemplateId` + `companionTemplateIds`), then select the wasi-http app vs
   the proxy-wasm filter by `api_type` — never by hard-coded id.
2. **Read each template's params** (`templates.read({id}).params`) to drive form
   fields, labels, defaults, and secret/store field types.
3. **Encode cross-app / cross-field constraints the params can't express** — the
   shared value set (`MFA_SESSION_KEY`, `MFA_AUDIENCE`, `AUTH_PREFIX`,
   `MFA_SESSION_COOKIE`, `MFA_ISSUER`) and the `MFA_AUDIENCE` asymmetry
   (`mandatory:false` on the app, `true` and fail-closed on the filter).
4. **Provision supporting resources**: shared secret once → same id on both apps
   (`secrets.generate` → `secretRefs`); Profile-B ES256 keypair
   (`secrets.generateKeypair`); a KV store (`stores.pick`/`create`) feeding
   `KV_STORE_ID`/`KV_STORE_NAME`.
5. **Deploy both apps + CDN wiring in one plan** (`deployment.plan`/`apply`):
   origin on `{AUTH_PREFIX}`, filter on the rest.
6. **Guide, not just collect** — a stepped decision tree with inline explanation,
   a Profile A/B branch, per-step validation, and a review/confirm step.

### Outcome (honest) — SUCCESS

Shipped a **working** React wizard at `wizards/edge-totp/`:
`pnpm install` + `pnpm run build` pass; all four fixture files validate against the
SDK schemas; every intent the wizard calls (`context.get`, `templates.read`,
`secrets.generate`/`create`/`pick`/`generateKeypair`, `stores.pick`/`create`,
`cdn.resources.pick`, `deployment.plan`/`apply`) is handled by the mock host, so it
runs end-to-end with **no invented behaviour**. Six-step decision tree
(Overview → CDN → Config → Secrets & store → Profile A/B → Review/Deploy),
shared-secret recipe, MFA_AUDIENCE treated as required, CDN origin on
`{AUTH_PREFIX}` + filter on the rest. `TARGET.md` produced from the live API via
the `fastedge-assistant` MCP.

The friction this run was **environmental/documentation, not missing platform
capability** — five walls logged in `context/problem-errors/`, all resolvable by
doc/config fixes:

1. **Two SDKs on disk; CONTRIBUTING's `file:` path installs the stale one** (HIGH)
   — biggest time sink; reading the stale types produced a false "phantom API"
   conclusion until the path was corrected (`../../../` not `../../../../`).
2. **`/wizard-intake` not invocable as advised** — it's an `.claude/agents/`
   subagent (not a `/`-skill) and invisible from the monorepo root; its job is
   already covered by the `fastedge-assistant` MCP.
3. **Mock host hardcodes `launchTemplateId:1`/`companionTemplateIds:[3]`** —
   fixtures can't steer context, so template fixtures must use ids 1 and 3.
4. **No store-ref → app-env substitution in the plan** — must `stores.create/pick`
   before the plan and inject `KV_STORE_ID`/`NAME` into env by hand.
5. **Cross-app constraints (MFA_AUDIENCE asymmetry, shared set) only in prose** —
   API `metadata` carries only `default_value` and `long_descr` is empty for 734/735.

Net: the platform is capable enough to build this hard wizard without inventing
anything. Walls 1–3 are what would trip the next cold contributor; fixing the
CONTRIBUTING `file:` path and quarantining the stale SDK is the highest-leverage
change before a re-run.
