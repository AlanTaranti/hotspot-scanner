# Milestone 77 — Hotspot Assess Specification

**Feature slug:** `hotspot-assess`  
**Milestone:** ROADMAP M77  
**Depth:** Large  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1620–1679 (1660–1679 reserved)  
**Sisters:** [complexity-trend](../complexity-trend/spec.md) (M72), [growth-pattern-trend-bridge](../growth-pattern-trend-bridge/spec.md) (M75), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42); [trend-color-ux](../trend-color-ux/spec.md) (M76 Planned — do not block); [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do not reopen compare)

## Problem Statement

Maintainers can rank current hotspots (`scan`) and inspect one file’s growth pattern (`trend`), but finding **which top hotspots are deteriorating** still requires manual N× `trend` runs. A dedicated `assess` command batches scan → score filter → capped per-file trend classification into one report, without bloating scan JSON `3.0` or reopening compare.

## Goals

- [ ] CLI `hotspot-scanner assess [path]` with locked pipeline and flags
- [ ] Library export `runAssess` producing `AssessResult` (`kind: "hotspot-assess"`, `version: "1.0"`)
- [ ] Human reports (table/markdown): summary counts + detail **only** for `deteriorating`
- [ ] JSON schema under `schemas/hotspot-assess.json` — no full `points` dump; scan/trend contracts untouched
- [ ] Sequential trend with per-file progress; per-file failures soft-continue
- [ ] Docs note Prettier/indent cliff false positives; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `--fail-on-deteriorating` / SARIF / exit 1 for deteriorating | Deferred CI; formatter cliffs |
| CSV | YAGNI |
| Assess-specific config keys | CLI-only for assess-only flags |
| McCabe / historical AST | M57/M72 |
| Compare / baseline | M71 |
| `scan --trend-top` / assess inside scan JSON | Isolation + cost |
| Assess color / M76 dependency | Do not block |
| Parallel trend pool | Sequential MVP |

---

## User Stories

### P1: Assess CLI + pipeline ⭐ MVP

**User Story**: As a maintainer, I want `hotspot-scanner assess <path>` to scan, keep hotspots above a hotspotScore floor, cap to `--top`, and classify each via trend so I can see which ranked files look deteriorating.

**Why P1**: Core product value of M77.

**Acceptance Criteria**:

1. WHEN `hotspot-scanner assess [path]` runs THEN the system SHALL invoke `runScan` then filter `hotspotScore >= minHotspotScore`, sort descending, slice `--top`, then run `runComplexityTrend` per remaining candidate
2. WHEN `--min-hotspot-score` is omitted THEN the default SHALL be **0.7**
3. WHEN help documents the flag THEN the long name SHALL be `--min-hotspot-score` (not `--min-score`) and help text SHALL state that the threshold applies to **hotspotScore**
4. WHEN `--top` is omitted THEN the candidate cap after filter SHALL default to **20**
5. WHEN `--since` / `--include` / `--exclude` are used THEN they SHALL follow scan semantics (including config merge for scan-backed params)
6. WHEN assess-only `--min-hotspot-score` is set THEN it SHALL be CLI-only (no `.hotspot-scanner.json` key in MVP)
7. WHEN path defaults THEN `assess` SHALL accept optional path defaulting to `.` (scan parity)

**Independent Test**: CLI help + dry unit of selector; fixture assess with high threshold yields empty candidates.

**Requirements**: HOTSPOT-1620, HOTSPOT-1621, HOTSPOT-1622, HOTSPOT-1623

---

### P1: Library `runAssess` + AssessResult contract ⭐ MVP

**User Story**: As a library consumer, I want `runAssess` to return a versioned `AssessResult` with summary and per-candidate growth patterns so I can automate triage without parsing CLI text.

**Why P1**: Parity with `runScan` / `runComplexityTrend`.

**Acceptance Criteria**:

