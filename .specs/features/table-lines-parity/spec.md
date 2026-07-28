# Milestone 70 — Report Table Lines Parity Specification

**Feature slug:** `table-lines-parity`  
**Milestone:** M70  
**Priority:** Medium  
**Status:** Specs Planned  
**Depth:** Medium-light  
**IDs:** HOTSPOT-1280–1299 (1295–1299 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [tasks.md](./tasks.md)  
**Sisters:** reporter-cli (M5), output-interpretation-ux (M41 glossary), table-path-column-ux (M60)

---

## Problem Statement

Markdown hotspot tables already expose a **Lines** column (`linesChanged`). The default CLI **table** format omits it, so operators comparing table vs markdown (or glossary term “Lines”) see a parity gap. Glossary already defines Lines as markdown-oriented — it should reflect both surfaces once the column ships.

## Goals

- [ ] Add `Lines` column to `src/report/table.ts` hotspot section using `hotspot.linesChanged`
- [ ] Mirror markdown column semantics (integer lines changed in the scan window)
- [ ] Update glossary / how-to-read copy if it still says “markdown only”
- [ ] Table unit tests cover header + values
- [ ] No new flags / schema changes (`linesChanged` already on hotspots)
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                         | Reason                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| Compare table Lines columns for delta sections  | Not item J; YAGNI unless already present — do not expand compare layouts |
| Changing `linesChanged` aggregation / git miner | Metric already exists                                                    |
| Schema bump                                     | Field already in contract                                                |
| New CLI flags                                   | YAGNI                                                                    |

---

## Locked decision (item J)

| Item  | Lock                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| **J** | Add `Lines` (`linesChanged`) to scan `table.ts`, mirroring markdown; update glossary/how-to-read if needed; table tests. |

---

## User Stories

### P1: Table Lines column ⭐ MVP

**User Story:** As an operator reading the default table report, I want a Lines column so table and markdown show the same churn volume signal.

**Why P1:** Entire milestone.

**Acceptance Criteria:**

1. WHEN `renderTable` renders hotspots THEN the header row SHALL include `Lines` after `Authors` (same order as markdown: Rank | File | Score | NLOC | NLOCN | Churn | ChurnN | Authors | Lines)
2. WHEN a hotspot row is rendered THEN the Lines cell SHALL be `hotspot.linesChanged` (integer string, right-aligned like peer numeric columns)
3. WHEN hotspots are empty THEN the empty-state row SHALL still work under the new header width
4. WHEN glossary / how-to-read mentions Lines THEN it SHALL describe the column for table **and** markdown (not markdown-only)

**Independent Test:** `src/report/table.test.ts` (+ glossary test if copy changes).

**Requirements:** HOTSPOT-1280, HOTSPOT-1281, HOTSPOT-1282, HOTSPOT-1283

---

## Edge Cases

- WHEN File column width varies (M60) THEN Lines remains a fixed-width numeric column after Authors — do not steal File budget incorrectly; follow existing pad patterns
- WHEN `linesChanged` is 0 THEN show `0` (not blank)

---

## Requirement Traceability

| Requirement ID    | Story                                   | Phase | Status   |
| ----------------- | --------------------------------------- | ----- | -------- |
| HOTSPOT-1280      | P1: Header includes Lines               | Tasks | Pending  |
| HOTSPOT-1281      | P1: Cell = linesChanged                 | Tasks | Pending  |
| HOTSPOT-1282      | P1: Glossary/how-to-read parity wording | Tasks | Pending  |
| HOTSPOT-1283      | P1: Table unit tests                    | Tasks | Pending  |
| HOTSPOT-1284–1294 | —                                       | —     | Buffer   |
| HOTSPOT-1295–1299 | —                                       | —     | Reserved |

---

## Success Criteria

- [ ] Table and markdown hotspot columns include Lines with same field
- [ ] Glossary accurate
- [ ] Gate green: `pnpm build && pnpm test`

## Inline design notes (Medium-light — no separate design.md)

- **Owner:** `src/report/table.ts` (+ `table.test.ts`); `src/report/glossary.ts` (+ tests) for wording
- **Reuse:** `markdown.ts` column order as SoT for header sequence; existing `padStart` helpers
- **Non-goal:** Do not change compare table layouts in this milestone
