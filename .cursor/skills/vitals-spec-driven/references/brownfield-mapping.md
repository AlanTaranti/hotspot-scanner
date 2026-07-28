# Brownfield Mapping (hotspot-scanner)

**Trigger:** "Map codebase", "Refresh codebase docs", "Document current architecture"

**Purpose:** Keep [.specs/codebase/](../../../../.specs/codebase/) accurate. This CLI already has living Design SoTs — **do not** regenerate all seven docs from generic templates.

**Ownership:** [DOC-OWNERSHIP.md](../../../../.specs/codebase/DOC-OWNERSHIP.md). Editorial: matching `*-sot.mdc` under `.cursor/rules/`.

---

## Default: incremental refresh

1. Identify which living docs the change touches (ARCHITECTURE, CONCERNS, INTEGRATIONS, STRUCTURE, STACK, CONVENTIONS, TESTING).
2. Read the current file + its `*-sot.mdc` before editing.
3. Update **only** affected sections in present tense — no `M##`, no changelog voice, no flag encyclopedias (see each sot rule).
4. Skip files that did not change.

Full remapping of all seven files is allowed **only** when the user explicitly asks, or docs are missing / severely outdated.

---

## Living docs (do not invent alternate templates)

| File | Role | Editorial rule |
| ---- | ---- | -------------- |
| ARCHITECTURE.md | Modules, pipelines, contracts | architecture-sot.mdc |
| CONCERNS.md | Fragile risks / RT / mitigations | concerns-sot.mdc |
| INTEGRATIONS.md | Spawn / deps / fs / mocks | integrations-sot.mdc |
| STRUCTURE.md | Directory layout / Path\|Role | structure-sot.mdc |
| STACK.md | Runtime / deps / publish inventory | stack-sot.mdc |
| CONVENTIONS.md | Naming, ESM, dual-tsconfig, scripts | conventions-sot.mdc |
| TESTING.md | Fixtures, Vitest, coverage, gates | testing-sot.mdc |

Also related (not under `.specs/codebase/`): PROJECT.md, ROADMAP.md, STATE.md — use their sot rules / [roadmap-sync.md](../../vitals-common/references/roadmap-sync.md).

---

## Discovery (when refreshing)

1. Walk `src/`, `bin/`, `schemas/`, `tests/fixtures/` against STRUCTURE.md.
2. Diff `package.json` / tsconfigs against STACK.md and CONVENTIONS.md.
3. Confirm adapter spawn sites against INTEGRATIONS.md.
4. Sample fragile paths (`src/git/`, `src/complexity/`, `src/scoring/`) against CONCERNS.md.
5. Prefer evidence from the repo over assumed web-app patterns — this is a local Node CLI, not a frontend/SaaS stack.

---

## Anti-patterns

- Pasting generic Frontend / Webhooks / Background Jobs / ORM sections into living docs
- Duplicating cli-reference flag tables into ARCHITECTURE or STRUCTURE
- Recreating all seven files when only one module changed

---

## Related

- Concerns procedure: [concerns.md](concerns.md)
- Design phase: [design.md](design.md)
- Index: [AGENTS.md](../../../../AGENTS.md)