1. WHEN `runAssess` completes THEN it SHALL return `{ version: "1.0", kind: "hotspot-assess", meta, candidates }`
2. WHEN JSON is emitted THEN `schemas/hotspot-assess.json` SHALL validate the payload; package MAY export the schema subpath
3. WHEN candidates are successful THEN each SHALL include `filePath`, `hotspotScore`, and `growthPattern` (M75 shape) without embedding full trend `points`
4. WHEN scan JSON or complexity-trend JSON contracts are considered THEN they SHALL remain unchanged (`scan` `3.0`, complexity-trend `3.0`)
5. WHEN public API is checked THEN `runAssess` SHALL be exported from the package entry (and `#assess` alias)

**Independent Test**: Unit with mocked scan/trend; Ajv contract fixtures.

**Requirements**: HOTSPOT-1624, HOTSPOT-1625, HOTSPOT-1626, HOTSPOT-1627

---

### P1: Soft-continue + sequential progress ⭐ MVP

**User Story**: As an operator on a large repo, I want assess to continue when one file’s trend fails and to show per-file progress so a single bad path does not abort the batch.

**Why P1**: Reliability + UX for N trends.

**Acceptance Criteria**:

1. WHEN a per-candidate `runComplexityTrend` fails THEN assess SHALL record that candidate as skipped/error with a message and SHALL continue remaining candidates
2. WHEN trends run THEN they SHALL be **sequential** (one at a time) in MVP
3. WHEN progress is enabled (not quiet) THEN stderr SHALL show per-file progress including index and path
4. WHEN SIGINT/SIGTERM arrives THEN assess SHALL cancel with exit **130** / **143** (parity with scan/trend)
5. WHEN assess completes with some candidate errors THEN process exit SHALL still be **0** (absent usage/cancel errors)

**Independent Test**: Mock trend rejection mid-batch; assert remaining called; progress string unit/CLI.

**Requirements**: HOTSPOT-1628, HOTSPOT-1629, HOTSPOT-1630

---

### P1: Table / markdown report ⭐ MVP

**User Story**: As a CLI user, I want a summary of pattern counts and a detailed section only for deteriorating files so the default report stays actionable.

**Why P1**: Locked human UX.

**Acceptance Criteria**:

1. WHEN format is `table` or `markdown` THEN the report SHALL include a **summary** with candidate count, counts by growthPattern kind, and skipped/error counts
2. WHEN format is `table` or `markdown` THEN a **detailed** section SHALL list only candidates with `growthPattern.kind === "deteriorating"`
3. WHEN a candidate is not deteriorating THEN it SHALL appear in summary counts only (not in the detailed section)
4. WHEN zero deteriorating exist THEN the detailed section SHALL state that none were found (or equivalent empty messaging) without dumping other kinds’ full detail

**Independent Test**: Snapshot/string asserts on synthetic AssessResult.

**Requirements**: HOTSPOT-1631, HOTSPOT-1632, HOTSPOT-1633

---

### P1: JSON report (no points dump) ⭐ MVP

**User Story**: As an automation consumer, I want machine-readable assess JSON with compact candidate rows so I can filter deteriorating files without downloading revision series.

**Why P1**: Locked contract isolation.

**Acceptance Criteria**:

1. WHEN `--format json` THEN stdout/file SHALL be `AssessResult` JSON with `kind: "hotspot-assess"` and `version: "1.0"`
2. WHEN JSON is rendered THEN it SHALL NOT include per-candidate full `points` arrays
3. WHEN `--top` / min score filter apply THEN JSON `candidates` SHALL reflect the same capped set as table (top applies to all formats)

**Independent Test**: JSON parse + schema validate; assert no `points` key on candidates.

**Requirements**: HOTSPOT-1634, HOTSPOT-1635

---

### P1: Docs + living sync ⭐ MVP

**User Story**: As an adopter, I want recipes/README notes for assess and a warning about Prettier/indent cliffs so I do not treat Pattern labels as CI truth.

**Why P1**: Adoption + CONCERNS honesty.

