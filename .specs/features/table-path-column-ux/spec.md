# Milestone 60 — Table Path Column UX Specification

**Feature slug:** `table-path-column-ux`  
**Milestone:** M60  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-990–1009 (1001–1009 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

Scan and compare **table** formats hard-code the File column to 24 characters and left-truncate with `slice(0, width)`. Deep paths lose the basename (`schema.ts` becomes invisible). Operators on wide TTYs still get a narrow column; piped/CI runs that already lack `stdout.columns` should keep today’s ~24 behavior. Markdown / JSON / CSV already show full paths — this milestone is table UX only.

## Goals

- [ ] Middle-ellipsis File cells that keep a path prefix and basename when width allows
- [ ] Derive File column width from injectable `stdoutColumns` / `process.stdout.columns`, with min/max and fallback **24** when columns are missing
- [ ] Cap File width so scan numeric columns still fit on ~80-col terminals when possible
- [ ] Same helper + width rules for scan table and compare table
- [ ] No new CLI flags, config keys, or JSON schema changes
- [ ] Document table File-column behavior where layout is described

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Markdown / JSON / CSV path changes | Already full paths |
| `--full-paths` / config key | Locked — no new surface |
| End-ellipsis or basename-only | Locked — middle-ellipsis only |
| Triage / explain / glossary redesign | Sister milestones; YAGNI |
| JSON schema / contract bump | Presentation-only |

---

## User Stories

### P1: Middle-ellipsis File column (scan table) ⭐ MVP

**User Story:** As a CLI user reading default table output, I want long File paths shortened in the middle so I still see a directory prefix and the filename.

**Why P1:** Core UX ask; replaces harmful left-truncation.

**Acceptance Criteria:**

1. WHEN a hotspot `filePath` is longer than the File column width THEN the scan table SHALL render a middle-ellipsis form that preserves a leading path prefix and the basename (e.g. `src/api/v1/…/schema.ts`), using Unicode `…` (U+2026).
2. WHEN a `filePath` length is ≤ File column width THEN the scan table SHALL render the full path (no ellipsis).
3. WHEN the File cell is rendered THEN its visible width SHALL equal the resolved File column width (pad with spaces on the right when shorter).

**Independent Test:** Unit test with a deep path and fixed `stdoutColumns`; assert output contains basename, contains `…`, and does not equal a pure left `slice(0, width)` of the path.

**Requirements:** HOTSPOT-990, HOTSPOT-998

---

### P1: Dynamic width + injectable columns + fallback ⭐ MVP

**User Story:** As a developer and as a TTY user, I want File width to track terminal width when known, and stay ~24 in pipes/CI, with tests able to inject column counts.

**Why P1:** Width SoT without flaky TTY tests.

**Acceptance Criteria:**

1. WHEN `renderTable` / `renderCompareTable` options include `stdoutColumns: N` (finite, > 0) THEN File column width SHALL be derived from `N` (not from a live `process.stdout.columns` read for that call).
2. WHEN `stdoutColumns` is omitted THEN the renderer SHALL use `process.stdout.columns` when it is a finite number > 0.
3. WHEN columns are undefined, non-finite, or ≤ 0 THEN File column width SHALL fall back to **24**.
4. WHEN File width is derived THEN it SHALL be clamped to documented min/max and capped so the scan hotspot layout (Rank + File + Score/NLOC/NLOCN/Churn/ChurnN/Authors + separators) fits within ~80 columns when the terminal is ~80 wide (at 80 columns, File width SHALL be **24**, matching today’s layout budget).

**Independent Test:** Inject `stdoutColumns: undefined` / missing → width 24 behavior; inject `80` → File width 24; inject a larger N → File width > 24 up to max; inject a small N → File width ≥ min.

**Requirements:** HOTSPOT-991, HOTSPOT-992, HOTSPOT-993

---

### P1: Compare table parity + shared helper ⭐ MVP

**User Story:** As a user of `scan --baseline` / `compare` table output, I want the same File shortening and width rules as the scan table.

**Why P1:** Locked scope — both tables; one helper.

**Acceptance Criteria:**

1. WHEN compare table renders New / Removed / Rank Changed hotspot rows THEN File cells SHALL use the same middle-ellipsis and width-resolution helper as the scan table.
2. WHEN scan and compare renderers are given the same `stdoutColumns` THEN they SHALL produce the same File cell string for the same `filePath`.
3. WHEN File column width changes THEN header underlines / spacing for the File column SHALL match that width (scan and compare headers).

**Independent Test:** Unit tests on compare-table with long paths + injected columns; shared helper unit tests for pure functions.

**Requirements:** HOTSPOT-994, HOTSPOT-995, HOTSPOT-996

---

### P1: No new operator surface ⭐ MVP

**User Story:** As a package consumer, I want this improvement without new flags, config keys, or JSON contract changes.

**Why P1:** Locked constraint.

**Acceptance Criteria:**

1. WHEN scanning with default CLI THEN no new flags SHALL be required for middle-ellipsis / dynamic File width.
2. WHEN JSON / markdown / CSV are rendered THEN path fields SHALL remain full paths (unchanged by this milestone).
3. WHEN `.hotspot-scanner.json` / schemas are inspected THEN no new keys or version bumps SHALL be introduced for this feature.

**Independent Test:** Grep / review — no new Commander options; schema files untouched; existing markdown/json/csv path tests stay green.

**Requirements:** HOTSPOT-999

---

### P2: Edge cases for ellipsis

**User Story:** As a maintainer, I want defined behavior when basename alone barely fits or paths have no `/`.

**Why P2:** Prevents ambiguous implementer choices; still needed for solid unit coverage.

**Acceptance Criteria:**

1. WHEN `filePath` has no `/` and exceeds width THEN the cell SHALL still fit width using middle-ellipsis over the single segment (prefix + `…` + suffix of the name) — basename-only display without ellipsis is **not** required.
2. WHEN basename + `…` + minimum prefix cannot fit (basename alone ≥ width) THEN the implementation SHALL still emit a string of exactly `width` characters that ends with as much of the basename as fits (design § Edge algorithm) — never exceed width.
3. WHEN width is resolved to the minimum clamp THEN tables SHALL still render without throwing.

**Independent Test:** Helper unit tests for no-slash path, basename-longer-than-width, and min-width.

**Requirements:** HOTSPOT-997

---

### P2: Living docs

**User Story:** As a reader of README / ARCHITECTURE, I want table File-column behavior described accurately if layout is documented.

**Why P2:** Living docs rule; avoid implying hard-coded left-truncation forever.

**Acceptance Criteria:**

1. WHEN ARCHITECTURE (and README if it describes table path truncation / column layout) mentions table File display THEN it SHALL note middle-ellipsis + terminal-derived width with fallback ~24 — not left `slice(0, 24)` as the SoT.
2. WHEN docs are updated THEN they SHALL NOT invent `--full-paths` or config keys.

**Independent Test:** Doc review in Execute.

**Requirements:** HOTSPOT-1000

---

## Edge Cases

- WHEN `stdoutColumns` is `0` or negative THEN system SHALL use fallback File width 24.
- WHEN path equals width exactly THEN system SHALL show full path (no ellipsis).
- WHEN colored score cells are enabled THEN File ellipsis/padding SHALL remain based on plain path length (File column is uncolored today).
- WHEN compare rank-changed row has extra Baseline/Current/Delta columns THEN File width SHALL still match scan File width (row may exceed 80 — accepted).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-990 | P1: Middle-ellipsis scan | Tasks | Pending |
| HOTSPOT-991 | P1: Dynamic width + injectable | Tasks | Pending |
| HOTSPOT-992 | P1: Fallback 24 | Tasks | Pending |
| HOTSPOT-993 | P1: Min/max + ~80-col cap | Tasks | Pending |
| HOTSPOT-994 | P1: Compare parity | Tasks | Pending |
| HOTSPOT-995 | P1: Shared helper | Tasks | Pending |
| HOTSPOT-996 | P1: Headers match width | Tasks | Pending |
| HOTSPOT-997 | P2: Ellipsis edge cases | Tasks | Pending |
| HOTSPOT-998 | P1: Unicode `…` | Tasks | Pending |
| HOTSPOT-999 | P1: No flags/config/schema | Tasks | Pending |
| HOTSPOT-1000 | P2: Living docs | Tasks | Pending |
| HOTSPOT-1001–1009 | Reserved | — | Unused |

**Coverage:** 11 mapped requirements + reserved band; all non-reserved IDs map to tasks.

---

## Success Criteria

- [ ] Long paths in scan/compare tables show prefix + `…` + basename within the File width
- [ ] Injected columns drive width in tests; missing columns → File width 24
- [ ] At `stdoutColumns === 80`, scan File width is 24 (layout budget preserved)
- [ ] `pnpm build && pnpm test` green after Execute (separate session)
- [ ] No new CLI/config/schema surface
