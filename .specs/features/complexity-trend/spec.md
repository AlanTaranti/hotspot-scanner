# Milestone 72 — Complexity Trend Specification

**Feature slug:** `complexity-trend`  
**Milestone:** ROADMAP M72  
**Depth:** Complex  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1400–1499 (1470–1499 reserved)  
**Sisters:** [ncloc-metric](../ncloc-metric/spec.md) (M57), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [cli-surface-polish](../cli-surface-polish/spec.md) (M38), [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do not reopen compare)  
**Inspiration:** Tornhill indentation complexity trends (whitespace proxy; HGH08) — no AST

## Problem Statement

`scan` ranks file hotspots from **current** NCLOC × churn. Maintainers still cannot see whether a given hotspot’s **structure is deteriorating over time** (complexity rising faster than size), staying stable, or was successfully refactored. Tornhill-style **complexity trends** — indentation metrics + size across Git revisions for one path — answer that drill-down without reintroducing McCabe, compare/baseline, or bloating the scan contract.

## Goals

- [ ] CLI `trend <file>` emits a chronological complexity/size series for one path
- [ ] Indentation metrics `{ n, total, mean, sd, max }` + `ncloc` per revision (no AST)
- [ ] ASCII sparklines for `mean` and `ncloc` in table + JSON meta
- [ ] Formats `table` \| `json` \| `csv`; library export `runComplexityTrend`
- [ ] Separate JSON contract (`version: "1.0"`, `kind: "complexity-trend"`); scan `3.0` untouched
- [ ] Living docs + completions updated; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                       | Reason                     |
| --------------------------------------------- | -------------------------- |
| Auto-classify deteriorating/refactored/stable | YAGNI (`--classify` later) |
| `git cat-file --batch`                        | Perf phase 2               |
| `--explain` next-step hint to `trend`         | Deferred                   |
| Changing scan / `hotspotScore` / NCLOC rules  | Orthogonal                 |
| Compare / baseline                            | M71 stands                 |
| McCabe / ts-morph / historical AST            | M57 + deferred             |
| Markdown format / chart libraries             | YAGNI                      |
| Reading `.hotspot-scanner.json`               | CLI-only locked            |
| Repo-wide trend inside `scan`                 | Cost / contract            |
| `--file` flag alias                           | YAGNI                      |

---

## User Stories

### P1: Indentation complexity analyzer ⭐ MVP

**User Story**: As a library/CLI consumer, I want a pure indentation analyzer so that each file revision yields Tornhill-style complexity stats without parsing an AST.

**Why P1**: Core metric; independent of Git.

**Acceptance Criteria**:

1. WHEN `analyzeIndentation(source)` runs THEN it SHALL return `{ n, total, mean, sd, max }` where `n` is the count of non-blank lines analyzed
2. WHEN leading whitespace is measured THEN **4 spaces** SHALL equal one logical level and **one tab** SHALL equal one logical level (per [context.md](./context.md))
3. WHEN a line is blank or whitespace-only THEN it SHALL be ignored (not counted in `n` or totals)
4. WHEN `n === 0` THEN `mean` and `sd` SHALL be `0` (no NaN)
5. WHEN the analyzer runs THEN it SHALL NOT use ts-morph, McCabe, or any AST

**Independent Test**: Unit fixtures with known indent shapes (flat, nested, mixed tabs/spaces); assert exact `{ n, total, mean, sd, max }`.

**Requirements**: HOTSPOT-1400, HOTSPOT-1401, HOTSPOT-1402

---

### P1: ASCII sparkline helper ⭐ MVP

**User Story**: As a CLI user reading table output, I want compact ASCII sparklines for complexity and size so that I can glance at the trend without opening a chart tool.

**Why P1**: Locked UX; cheap and distinctive.

**Acceptance Criteria**:

1. WHEN `sparkline(values)` runs on a non-empty varying series THEN it SHALL map values to glyphs from `▁▂▃▄▅▆▇█` via min–max scaling
2. WHEN all values are equal THEN each point SHALL map to a mid-level glyph (not empty)
3. WHEN `values` is empty THEN the result SHALL be `""`
4. WHEN trend results are built THEN sparklines SHALL be computed for post-sample chronological **`mean`** and **`ncloc`** series

**Independent Test**: Unit tests for empty, constant, and monotonic series.

**Requirements**: HOTSPOT-1403, HOTSPOT-1404

---

### P1: Run complexity trend (orchestration + Git) ⭐ MVP

**User Story**: As a maintainer, I want `runComplexityTrend` to walk a file’s history and return metrics per revision so that I can analyze complexity vs size over time.

**Why P1**: Product core.

**Acceptance Criteria**:

1. WHEN invoked with a file path THEN the system SHALL resolve a Git repository (cwd / `--repo` / discovery from file) and validate the path is a file (directory → usage error)
2. WHEN listing revisions THEN the system SHALL use path-scoped `git log` with **`--follow` by default**, and SHALL honor `--no-follow`
3. WHEN `--since` is omitted and start/end unset THEN the system SHALL use `DEFAULT_SINCE` (`"12 months ago"`)
4. WHEN `--start` and `--end` are both set THEN the system SHALL restrict the revision range and SHALL reject mixing with `--since` or a lone start/end (usage error exit `2`)
5. WHEN more revisions exist than the cap THEN the system SHALL apply **uniform** sampling to default `--max-revisions 100`, set `meta.truncated: true`, and emit a stderr truncation note; `--all` SHALL disable the cap
6. WHEN processing each selected revision THEN the system SHALL `git show <rev>:<pathAtRev>`, run indentation analysis + `countNcloc`, and append a point; path-at-rev SHALL respect follow renames
7. WHEN a single `git show` fails THEN the system SHALL skip that point, record a warning, and continue
8. WHEN zero revisions match the window THEN the system SHALL return an empty `points` array with a warning and exit `0` (CLI)
9. WHEN the result is produced THEN points SHALL be in chronological **ascending** order and include `meta.sparklines.{ mean, ncloc }`
10. WHEN Git spawns run THEN they SHALL be encapsulated under `src/git/` (not scattered); trend `--follow` SHALL NOT change the scan numstat miner (still no global `--follow`)

**Independent Test**: Fixture repo with ≥3 commits touching one file; assert point count, order, metrics shape, truncation meta.

**Requirements**: HOTSPOT-1405, HOTSPOT-1406, HOTSPOT-1407, HOTSPOT-1408, HOTSPOT-1409, HOTSPOT-1410, HOTSPOT-1411

---

### P1: Trend JSON contract ⭐ MVP

**User Story**: As a downstream integrator, I want a versioned complexity-trend JSON schema separate from scan `3.0` so that trend payloads do not break hotspot consumers.

**Why P1**: Library + `--format json` contract.

**Acceptance Criteria**:

1. WHEN JSON is emitted THEN `version` SHALL be `"2.0"` and `kind` SHALL be `"complexity-trend"`
2. WHEN a point is emitted THEN it SHALL include at least `rev`, `indentLines`, `indentTotal`, `indentMean`, `indentSd`, `indentMax`, `ncloc` (and `date` when available from git)
3. WHEN meta is emitted THEN it SHALL include range provenance (`since` or `start`/`end`), `revisionCount`, `truncated`, `sparklines`, `metricLegend`, and `scannerVersion` when practical; `follow` SHALL NOT appear in output
4. WHEN `schemas/complexity-trend.json` is published THEN contract tests SHALL validate fixtures; scan `schemas/scan-result.json` SHALL remain unchanged at `"3.0"`
5. WHEN `.hotspot-scanner.json` exists THEN `trend` SHALL **not** load it for options

**Independent Test**: Ajv contract tests; assert scan schema untouched.

**Requirements**: HOTSPOT-1412, HOTSPOT-1413, HOTSPOT-1414

---

### P1: Trend reporters (table / json / csv) ⭐ MVP

