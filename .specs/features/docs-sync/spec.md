# Milestone 19 — Documentation Sync Specification

**Feature slug:** `docs-sync`  
**Milestone:** ROADMAP M19  
**Design SoT:** [PROJECT.md](../../project/PROJECT.md), [ROADMAP.md](../../project/ROADMAP.md), [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md)  
**Depth:** Medium (docs only — no `design.md`)

## Problem Statement

Project docs still describe pre-v1 or mid-backlog reality: `PROJECT.md` mentions `simple-git` and “commander TBD”, ROADMAP header/`Status` fields on finished features drift (e.g. csv-bundle still `Planned` in places), README under-documents JSON/compare/API/export formats, and `INTEGRATIONS.md` still lists `simple-git` as an option though the implementation is `child_process.spawn` only.

## Goals

- [x] Align `PROJECT.md` with post-v1 + M7–M18 capabilities
- [x] Fix stale Status/header text on Done milestones (ROADMAP + feature `spec.md`/`design.md`/`tasks.md` where wrong)
- [x] Update `README.md` for full JSON (M9/M11), compare JSON, programmatic API, markdown/csv (incl. M18 bundle)
- [x] Fix `INTEGRATIONS.md` Git section: `child_process.spawn` only — remove `simple-git`
- [x] No application code changes under `src/`, `bin/`, or behavior tests (docs + status metadata only)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Implementing M14/M20–M24 features | Separate milestones |
| Rewriting ARCHITECTURE from scratch | Incremental sync only where stale |
| Changing CLI behavior | Docs only |
| New marketing site | YAGNI |

---

## User Stories

### P1: PROJECT.md reality check ⭐ MVP

**User Story**: As a new contributor, I want `PROJECT.md` to describe the actual stack and shipped scope so that I do not plan against obsolete constraints.

**Acceptance Criteria**:

1. WHEN reading Tech Stack THEN Git SHALL be documented as `child_process.spawn` (not simple-git) and CLI as `commander` (implemented)
2. WHEN reading Scope THEN it SHALL reflect shipped post-v1 features through M18 at a summary level (path scoping, harmonic score, rich output, export formats, function granularity, compare, format-scoped top, CSV bundle) without claiming M14+ as done
3. WHEN reading Goals/vision THEN hotspot formula SHALL match harmonic mean `2ch/(c+h)` if score is mentioned

**Independent Test**: Manual review / grep — no `simple-git` in PROJECT.md; commander not TBD.

**Requirements**: HOTSPOT-153

---

### P1: Stale status cleanup ⭐ MVP

**User Story**: As a planner, I want Done milestones to show accurate Status so that ROADMAP and feature folders do not contradict reality.

**Acceptance Criteria**:

1. WHEN ROADMAP header is read THEN it SHALL reflect current backlog focus (not claim only M18 if inaccurate after this sync — state M19 in progress / docs planned as appropriate)
2. WHEN Done feature folders are checked (at least `csv-bundle`, and any other clearly Done milestone still marked `Status: Planned` in spec/design/tasks) THEN Status SHALL be corrected to `Done` where implementation is complete
3. WHEN a feature is only Planned (M14, M20+) THEN Status SHALL remain Planned — do not mark Done

**Independent Test**: Grep `Status: Planned` under Done feature dirs listed in ROADMAP as `[x]`.

**Requirements**: HOTSPOT-154

---

### P1: README completeness ⭐ MVP

**User Story**: As a package consumer, I want README examples for JSON shape, compare mode, library API, and markdown/csv exports so that I can adopt the CLI without reading specs.

**Acceptance Criteria**:

1. WHEN README documents JSON THEN it SHALL show/mention raw metrics (M9), `functions` / `granularity` (M11), and that `--top` does not slice JSON (M16)
2. WHEN README documents compare THEN it SHALL show `--baseline` and delta JSON/table overview
3. WHEN README documents programmatic use THEN it SHALL point at `runScan` / public exports from package entry
4. WHEN README documents formats THEN it SHALL cover `table`, `json`, `markdown`, and `csv` (M18 multi-file bundle + required `--output`)

**Independent Test**: Section headings / examples present; no claim of M17 multi-block CSV as current behavior.

**Requirements**: HOTSPOT-155

---

### P1: INTEGRATIONS.md Git accuracy ⭐ MVP

**User Story**: As an agent following INTEGRATIONS.md, I want a single Git invocation story so that I do not introduce `simple-git`.

**Acceptance Criteria**:

1. WHEN Git section is read THEN invocation SHALL be `child_process.spawn` only
2. WHEN `simple-git` is searched in INTEGRATIONS.md THEN there SHALL be zero recommendations to use it (historical note optional but must not present as current option)
3. WHEN related rules/skills still say “or simple-git” as active guidance THEN they SHOULD be fixed if touched by the same stale phrase in `.specs/codebase/` (INTEGRATIONS is mandatory; `.cursor/rules/integrations.mdc` if it still offers simple-git as equal option)

**Independent Test**: Grep `simple-git` in INTEGRATIONS.md.

**Requirements**: HOTSPOT-156

---

### P1: Consistency pass ⭐ MVP

**User Story**: As a maintainer, I want a light pass on STACK.md / obvious contradictions called out by ROADMAP M19 bullets so docs agree.

**Acceptance Criteria**:

1. WHEN STACK.md already says spawn-only THEN leave consistent; if it disagrees with INTEGRATIONS, fix the stale one
2. WHEN M19 ROADMAP checklist items are satisfied THEN mark them `[x]` in ROADMAP during Execute of this feature

**Independent Test**: Cross-read PROJECT + INTEGRATIONS + STACK Git lines.

**Requirements**: HOTSPOT-157

---

## Edge Cases

- WHEN a Done feature’s `tasks.md` Status is `Done` but `spec.md` still says Planned THEN fix spec/design Status only — do not rewrite historical requirement tables en masse
- WHEN unsure whether a milestone is Done THEN use ROADMAP `[x]` checkboxes as source of truth

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-153 | P1: PROJECT.md | Tasks T1 | Done |
| HOTSPOT-154 | P1: Stale status | Tasks T2 | Done |
| HOTSPOT-155 | P1: README | Tasks T3 | Done |
| HOTSPOT-156 | P1: INTEGRATIONS.md | Tasks T1 | Done |
| HOTSPOT-157 | P1: Consistency + ROADMAP | Tasks T4 | Done |

**Coverage:** 5 total, 5 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] No active `simple-git` guidance in PROJECT.md / INTEGRATIONS.md
- [x] README covers JSON, compare, API, markdown/csv bundle
- [x] Stale Planned statuses on Done milestones corrected
- [x] Docs-only diff — no `src/` / `bin/` behavior changes
