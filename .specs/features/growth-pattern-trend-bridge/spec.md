# Milestone 75 — Growth Pattern + Trend Bridge Specification

**Feature slug:** `growth-pattern-trend-bridge`  
**Milestone:** ROADMAP M75  
**Depth:** Large  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1540–1599 (1570–1599 reserved)  
**Sisters:** [complexity-trend](../complexity-trend/spec.md) (M72), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do not reopen compare)

## Problem Statement

`trend` already emits a chronological indentation/NCLOC series with sparklines, but maintainers must still interpret whether a hotspot is **deteriorating**, was **refactored**, or remains **stable**. Separately, `scan --explain` stops at score breakdown without a clear next step into historical trend analysis. Tornhill’s growth-pattern framing plus a one-line explain→trend bridge close that DX gap without reopening compare/baseline or bloating the scan contract.

## Goals

- [ ] Always-on growth-pattern classification on every successful `trend` result (`meta.growthPattern` + table `Pattern:` line)
- [ ] Pure `classifyGrowthPattern` with locked heuristics and `inconclusive` for short/weak series
- [ ] Complexity-trend JSON contract bump `2.0` → `3.0` with required `meta.growthPattern`; scan `3.0` unchanged
- [ ] Explain hit emits stderr `next: hotspot-scanner trend <path>`; miss emits no hint
- [ ] Recipes/README/living docs cover scan→explain→trend and the three curves
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `--classify` flag | Always-on (context 2A) |
| `--fail-on-deteriorating` / SARIF | Deferred CI horizon |
| `scan --trend-top` / batch trend | Cost / YAGNI |
| Repo-wide trend inside `scan` | M72 lock |
| Compare / baseline | M71 |
| McCabe / historical AST / charts | Deferred / YAGNI |
| CSV pattern column | Table + JSON only |
| Config keys for trend | M72 CLI-only |
| Changing hotspotScore / NCLOC | Orthogonal |

---

## User Stories

### P1: Classify growth pattern ⭐ MVP

**User Story**: As a maintainer running `trend`, I want an automatic growth-pattern label with a short evidence summary so that I can see deteriorating / refactored / stable / inconclusive without decoding sparklines alone.

**Why P1**: Core product value of M75.

**Acceptance Criteria**:

1. WHEN `classifyGrowthPattern(points)` runs on a chronological ascending series THEN it SHALL return `{ kind, summary, … }` where `kind` is one of `deteriorating` | `refactored` | `stable` | `inconclusive`
2. WHEN `points.length < 5` (including empty) THEN `kind` SHALL be `inconclusive` and `summary` SHALL state insufficient history
3. WHEN `indentMean` relative range is within the locked stable band THEN `kind` SHALL be `stable` (unless a higher-priority pattern applies per context)
4. WHEN a mid-series peak then end drop meets the locked refactor threshold THEN `kind` SHALL be `refactored` and evidence SHALL include `peakRev` when a peak point has `rev`
5. WHEN first→last `indentMean` rise meets the locked deteriorate threshold THEN `kind` SHALL be `deteriorating`, with summary reflecting mean vs ncloc growth when size context is available
6. WHEN signals are mixed or weak THEN `kind` SHALL be `inconclusive`
7. WHEN classification runs THEN it SHALL use `indentMean` as the primary shape metric and SHALL NOT use AST/McCabe

**Independent Test**: Unit tests with synthetic series: short → inconclusive; flat → stable; rising → deteriorating; peak-then-drop → refactored.

**Requirements**: HOTSPOT-1540, HOTSPOT-1541, HOTSPOT-1542, HOTSPOT-1543

---

### P1: Wire classify into trend result + schema 3.0 ⭐ MVP

**User Story**: As a library/CLI consumer, I want every `ComplexityTrendResult` to include `meta.growthPattern` under contract `version: "3.0"` so that JSON and table consumers share the same classification.

**Why P1**: Contract + orchestration.

**Acceptance Criteria**:

1. WHEN `runComplexityTrend` completes THEN it SHALL attach `meta.growthPattern` from `classifyGrowthPattern(points)` always (including empty/short series)
2. WHEN JSON is emitted THEN `version` SHALL be `"3.0"` and `kind` SHALL remain `"complexity-trend"`
3. WHEN `schemas/complexity-trend.json` is updated THEN `meta.growthPattern` SHALL be required with `kind` enum and `summary` string; contract tests SHALL validate fixtures
4. WHEN scan JSON is produced THEN scan `schemas/scan-result.json` SHALL remain `"3.0"` unchanged
5. WHEN `meta.truncated` is true THEN the classifier still runs on the sampled points; orchestration MAY append a truncation note to `summary` without changing `kind`

**Independent Test**: Ajv contract fixtures for `3.0`; `runComplexityTrend` unit/integration asserts `meta.growthPattern.kind` present.

**Requirements**: HOTSPOT-1544, HOTSPOT-1545, HOTSPOT-1546

---

### P1: Table Pattern line ⭐ MVP

**User Story**: As a CLI user reading table output, I want a `Pattern:` line above sparklines so that the classification is visible in the default human format.

**Why P1**: Locked table UX.

**Acceptance Criteria**:

1. WHEN `renderTrendTable` runs THEN it SHALL include a line `Pattern: <kind> — <summary>` (or equivalent stable prefix `Pattern:`) **above** the `indent_mean` / `ncloc` sparkline lines
2. WHEN table renders THEN sparklines and revision rows SHALL remain present and unchanged in role
3. WHEN CSV is rendered THEN it SHALL NOT add a growth-pattern column or pattern header row

**Independent Test**: Snapshot/string assert on table output; CSV header regression unchanged.

**Requirements**: HOTSPOT-1547, HOTSPOT-1548

---

### P1: Explain → trend next-step ⭐ MVP

**User Story**: As an operator who explained a hotspot, I want a stderr next-step pointing at `trend` for that path so that drill-down is obvious.

**Why P1**: Workflow DX bridge.

**Acceptance Criteria**:

1. WHEN `scan --explain <path>` finds a hotspot THEN stderr SHALL include a line `next: hotspot-scanner trend <repo-relative-posix-path>` after the explain block
2. WHEN explain misses THEN stderr SHALL NOT include a `next: hotspot-scanner trend` line
3. WHEN `--format json` or `csv` (or `--output`) THEN stdout / output files SHALL remain report-only — the next-step SHALL stay on stderr only
4. WHEN `--quiet` suppresses explain THEN the next-step SHALL also be suppressed
5. WHEN exit codes are considered THEN explain hit/miss behavior SHALL remain unchanged (`0` on miss without `--fail-on-explain-miss`; `1` with fail-on miss)

**Independent Test**: CLI smoke on fixture repo with `--explain` known file; assert stderr contains `next:`; miss case asserts absence.

**Requirements**: HOTSPOT-1549, HOTSPOT-1550, HOTSPOT-1551

---

### P1: Docs + living sync ⭐ MVP

**User Story**: As a new adopter, I want a recipe and brief README note for scan→explain→trend and the three growth curves so that I know how to use Pattern labels.

**Why P1**: Adoption without tribal knowledge.

**Acceptance Criteria**:

1. WHEN docs are updated THEN `docs/recipes.md` SHALL include a scan → explain → trend cookbook and a short glossary of deteriorating / refactored / stable
2. WHEN README is updated THEN it SHALL mention trend Pattern classification and/or the explain next-step (brief)
3. WHEN living docs are synced THEN ARCHITECTURE / CONCERNS / STRUCTURE (as touched) SHALL note growthPattern + formatter-cliff caveat; skills updated if they list trend UX

**Independent Test**: Doc grep / review in Execute; no interactive UAT.

**Requirements**: HOTSPOT-1552, HOTSPOT-1553, HOTSPOT-1554

---

## Edge Cases

- WHEN all `indentMean` values are equal THEN system SHALL classify `stable` (if ≥5 points)
- WHEN Prettier/mass-indent causes a cliff THEN system MAY label `refactored` or `deteriorating` falsely — docs SHALL warn; no special detector required in M75
- WHEN only one of start/end windows has strong signal but heuristics disagree THEN system SHALL prefer `inconclusive` over a forced label
- WHEN explain path needs normalization THEN next-step path SHALL use the matched hotspot `filePath` (repo-relative)

---

## Requirement Traceability

| ID | Story | Priority | Status |
| -- | ----- | -------- | ------ |
| HOTSPOT-1540 | Classify — API + kinds | P1 | Pending |
| HOTSPOT-1541 | Classify — min points / inconclusive | P1 | Pending |
| HOTSPOT-1542 | Classify — stable / refactored / deteriorating heuristics | P1 | Pending |
| HOTSPOT-1543 | Classify — indentMean primary; no AST | P1 | Pending |
| HOTSPOT-1544 | Wire — `meta.growthPattern` always | P1 | Pending |
| HOTSPOT-1545 | Schema — complexity-trend `3.0` | P1 | Pending |
| HOTSPOT-1546 | Schema — scan `3.0` untouched | P1 | Pending |
| HOTSPOT-1547 | Table — Pattern line above sparklines | P1 | Pending |
| HOTSPOT-1548 | CSV — no pattern column | P1 | Pending |
| HOTSPOT-1549 | Explain — next-step on hit | P1 | Pending |
| HOTSPOT-1550 | Explain — no next-step on miss | P1 | Pending |
| HOTSPOT-1551 | Explain — stderr-only; quiet parity; exit codes | P1 | Pending |
| HOTSPOT-1552 | Docs — recipes cookbook + glossary | P1 | Pending |
| HOTSPOT-1553 | Docs — README brief | P1 | Pending |
| HOTSPOT-1554 | Docs — living ARCHITECTURE/CONCERNS/STRUCTURE/skills | P1 | Pending |
| HOTSPOT-1555–1569 | Buffer unused | — | — |
| HOTSPOT-1570–1599 | Reserved | — | — |

---

## Success Criteria

- [ ] Operator sees Pattern label on default `trend` table and in JSON `meta.growthPattern`
- [ ] Explain hit prints `next: hotspot-scanner trend <path>` on stderr
- [ ] Complexity-trend contract is `3.0`; scan stays `3.0`
- [ ] Recipes document the workflow and Tornhill curves
- [ ] Final gate `pnpm build && pnpm test` passes after Execute