**User Story**: As a CLI user, I want table/json/csv output so that I can read trends in the terminal or export to Excel.

**Why P1**: Delivery surface.

**Acceptance Criteria**:

1. WHEN `--format table` (default) THEN stdout SHALL show a header for the file/range, a metric legend, **two sparkline lines** (`indent_mean`, `ncloc`), then revision rows with key columns including `rev`, `ncloc`, `indentMean`, `indentMax` (and `indentLines` when it differs from `ncloc`)
2. WHEN `--format json` THEN stdout SHALL be the contract payload including `meta.sparklines`
3. WHEN `--format csv` THEN stdout (or `-o` file) SHALL be header + data rows **without** sparkline columns
4. WHEN `-o` / `--output` is set THEN the rendered body SHALL be written to that path; when unset, stdout
5. WHEN report modules render THEN they SHALL stay pure (no `fs`); bin owns writes

**Independent Test**: Unit tests with a fixed `ComplexityTrendResult` fixture for each format.

**Requirements**: HOTSPOT-1415, HOTSPOT-1416, HOTSPOT-1417

---

### P1: CLI `trend` command ⭐ MVP

**User Story**: As a developer, I want `hotspot-scanner trend <file> …` with completions so that drill-down after scan is a first-class command.

**Why P1**: Primary UX.

**Acceptance Criteria**:

1. WHEN `trend <file>` is invoked THEN the CLI SHALL call `runComplexityTrend` and print the chosen format
2. WHEN flags are parsed THEN the CLI SHALL support `--repo`, `--since`, `--start`, `--end`, `--max-revisions`, `--all`, `--no-follow`, `-f/--format`, `-o/--output`, and cancel signals (`130`/`143`)
3. WHEN usage is invalid (missing file, directory, bad range combo, bad format) THEN exit SHALL be `2`
4. WHEN the file never appears in the selected history THEN exit SHALL be `2` with a clear message
5. WHEN bash/zsh/fish completions are generated THEN they SHALL list `trend` and representative long flags (parity tests per M54)
6. WHEN path-first argv rewrite runs THEN it SHALL NOT steal `trend` (known subcommand)

**Independent Test**: CLI unit/smoke on fixture; completion string assertions.

**Requirements**: HOTSPOT-1418, HOTSPOT-1419, HOTSPOT-1420, HOTSPOT-1421

---

### P2: Library export + living docs

**User Story**: As a package consumer and contributor, I want `runComplexityTrend` exported and docs describing the drill-down workflow.

**Why P2**: Adoption; can ship after CLI green.

**Acceptance Criteria**:

1. WHEN importing `@taranti/hotspot-scanner` THEN `runComplexityTrend` and trend types SHALL be available from the public entry
2. WHEN README / recipes are updated THEN they SHALL show scan → trend → CSV chart workflow and note Prettier false cliffs
3. WHEN ARCHITECTURE / STRUCTURE / INTEGRATIONS / CONCERNS / AGENTS / skills are updated THEN they SHALL document the trend command, historical blob reads (scan remains working-tree NCLOC), and that `--follow` is trend-only

**Independent Test**: `src/index.test.ts` export smoke; docs review checklist in task Done when.

**Requirements**: HOTSPOT-1422, HOTSPOT-1423, HOTSPOT-1424

---

### P2: Integration fixture repo

**User Story**: As an implementer, I want a small multi-commit fixture so that trend integration tests are deterministic.

**Why P2**: Stabilizes Execute; may reuse/extend an existing fixture if adequate.

**Acceptance Criteria**:

1. WHEN integration tests run THEN a versioned fixture under `tests/fixtures/repos/` SHALL provide ≥3 commits with measurable indent/NCLOC change on one path
2. WHEN `pnpm exec hotspot-scanner trend <fixture-file>` runs THEN it SHALL exit `0` and emit non-empty points (or documented empty+warning for edge fixtures)

**Independent Test**: Integration test file asserting point count and sparkline non-empty for the happy path.

**Requirements**: HOTSPOT-1425

---

## Requirement Traceability

