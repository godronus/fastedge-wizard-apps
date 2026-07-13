# Agent Orchestration

Read `CLAUDE.md` then `context/INDEX.md` first. This file adds orchestration
guidance only.

## Scope

When assigned to a specific wizard, read its `context/wizards/<name>/DOCS.md`
before touching any code. Treat the wizard directory as its own self-contained
unit — do not read other wizard directories.

## Parallelism

Different wizards have no shared source files. Work on them in parallel agents
safely. Shared concerns (root `CLAUDE.md`, `context/INDEX.md`,
`pnpm-workspace.yaml`) should be handled by a single coordinating agent.

## Adding a Wizard

Spawn one agent per wizard when creating or updating multiple wizards. Each
agent:
1. Works only in its assigned wizard directory
2. Creates or updates `context/wizards/<name>/DOCS.md`
3. Reports the `context/INDEX.md` registry row to add — the coordinating agent
   applies it to avoid merge conflicts.
