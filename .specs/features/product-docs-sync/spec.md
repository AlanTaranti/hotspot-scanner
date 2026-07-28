# Milestone 25 — Product Docs Sync Specification

**Feature slug:** `product-docs-sync`  
**Milestone:** ROADMAP M25  
**Design SoT:** [PROJECT.md](../../project/PROJECT.md), [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [README.md](../../../README.md)  
**Depth:** Medium (docs only — thin `design.md`)  
**Sister pattern:** [docs-sync](../docs-sync/spec.md) (M19)

## Problem Statement

Living product docs still lag shipped M19–M24. `PROJECT.md` claims scope through M18 and lists M20–M22 as “planned” though ROADMAP marks them Done. README and ARCHITECTURE Key constraints omit or understate rename handling (`PathAliasMap` / `old => new`, **not** `git log --follow`) and function-mode M23 hunk-overlap churn. Some Done feature `design.md` Status fields remain `Planned`. Contributors and agents risk planning against obsolete backlog.

## Goals

- [x] Align `PROJECT.md` shipped scope and backlog with reality through M24
- [x] Fix rename / `--follow` and M23 function-churn drift in README and ARCHITECTURE Key constraints
- [x] Correct stale `Status: Planned` on Done feature design artifacts (M22–M24 at minimum)
- [x] Verify ROADMAP header and STATE Active prose match delivered + post-M24 backlog stubs (parent owns final Specs link sync)
- [x] No application behavior changes under `src/`, `bin/`, or tests

## Out of Scope

| Feature                                    | Reason                                      |
| ------------------------------------------ | ------------------------------------------- |
| Implementing M26–M30 features              | Separate milestones                         |
| Emitting new rename/confidence warnings    | M26 (`rename-confidence`)                   |
| Rewriting ARCHITECTURE from scratch        | Incremental sync only where stale           |
| Changing CLI / pipeline behavior           | Docs only                                   |
| Parent ROADMAP Specs-link sync for M25–M30 | Parent session; this feature verifies prose |

---

## User Stories

### P1: PROJECT.md through M24 ⭐ MVP

**User Story**: As a new contributor, I want `PROJECT.md` to list what is actually shipped through M24 so that I do not treat Done milestones as backlog.

**Why P1**: ROADMAP M25 bullet #1; clearest stale doc found in audit.

**Acceptance Criteria**:

1. WHEN reading Scope shipped heading THEN it SHALL say through **M24** (not M18)
2. WHEN reading shipped bullets THEN they SHALL summarize M19–M24 at product level (docs sync history optional; at least: JSON schemas M20, `.hotspot-scanner.json` M21, extended function AST M22, per-function hunk churn M23, package DX M24) plus earlier post-v1 items already listed (M7–M18); M14 `hasStaticDependency` SHALL appear if coupling enrichment is mentioned
3. WHEN reading Excludes / backlog THEN there SHALL be **no** “M20, M21, M22 — planned” (or equivalent) line
4. WHEN reading Excludes / backlog THEN true non-goals remain (CI gate, non-TS/JS, relative churn) and post-M24 work is pointed at ROADMAP stubs — not listed as if unimplemented M20–M22

**Independent Test**: Grep PROJECT.md for `M18)`, `M20`, `planned`; confirm shipped header and absence of planned M20–M22.

**Requirements**: HOTSPOT-221

---

### P1: Rename / `--follow` accuracy ⭐ MVP

**User Story**: As a reader of README or ARCHITECTURE, I want rename handling documented as `old => new` + `PathAliasMap` (not global `--follow`) so that I do not propose invalid Git miner changes.

**Why P1**: ROADMAP M25 bullet #2; CONCERNS / STATE already correct — product surfaces lag.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE § Key constraints is read THEN it SHALL state rename via `old => new` + `PathAliasMap` and that global `git log --follow` is **not** used for mining
2. WHEN README How-it-works / Git section is read THEN it SHALL mention path rename canonicalization (`PathAliasMap` / `old => new`) and SHALL NOT present `--follow` as current behavior
3. WHEN searching README and ARCHITECTURE for active guidance to use `--follow` for global mining THEN zero such recommendations SHALL remain

**Independent Test**: Grep `--follow`, `PathAliasMap`, `old => new` in README.md and ARCHITECTURE.md Key constraints.

**Requirements**: HOTSPOT-222

---

### P1: README function-mode / M19–M24 gaps ⭐ MVP

**User Story**: As a package consumer, I want README pipeline notes to match M23 function churn (and not contradict shipped M19–M24 surfaces already documented) so that function-mode metrics are not misread as inherited file churn.

**Why P1**: Complements rename fix; ARCHITECTURE already documents hunk overlap — README still implies a single numstat-only story.

**Acceptance Criteria**:

1. WHEN README describes Git / function granularity THEN it SHALL state that `--granularity function` attributes churn via hunk overlap on a patch stream (`git log -p --unified=0` or equivalent wording), not by inheriting parent-file `FileChangeStats`
2. WHEN README Features / How it works already cover schemas, config, CSV bundle, compare THEN leave consistent; fix only contradictions or missing M23/rename notes
3. WHEN README claims a single Git pass for all modes THEN it SHALL be corrected to: file mode numstat pass; function mode adds patch stream for per-function churn

**Independent Test**: Manual section review + grep `hunk` / `function` / `inherited` in README.

**Requirements**: HOTSPOT-223

---

### P1: Stale Status on Done designs ⭐ MVP

**User Story**: As a planner, I want Done milestones’ `design.md` Status to say `Done` so that folders do not contradict ROADMAP `[x]`.

**Why P1**: Same class of drift M19 fixed; audit found M22/M23/M24 `design.md` still `Planned`.

**Acceptance Criteria**:

1. WHEN `function-ast-coverage/design.md`, `per-function-churn/design.md`, and `package-dx/design.md` are checked THEN Status SHALL be `Done` (ROADMAP marks those milestones complete)
2. WHEN other Done feature `design.md`/`spec.md`/`tasks.md` still say `Planned` for a ROADMAP `[x]` milestone THEN Status SHALL be corrected
3. WHEN a feature is only a post-M24 stub or not Done THEN Status SHALL NOT be marked Done

**Independent Test**: Grep `Status: Planned` under `.specs/features/{function-ast-coverage,per-function-churn,package-dx}/`.

**Requirements**: HOTSPOT-224

---

### P1: ROADMAP / STATE prose consistency ⭐ MVP

**User Story**: As a maintainer, I want ROADMAP header and STATE Active to agree with delivered M24 + backlog stubs so agents pick the right next milestone.

**Why P1**: ROADMAP M25 bullet #3; parent owns Specs link sync — this story verifies prose.

**Acceptance Criteria**:

1. WHEN ROADMAP header is read THEN it SHALL reflect M24 Done and post-M24 backlog M25–M30 (stubs or Specs as parent synced)
2. WHEN STATE Active is read THEN order SHALL match suggested execution (M26 before M25, then M27 → M28 → M30 → M29) unless parent has intentionally updated
3. WHEN STATE Decisions rows still claim feature Status `Planned` for milestones ROADMAP marks Done (e.g. M23/M18 spec Status wording) THEN they SHOULD be corrected to Done / historical — or flagged for parent if link-only
4. WHEN M25 Execute completes THEN ROADMAP M25 checklist bullets MAY be marked `[x]`; Specs link for this feature MAY be added by Execute or left to parent per handoff

**Independent Test**: Cross-read ROADMAP header + STATE Active; no contradictory “next is M25 only” if Active lists M26 first.

**Requirements**: HOTSPOT-225

---

### P1: Docs-only + project gate ⭐ MVP

**User Story**: As a maintainer, I want a full project gate after doc edits so that a docs-only change did not disturb the tree.

**Acceptance Criteria**:

1. WHEN the feature diff is reviewed THEN there SHALL be no intentional behavior changes under `src/`, `bin/`, or test logic (docs / Status metadata / STATE prose only)
2. WHEN Execute finishes THEN `pnpm build && pnpm test` SHALL pass

**Independent Test**: `git diff` path filter + gate command.

**Requirements**: HOTSPOT-226

---

## Edge Cases

- WHEN ARCHITECTURE already documents M23 hunk overlap in Function granularity THEN Key constraints only needs the rename/`--follow` bullet — do not duplicate long M23 sections
- WHEN README already documents schemas/config/CSV THEN do not rewrite those sections — surgical adds for rename + function churn
- WHEN unsure whether a milestone is Done THEN use ROADMAP `[x]` as source of truth
- WHEN parent has not yet linked M25–M30 Specs THEN verifying prose without inventing fake Specs URLs is enough; do not block on parent sync

---

## Requirement Traceability

| Requirement ID | Story                            | Phase    | Status |
| -------------- | -------------------------------- | -------- | ------ |
| HOTSPOT-221    | P1: PROJECT.md through M24       | Tasks T1 | Done   |
| HOTSPOT-222    | P1: Rename / `--follow` accuracy | Tasks T2 | Done   |
| HOTSPOT-223    | P1: README function-mode gaps    | Tasks T3 | Done   |
| HOTSPOT-224    | P1: Stale Status on Done designs | Tasks T4 | Done   |
| HOTSPOT-225    | P1: ROADMAP / STATE prose        | Tasks T5 | Done   |
| HOTSPOT-226    | P1: Docs-only + project gate     | Tasks T5 | Done   |

**ID range reserved:** HOTSPOT-221–HOTSPOT-230 (unused: 227–230)  
**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] PROJECT.md shipped through M24; no “M20–M22 planned” backlog line
- [x] README + ARCHITECTURE Key constraints document PathAliasMap / not `--follow`
- [x] README describes function-mode hunk-overlap churn (M23)
- [x] Done M22–M24 `design.md` Status = Done
- [x] ROADMAP header / STATE Active prose consistent with delivered + stubs
- [x] `pnpm build && pnpm test` passes; no scanner behavior change