| ID                | Story                                                         | Priority | Status              |
| ----------------- | ------------------------------------------------------------- | -------- | ------------------- |
| HOTSPOT-1400      | Indent: return shape `{ n, total, mean, sd, max }`            | P1       | Pending             |
| HOTSPOT-1401      | Indent: 4 spaces / tab rules; ignore blanks                   | P1       | Pending             |
| HOTSPOT-1402      | Indent: no AST; `n===0` → mean/sd 0                           | P1       | Pending             |
| HOTSPOT-1403      | Sparkline glyphs + min–max                                    | P1       | Pending             |
| HOTSPOT-1404      | Sparkline empty/constant; series mean+ncloc                   | P1       | Pending             |
| HOTSPOT-1405      | Resolve repo/file; directory → usage error                    | P1       | Pending             |
| HOTSPOT-1406      | `git log` + `--follow` default / `--no-follow`                | P1       | Pending             |
| HOTSPOT-1407      | `--since` default / `--start`+`--end` exclusive               | P1       | Pending             |
| HOTSPOT-1408      | Uniform `--max-revisions` 100; `--all`; truncated meta+stderr | P1       | Pending             |
| HOTSPOT-1409      | `git show` + indent + ncloc; path-at-rev                      | P1       | Pending             |
| HOTSPOT-1410      | Skip failed show + warning; empty window warn exit 0          | P1       | Pending             |
| HOTSPOT-1411      | Ascending order; git only in `src/git/`; scan miner unchanged | P1       | Pending             |
| HOTSPOT-1412      | JSON `version`/`kind` + point fields                          | P1       | Pending             |
| HOTSPOT-1413      | Schema + contract tests; scan 3.0 untouched                   | P1       | Pending             |
| HOTSPOT-1414      | No config file load for trend                                 | P1       | Pending             |
| HOTSPOT-1415      | Table + sparklines                                            | P1       | Pending             |
| HOTSPOT-1416      | JSON includes sparklines; CSV no sparkline cols               | P1       | Pending             |
| HOTSPOT-1417      | Pure reporters; bin `-o`                                      | P1       | Pending             |
| HOTSPOT-1418      | CLI `trend` wiring                                            | P1       | Pending             |
| HOTSPOT-1419      | Flags + cancel exits                                          | P1       | Pending             |
| HOTSPOT-1420      | Exit 2 for usage / never-in-range                             | P1       | Pending             |
| HOTSPOT-1421      | Completions + path-first non-theft                            | P1       | Pending             |
| HOTSPOT-1422      | Public `runComplexityTrend` export                            | P2       | Pending             |
| HOTSPOT-1423      | README/recipes workflow + Prettier note                       | P2       | Pending             |
| HOTSPOT-1424      | Living codebase docs / skills / AGENTS                        | P2       | Pending             |
| HOTSPOT-1425      | Multi-commit fixture + integration/CLI smoke                  | P2       | Pending             |
| HOTSPOT-1426–1469 | —                                                             | —        | Unassigned (buffer) |
| HOTSPOT-1470–1499 | —                                                             | —        | Reserved            |

---

## Success Criteria

- [ ] `hotspot-scanner trend <file>` produces table with sparklines and revision metrics
- [ ] JSON validates against `schemas/complexity-trend.json`; scan `3.0` unchanged
- [ ] CSV exports plot-ready rows without sparkline columns
- [ ] Default sampling caps at 100 with uniform sample + truncation notice
- [ ] `--follow` default; scan numstat still without global `--follow`
- [ ] `runComplexityTrend` exported; docs describe scan → trend drill-down
- [ ] `pnpm build && pnpm test` green

## Implementation Notes

- Prefer new `src/trend/` orchestration (like `src/doctor/`) rather than extending `runScan`
- Reuse `countNcloc` from [`src/complexity/ncloc.ts`](../../../src/complexity/ncloc.ts)
- Indentation + sparkline may live under `src/complexity/` or `src/trend/` — design picks one owner
- Do not add trend points to `ScanResult`
