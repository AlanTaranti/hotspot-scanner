# Explain & Scan Feedback Specification

**Feature slug:** `explain-and-scan-feedback`  
**Milestone:** M42  
**Depth:** Large  
**IDs:** HOTSPOT-540–569  
**Context:** [context.md](./context.md)

## Problem Statement

Operators see hotspot rankings but cannot see **why** a file or function scored high (raw vs normalized complexity/churn and the harmonic combiner). Rename warnings use stable codes but lack **actionable next steps**. On large repos, complexity AST work is a long silent gap after git progress — operators cannot tell whether the scan is stuck.

## Goals

- [ ] `--explain <target>` prints a score breakdown after a full scan for a matched file or function
- [ ] `RENAME_HISTORY_INCOMPLETE` (and related rename-warning copy) includes next-step guidance without changing codes
- [ ] Complexity stage emits phase-aware progress via existing `onProgress` / stderr logging

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Historical AST / blame-based attribution | CONCERNS deferred; M26 avisos-only boundary |
| Changing McCabe decision nodes | RT-005 |
| Changing warning `code` strings | Stable M26/M28 catalog |
| Triage hints, legends, colors, `--only` | M41 |
| `--no-progress` / `--quiet` / `--verbose` | M38 (sister; honor later via same hook) |
| Explain-only / partial pipeline | Locked: full scan always |
| Explain embedded in JSON schema | stderr CLI only; `version: "1.0"` unchanged |

---

## User Stories

### P1: Explain score breakdown ⭐ MVP

**User Story:** As an operator, I want `--explain <path>` (or `path:function`) so that I can see raw and normalized complexity/churn and the harmonic score for a specific ranking row.

**Why P1:** ROADMAP item 18; primary interpretation UX for this milestone.

**Acceptance Criteria:**

1. WHEN `scan` is invoked with `--explain <path>` THEN the system SHALL run the full scan and produce the normal report, then print an explain block to **stderr**.
2. WHEN the target matches a `HotspotScore` in file mode THEN the explain block SHALL include `cyclomaticComplexity`, `functionCount`, `complexityNormalized` (c), `commitCount`, `linesChanged`, `authorCount`, `churnNormalized` (h), and `hotspotScore`.
3. WHEN `--granularity function` and `--explain <path>:<functionName>` matches a `FunctionHotspotScore` THEN the explain block SHALL include `functionName`, `line`, raw `complexity`, normalized c/h, churn fields, and `hotspotScore`.
4. WHEN `--granularity function` and `--explain <path>` (no function suffix) THEN the system SHALL explain **all** ranked functions for that `filePath` (rank order).
5. WHEN the target is not present in the full ranking arrays THEN the system SHALL print a clear not-found message to stderr and SHALL still exit `0` if the scan succeeded.
6. WHEN `--granularity file` and the target includes `:<functionName>` THEN the system SHALL exit non-zero with `CliUsageError` directing the user to `--granularity function`.
7. WHEN `--top N` truncates the table/markdown report THEN explain lookup SHALL still use the full `ScanResult` arrays.
8. WHEN `--format json` or `csv` (or `--output`) THEN stdout / output files SHALL remain report-only — explain SHALL NOT corrupt machine-readable output.

**Independent Test:** `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --explain <known-file>` — stderr shows breakdown; JSON stdout still parses.

---

### P1: Actionable rename warning next-steps ⭐ MVP

**User Story:** As an operator seeing rename warnings, I want a concrete next step (e.g. widen `--since`) so that I know how to improve ranking confidence.

**Why P1:** ROADMAP item 25; builds on M26/M28 without new codes.

**Acceptance Criteria:**

1. WHEN a `RENAME_HISTORY_INCOMPLETE` warning is emitted from existing formatters THEN its `message` SHALL include an actionable next-step clause (widen `--since`, treat function ranks cautiously after moves, etc. per [context.md](./context.md)).
2. WHEN those warnings are emitted THEN `code` SHALL remain exactly `RENAME_HISTORY_INCOMPLETE` (and `EMPTY_SINCE_WINDOW` unchanged if touched).
3. WHEN stderr / `meta.warnings` / reporters format the warning THEN the full message (base + next-step) SHALL appear; severity unchanged (`warning`).
4. WHEN fixtures assert rename warnings THEN tests SHALL be updated for the new message suffix without relaxing code assertions.

**Independent Test:** Unit tests on `rename-warnings.ts` formatters + existing git-log fixtures assert code + next-step substring.

---

### P1: Complexity-phase progress ⭐ MVP

**User Story:** As an operator scanning a large repo, I want progress during the complexity/AST phase so that I can see files/batches advancing after git progress stops.

**Why P1:** ROADMAP item 27; closes M28 documented gap (“Complexity stage has no progress callback”).

**Acceptance Criteria:**

