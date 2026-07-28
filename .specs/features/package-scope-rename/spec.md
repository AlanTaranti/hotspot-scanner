# Milestone 79 — Package Scope Rename Specification

**Feature slug:** `package-scope-rename`  
**Milestone:** ROADMAP M79  
**Depth:** Large (many files, zero pipeline logic)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1700–1719 (1711–1719 reserved)

## Problem Statement

The published-facing package identity is still `@vitals/hotspot-scanner` while the author and GitHub ownership are `taranti`. Docs, agents, and `PACKAGE_NAME` disagree with real ownership, which confuses adopters and agents about which scope to cite. The CLI bin and Cursor skill folder names are intentionally separate and must stay put.

## Goals

- [ ] `package.json` `"name"` and exported `PACKAGE_NAME` are `@taranti/hotspot-scanner`
- [ ] `rg '@vitals/hotspot-scanner'` returns zero matches across the repository
- [ ] Adoption docs (README / CONTRIBUTING / recipes) show package vs bin correctly with the new scope
- [ ] Living docs, Done feature prose that cites the package string, and Cursor agent/skill prose are updated
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Rename skills / folders `vitals-*` | Existing STATE decision (2026-07-21); separate churn |
| Rename CLI bin `hotspot-scanner` | ADR-2026-021; not npm package identity |
| Rename config `.hotspot-scanner.json` | Not npm package identity |
| npm publish / `publishConfig` / npx / `pnpm dlx` | Deferred STATE |
| Scan / trend / assess API, schemas, JSON contract `version` | Only the package name string changes |
| Rename `#` subpath import keys | Not package identity |

---

## User Stories

### P1: Code package identity ⭐ MVP

**User Story**: As a library consumer or agent reading the public entry, I want `package.json` and `PACKAGE_NAME` to say `@taranti/hotspot-scanner` so that identity matches ownership.

**Why P1**: Single source of truth for the npm package name in code.

**Acceptance Criteria**:

1. WHEN `package.json` is read THEN `"name"` SHALL be `@taranti/hotspot-scanner`
2. WHEN the package entry is imported THEN `PACKAGE_NAME` SHALL equal `@taranti/hotspot-scanner`
3. WHEN `src/index.test.ts` runs THEN it SHALL assert `PACKAGE_NAME` equals `@taranti/hotspot-scanner`
4. WHEN `bin` / `"imports"` / schema export paths are checked THEN they SHALL remain unchanged aside from the `"name"` field

**Independent Test**: `pnpm test -- src/index.test.ts` after updating name + constant + assertion.

**Requirements:** HOTSPOT-1700, HOTSPOT-1701, HOTSPOT-1702

---

### P1: Adoption / product docs ⭐ MVP

**User Story**: As an evaluator cloning the repo, I want README, CONTRIBUTING, recipes, PROJECT, STACK, and AGENTS identity to cite `@taranti/hotspot-scanner` while CLI examples still use `hotspot-scanner`.

**Why P1**: First-screen and day-2 docs must not advertise the old scope.

**Acceptance Criteria**:

1. WHEN README / CONTRIBUTING / `docs/recipes.md` mention the npm package name THEN they SHALL use `@taranti/hotspot-scanner`
2. WHEN those docs show CLI invocation THEN they SHALL continue to use `hotspot-scanner` / `pnpm exec hotspot-scanner` (bin unchanged)
3. WHEN PROJECT.md, STACK.md, and AGENTS.md identity headers/rows cite the package THEN they SHALL use `@taranti/hotspot-scanner`

**Independent Test**: Grep those files for the old string (zero) and spot-check package vs bin wording.

**Requirements:** HOTSPOT-1703, HOTSPOT-1704

---

### P1: Living docs + historical feature prose ⭐ MVP

**User Story**: As an agent loading Design SoTs and historical specs, I want every exact citation of `@vitals/hotspot-scanner` updated so living and archived prose do not contradict ownership.

**Why P1**: Full identity sweep includes Done feature specs and living docs, not only adoption docs.

**Acceptance Criteria**:

1. WHEN `.specs/codebase/*` identity headers or package citations are checked THEN they SHALL use `@taranti/hotspot-scanner` (no leftover `@vitals/hotspot-scanner`)
2. WHEN `.specs/project/*` (including ROADMAP/STATE title lines and STATE-ARCHIVE citations) are checked THEN exact `@vitals/hotspot-scanner` SHALL be gone
3. WHEN Done feature specs under `.specs/features/` cite the exact package string THEN those citations SHALL be updated to `@taranti/hotspot-scanner`
4. WHEN schemas / JSON contracts are checked THEN their shapes and `version` fields SHALL be unchanged