**Acceptance Criteria**:

1. WHEN docs are updated THEN README and/or `docs/recipes.md` SHALL document `assess` usage (`--min-hotspot-score`, `--top`) and scan→assess workflow
2. WHEN living docs are synced THEN ARCHITECTURE / STRUCTURE / CONCERNS SHALL mention assess pipeline, schema isolation, sequential trends, and formatter-cliff risk
3. WHEN skills list CLI commands THEN `vitals-cli-validation` / pipeline-domain MAY mention assess if they enumerate commands

**Independent Test**: Doc review in Execute; no interactive UAT.

**Requirements**: HOTSPOT-1636, HOTSPOT-1637, HOTSPOT-1638

---

## Edge Cases

- WHEN no hotspot meets `minHotspotScore` THEN system SHALL emit empty candidates with summary zeros and exit `0`
- WHEN `--top` is `0` or non-positive THEN system SHALL reject with usage error exit `2`
- WHEN `--min-hotspot-score` is outside `[0, 1]` THEN system SHALL reject with usage error exit `2` (hotspotScore is normalized)
- WHEN Prettier/mass-indent causes cliffs THEN Pattern MAY false-label deteriorating — docs SHALL warn; no special detector in M77
- WHEN candidate path is deleted / not tracked for trend THEN that row SHALL be skipped/error; others continue
- WHEN scan returns hotspots already sorted THEN assess SHALL still filter+slice correctly (ties: preserve scan order / filePath asc parity)

---

## Requirement Traceability

| ID | Story | Priority | Status |
| -- | ----- | -------- | ------ |
| HOTSPOT-1620 | CLI assess + pipeline wiring | P1 | Pending |
| HOTSPOT-1621 | `--min-hotspot-score` default 0.7 + help naming | P1 | Pending |
| HOTSPOT-1622 | `--top` default 20 after filter; all formats | P1 | Pending |
| HOTSPOT-1623 | `--since`/include/exclude scan semantics + config merge | P1 | Pending |
| HOTSPOT-1624 | `runAssess` API + AssessResult shape | P1 | Pending |
| HOTSPOT-1625 | Schema `hotspot-assess` `1.0` | P1 | Pending |
| HOTSPOT-1626 | No points dump; scan/trend contracts untouched | P1 | Pending |
| HOTSPOT-1627 | Public export + `#assess` | P1 | Pending |
| HOTSPOT-1628 | Soft-continue per-file trend errors | P1 | Pending |
| HOTSPOT-1629 | Sequential trends + progress | P1 | Pending |
| HOTSPOT-1630 | Cancel exit 130/143; success exit 0 with partial errors | P1 | Pending |
| HOTSPOT-1631 | Table/markdown summary counts | P1 | Pending |
| HOTSPOT-1632 | Detail only deteriorating | P1 | Pending |
| HOTSPOT-1633 | Empty deteriorating messaging | P1 | Pending |
| HOTSPOT-1634 | JSON format assess contract | P1 | Pending |
| HOTSPOT-1635 | JSON same candidate set as table; no points | P1 | Pending |
| HOTSPOT-1636 | Recipes/README assess | P1 | Pending |
| HOTSPOT-1637 | Living ARCHITECTURE/STRUCTURE/CONCERNS | P1 | Pending |
| HOTSPOT-1638 | Skills mention if applicable | P1 | Pending |
| HOTSPOT-1639–1659 | Buffer unused | — | — |
| HOTSPOT-1660–1679 | Reserved | — | — |

---

## Success Criteria

- [ ] Operator can run `assess` and see summary + deteriorating detail without running N manual `trend`s
- [ ] JSON `kind: "hotspot-assess"` / `version: "1.0"` validates; scan and complexity-trend schemas unchanged
- [ ] Partial trend failures do not abort the batch; cancel codes preserved
- [ ] Docs warn about formatter cliffs
- [ ] Final gate `pnpm build && pnpm test` passes after Execute
