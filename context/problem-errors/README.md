# problem-errors

Barriers hit while trying to build real wizards. Each file = one blocker: what it
is, where it bit, and what would resolve it. This is a **triage backlog** — it
tells the platform team what to build next so wizards can go further than
"write some intents".

First populated: **2026-07-17**, attempting a React TOTP wizard for the
`edge-totp` template (two deployables, KV, CDN) as a fresh contributor working
only from `CONTRIBUTING.md`. See `context/WIZARD_FIRST_ATTEMPT.md` for the
generic wizard requirements this journey exercised.

| # | Blocker | Severity for TOTP |
|---|---------|-------------------|
| 01 | No KV store intent | Blocks (verify/enroll need KV name+id) |
| 02 | No CDN wiring intent | Blocks (Profile A "zero origin code" impossible) |
| 03 | `secrets.create` can't set a value | Degrades (no generate-for-me / auto-shared keys) |
| 04 | Fixtures/mock-host stub fastedge only | Blocks local dev of KV/CDN steps |
| 05 | No repo-level source `wizard.css` | Friction (can't self-check token/base styling) |
| 06 | SDK surface under-discoverable | Meta (future contributors reinvent this study) |