**Independent Test**: `rg '@vitals/hotspot-scanner' .specs/` returns empty; spot-check one schema `version` unchanged.

**Requirements:** HOTSPOT-1705, HOTSPOT-1706, HOTSPOT-1709

---

### P1: Cursor surface (prose only) ⭐ MVP

**User Story**: As an agent session, I want `.cursor/` agents, skill prose, and `session-context.mjs` to cite `@taranti/hotspot-scanner` without renaming `vitals-*` skill directories.

**Why P1**: Agents otherwise inject the old scope into every session.

**Acceptance Criteria**:

1. WHEN `.cursor/agents/*.md`, skill `SKILL.md` / references prose, and `session-context.mjs` are grepped THEN `@vitals/hotspot-scanner` SHALL not appear
2. WHEN skill directory names are listed THEN `vitals-*` folders SHALL still exist with those names
3. WHEN `#` import aliases in `package.json` are checked THEN they SHALL be unchanged

**Independent Test**: `rg` on `.cursor/` for old string empty; `ls .cursor/skills` still shows `vitals-*`.

**Requirements:** HOTSPOT-1707, HOTSPOT-1710

---

### P1: Sweep verify + project gate ⭐ MVP

**User Story**: As a maintainer, I want a repo-wide leftover check and the project gate green so the rename is complete and safe.

**Why P1**: Definition of Done for identity work.

**Acceptance Criteria**:

1. WHEN `rg '@vitals/hotspot-scanner'` is run at the repo root THEN it SHALL return zero matches
2. WHEN `pnpm build && pnpm test` runs THEN it SHALL exit 0
3. WHEN CLI bin metadata is checked THEN `package.json` `"bin"` key SHALL remain `hotspot-scanner`

**Independent Test**: Sweep command + project gate.

**Requirements:** HOTSPOT-1708, HOTSPOT-1710

---

## Edge Cases

- WHEN a file mentions `vitals` only as a skill folder or historical workflow name (e.g. `vitals-spec-driven`) THEN the system SHALL leave those names unchanged (not the package string)
- WHEN a fixture or schema does not embed `@vitals/hotspot-scanner` THEN Execute SHALL not invent package-name fields
- WHEN STATE Deferred still mentions npm publish THEN that deferral SHALL remain (no publish in this milestone)
- WHEN ROADMAP Current already lists M79 from planning THEN Execute SHALL not re-litigate scope; only complete the string sweep including title lines

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1700 | P1: Code — `package.json` name | Tasks | Pending |
| HOTSPOT-1701 | P1: Code — `PACKAGE_NAME` export | Tasks | Pending |
| HOTSPOT-1702 | P1: Code — unit test assertion | Tasks | Pending |
| HOTSPOT-1703 | P1: Adoption docs package vs bin | Tasks | Pending |
| HOTSPOT-1704 | P1: PROJECT / STACK / AGENTS identity | Tasks | Pending |
| HOTSPOT-1705 | P1: Living `.specs/codebase` + project titles | Tasks | Pending |
| HOTSPOT-1706 | P1: Done feature specs / archive prose | Tasks | Pending |
| HOTSPOT-1707 | P1: Cursor agents / skills prose / session-context | Tasks | Pending |
| HOTSPOT-1708 | P1: Repo-wide zero leftovers | Tasks | Pending |
| HOTSPOT-1709 | P1: Schemas / API / contracts untouched | Tasks | Pending |
| HOTSPOT-1710 | P1: Bin unchanged + skills folders unchanged + gate | Tasks | Pending |
| HOTSPOT-1711–1719 | — | — | Reserved |

**Coverage:** 11 requirements mapped to tasks (T1–T5); 1711–1719 reserved unused.

---

## Success Criteria

- [ ] Package identity is `@taranti/hotspot-scanner` in code and `PACKAGE_NAME`
- [ ] Zero repository matches for `@vitals/hotspot-scanner`
- [ ] Adoption docs distinguish new package scope from unchanged bin
- [ ] `vitals-*` skill directories and bin `hotspot-scanner` unchanged
- [ ] `pnpm build && pnpm test` green