1. WHEN complexity analysis processes batches THEN the system SHALL invoke `onProgress` with `phase: "complexity"` and file/batch counters (`filesProcessed`, `batchesProcessed`, totals when known).
2. WHEN the CLI runs a scan with progress enabled (default) THEN stderr SHALL include complexity-phase progress lines using the documented phase name `complexity`.
3. WHEN git / function-churn progress runs THEN their `phase` values and `commitsProcessed` semantics SHALL remain unchanged.
4. WHEN M38 later disables progress via `--no-progress` (by not attaching / no-oping `onProgress`) THEN complexity progress SHALL silence through the same mechanism — M42 SHALL NOT require a separate flag.
5. WHEN complexity runs with `concurrency === 1` (inline) or `concurrency > 1` (pool) THEN both paths SHALL emit progress.

**Independent Test:** Unit/integration: spy `onProgress` during `runScan` / analyzer; assert at least one `{ phase: "complexity", ... }` call on `small-ts`.

---

## Edge Cases

- WHEN explain path has leading `./` or absolute path under repo THEN system SHALL normalize and match repo-relative `filePath`.
- WHEN explain path contains a colon but suffix is not a valid function-name pattern THEN system SHALL treat the whole string as a path.
- WHEN multiple functions share a name in one file (overloads) THEN explain SHALL match by `functionName` string equality as stored; if multiple rows match, print all matches (rare; document).
- WHEN complexity discovers zero files THEN system SHALL NOT require complexity progress lines.
- WHEN rename warning lists are capped (“… and N more”) THEN next-step SHALL still appear on each emitted message (including summary lines where applicable).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-540 | P1: Explain — CLI `--explain` flag | Tasks | Pending |
| HOTSPOT-541 | P1: Explain — file-mode breakdown fields | Tasks | Pending |
| HOTSPOT-542 | P1: Explain — function-mode single-target breakdown | Tasks | Pending |
| HOTSPOT-543 | P1: Explain — function-mode path-only (all functions in file) | Tasks | Pending |
| HOTSPOT-544 | P1: Explain — not-found message, exit 0 | Tasks | Pending |
| HOTSPOT-545 | P1: Explain — file mode rejects `:function` | Tasks | Pending |
| HOTSPOT-546 | P1: Explain — grammar parse (last `:` + name pattern) | Tasks | Pending |
| HOTSPOT-547 | P1: Explain — stderr only; stdout formats intact | Tasks | Pending |
| HOTSPOT-548 | P1: Explain — full scan always; lookup vs full rankings / `--top` | Tasks | Pending |
| HOTSPOT-549 | P1: Explain — path normalization | Tasks | Pending |
| HOTSPOT-550 | P1: Rename — append next-steps to ambiguous messages | Tasks | Pending |
| HOTSPOT-551 | P1: Rename — append next-steps to unlinked messages | Tasks | Pending |
| HOTSPOT-552 | P1: Rename — append next-steps to `--since` truncation | Tasks | Pending |
| HOTSPOT-553 | P1: Rename — append next-steps to function pós-rename overlap | Tasks | Pending |
| HOTSPOT-554 | P1: Rename — stable `code` values unchanged | Tasks | Pending |
| HOTSPOT-555 | P1: Rename — tests/fixtures updated for message suffix | Tasks | Pending |
| HOTSPOT-556 | P1: Progress — `ScanProgressPhase` includes `complexity` | Tasks | Pending |
| HOTSPOT-557 | P1: Progress — `ScanProgress` additive file/batch fields | Tasks | Pending |
| HOTSPOT-558 | P1: Progress — emit from complexity analyzer/pool | Tasks | Pending |
| HOTSPOT-559 | P1: Progress — `runScan` forwards `onProgress` to complexity | Tasks | Pending |
| HOTSPOT-560 | P1: Progress — diagnostics stderr format for complexity | Tasks | Pending |
| HOTSPOT-561 | P1: Progress — inline (`concurrency === 1`) path emits | Tasks | Pending |
| HOTSPOT-562 | P1: Progress — worker-pool path emits | Tasks | Pending |
| HOTSPOT-563 | P1: Progress — git/function-churn semantics unchanged | Tasks | Pending |
| HOTSPOT-564 | P1: Docs — ARCHITECTURE progress table + explain CLI | Tasks | Pending |
| HOTSPOT-565 | P1: Docs — README `--explain` + rename next-steps note | Tasks | Pending |
| HOTSPOT-566 | P1: Docs — CONCERNS/TESTING notes as needed | Tasks | Pending |
| HOTSPOT-567 | Reserved | — | Unused |
| HOTSPOT-568 | Reserved | — | Unused |
| HOTSPOT-569 | P1: Full project gate | Tasks | Pending |

**Coverage:** 27 mapped requirements (+ 2 reserved), all P1 stories → tasks.

---

## Success Criteria

- [ ] Operator can explain any ranked file/function after a normal scan without breaking JSON/CSV
- [ ] Rename warnings still filterable by stable codes and include next-step text
- [ ] Complexity phase shows progress on stderr for multi-batch scans
- [ ] `pnpm build && pnpm test` green
