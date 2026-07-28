# Milestone 69 — Write Confirmation UX Specification

**Feature slug:** `write-confirm-ux`  
**Milestone:** M69  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1260–1279 (1275–1279 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [tasks.md](./tasks.md)  
**Sisters:** feedback-copy-ux (M62 CSV confirm), csv-bundle (M18), cli-surface-parity (M63 `--csv-single-file`), warnings-bookend-dx (M68 bookend order)

---

## Problem Statement

Today only the multi-file CSV **bundle** path prints a stderr confirmation after a successful write (`Wrote CSV bundle:`). Operators using `--output` for table / markdown / JSON, or `--csv-single-file`, get a silent file write — easy to miss which path was written, especially in scripts and CI.

## Goals

- [ ] Emit a stderr write confirmation after successful file writes for `--output` (table/md/json) and `--csv-single-file`
- [ ] Compose with `--quiet` (suppress confirm)
- [ ] Preserve existing CSV bundle confirmation behavior
- [ ] No new flags / config / schema changes
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                             | Reason                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| New CLI flags                                       | YAGNI — reuse `--quiet`                                                           |
| Confirm when writing to stdout only (no `--output`) | Nothing to confirm on disk                                                        |
| Changing M68 teaser/flush bookend                   | Sister — compose only (confirm stays inside/after successful write, before flush) |
| Timing on `baseline save`                           | Explicitly out of batch                                                           |
| Schema / ranking changes                            | Unrelated                                                                         |

---

## Locked decision (item D)

| Item  | Lock                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D** | After successful write: stderr confirm for `--output` (table/md/json) and `--csv-single-file`. Suppress under `--quiet`. No new flags. CSV bundle confirm (M62) unchanged. |

**Suggested copy (agent discretion):** one line `Wrote <path>\n` on stderr using the path passed to `--output` (same tone as `Wrote config to …` / CSV bundle header). Do not dump file contents.

**Compose with M68:** Order remains teaser → write (confirm emits as part of successful write path) → flush → timing → explain.

---

## User Stories

### P1: Confirm `--output` file writes ⭐ MVP

**User Story:** As an operator who saves a table/markdown/JSON report with `--output`, I want stderr to confirm the path written so I know the file landed.

**Why P1:** Closes the silent-write gap vs CSV bundle.

**Acceptance Criteria:**

1. WHEN `writeRenderedOutput` successfully writes table, markdown, or JSON to `--output <path>` THEN stderr SHALL include a confirmation line naming that path
2. WHEN `--quiet` is set THEN the confirmation SHALL be suppressed
3. WHEN output goes to stdout only (no `--output`) THEN no write-confirmation line SHALL be emitted

**Independent Test:** Bin/unit tests with temp `--output` path; assert stderr contains confirm; with `--quiet` assert absent.

**Requirements:** HOTSPOT-1260, HOTSPOT-1262, HOTSPOT-1263

---

### P1: Confirm `--csv-single-file` writes ⭐ MVP

**User Story:** As an operator using `--format csv --csv-single-file -o <path>`, I want the same stderr confirmation pattern as other single-file outputs.

**Why P1:** Today single-file CSV returns without the bundle confirm.

**Acceptance Criteria:**

1. WHEN `--csv-single-file` successfully writes the single hotspots CSV to `--output` THEN stderr SHALL confirm that path (unless `--quiet`)
2. WHEN default CSV bundle write runs THEN existing `Wrote CSV bundle:` multi-line confirm SHALL remain unchanged

**Independent Test:** Extend existing CSV confirm tests for single-file vs bundle.

**Requirements:** HOTSPOT-1261, HOTSPOT-1264

---

## Edge Cases

- WHEN write fails (I/O error) THEN no confirmation SHALL be emitted
- WHEN compare path uses `--output` THEN confirm applies the same way via shared `writeRenderedOutput`
- WHEN M68 teaser runs THEN confirm still occurs during/after write and before flush

---

## Requirement Traceability

| Requirement ID    | Story                                | Phase | Status   |
| ----------------- | ------------------------------------ | ----- | -------- |
| HOTSPOT-1260      | P1: `--output` table/md/json confirm | Tasks | Pending  |
| HOTSPOT-1261      | P1: `--csv-single-file` confirm      | Tasks | Pending  |
| HOTSPOT-1262      | P1: `--quiet` suppresses             | Tasks | Pending  |
| HOTSPOT-1263      | P1: no confirm for stdout-only       | Tasks | Pending  |
| HOTSPOT-1264      | P1: CSV bundle confirm unchanged     | Tasks | Pending  |
| HOTSPOT-1265–1274 | —                                    | —     | Buffer   |
| HOTSPOT-1275–1279 | —                                    | —     | Reserved |

---

## Success Criteria

- [ ] Single-file `--output` and `--csv-single-file` confirm on stderr
- [ ] `--quiet` suppresses; stdout-only silent; bundle unchanged
- [ ] Gate green: `pnpm build && pnpm test`

## Inline design notes (Medium — no separate design.md)

- **Owner:** `bin/scan-actions.ts` `writeRenderedOutput` (and keep `writeCsvBundle` as-is)
- **API:** After successful `writeFile` for non-bundle paths, if `outputPath` set and `!quiet`, `process.stderr.write(\`Wrote ${outputPath}\\n\`)`
- **Tests:** `bin/hotspot-scanner.test.ts` alongside existing CSV confirm cases
