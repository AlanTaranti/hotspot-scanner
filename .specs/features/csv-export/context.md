# Milestone 17 — CSV Export Context

**Feature slug:** `csv-export`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M17 scope, M10 file export + M11 granularity + M13 compare, user confirmation during planning

---

## Decision: Multi-block CSV layout

**Question:** How should a single CSV file represent multiple sections (metadata, hotspots/functions, coupling) with different column schemas?

**Choice:** **Multi-block file** — blocks separated by a blank line. Each block:

1. Title row: single quoted cell with section name (e.g. `"Top Hotspots"`)
2. Header row (RFC 4180 field names)
3. Data rows

First block is metadata as a two-column table:

```
key,value
scan_window,12 months ago
scanned_at,2026-07-22T12:00:00.000Z
granularity,file
```

**Rationale:**

- Different sections have incompatible column sets (hotspots vs functions vs coupling vs rank-changed)
- Spreadsheet tools can import one block at a time
- Aligns with ROADMAP “sections” model and markdown reporter structure
- Metadata block is valid standalone CSV for scripting

**Status:** **Confirmed**

**Applies to:** T1 `renderCsv()`, T2 `renderCompareCsv()`, design § CSV Layout, HOTSPOT-122, HOTSPOT-124.

---

## Decision: Empty sections

**Question:** How should an empty section (no rows) appear in CSV output?

**Choice:** **Title row + header row, zero data rows** — no placeholder data row.

**Rationale:**

- Valid RFC 4180; parsers see headers without inventing fake records
- Mirrors markdown empty sections (heading present, no table rows)

**Status:** **Confirmed**

**Applies to:** T1, T2, HOTSPOT-122, HOTSPOT-124.

---

## Decision: `--top` ignored for CSV

**Question:** Does `--top N` limit rows in `--format csv` output?

**Choice:** **No** — `--top` is **ignored** for CSV (scan and compare). CSV exports **full** ranked arrays, same as JSON. M16 limits `--top` to `table` and `markdown` only; CSV is outside M16 scope.

**Rationale:**

- CSV is a data-export format for pipelines/BI — consumers expect complete datasets
- Parity with JSON (M16: JSON ignores `--top`)
- User confirmed M16 adjustment excluding CSV (2026-07-23)

**Status:** **Confirmed**

**Applies to:** T3 reporter dispatch, HOTSPOT-125, HOTSPOT-127.

---

## Decision: Compare CSV ignores `--top`

**Question:** Does `--top` slice compare delta sections in CSV output?

**Choice:** **No** — `renderCompareCsv()` receives the **unsliced** `CompareResult`. Classification already uses full rankings (M13); CSV displays all classified entities in each section.

**Rationale:**

- Consistent with scan CSV full-export decision
- M16 does not include CSV; compare CSV follows same rule as compare JSON (full delta arrays)

**Status:** **Confirmed**

**Applies to:** T2, T3, HOTSPOT-125, HOTSPOT-127.

---

## Decision: UTF-8 without BOM

**Question:** Should CSV files include a UTF-8 BOM for Excel compatibility?

**Choice:** **No** — UTF-8 without BOM (same as M10 `writeFile(..., "utf8")`).

**Rationale:**

- Consistent with existing file export
- YAGNI until Excel encoding issues are reported

**Status:** **Confirmed**

**Applies to:** T3 CLI write path, HOTSPOT-126.

---

## Decision: Shared CSV escaping helper

**Question:** Where should RFC 4180 field escaping live?

**Choice:** **`src/report/csv-utils.ts`** — export `escapeCsvField()` and `formatCsvRow()`. Import from `csv.ts` and `compare-csv.ts`.

**Rationale:**

- Single source for escaping rules (comma, quote, CR/LF)
- Keeps render modules focused on layout
- `SCORE_DECIMALS = 4` duplicated in csv modules (YAGNI — same as markdown)

**Status:** **Confirmed**

**Applies to:** T1, design § csv-utils, HOTSPOT-121.

---

## Decision: File I/O at CLI boundary

**Question:** Where does CSV file write live?

**Choice:** **Reporter returns string; CLI writes stdout/file** — same M5/M10 pattern. No filesystem in `src/report/`.

**Rationale:**

- Pure reporters are easier to unit test
- `--output` transport rules inherited from M10 unchanged

**Status:** **Confirmed**

**Applies to:** T3 CLI, HOTSPOT-126.

---

## Decision: Removed-section rank column

**Question:** Compare “removed” sections omit rank in table output. How should CSV represent this?

**Choice:** **Fixed schema with empty rank cell** — `rank` column present in new/removed hotspot and function sections; removed rows leave `rank` empty (unquoted empty field).

**Rationale:**

- Stable column headers across new/removed blocks
- Spreadsheet import does not require schema detection per section variant

**Status:** **Confirmed**

**Applies to:** T2 `renderCompareCsv()`, design § Compare CSV Layout, HOTSPOT-124.

---

## Related closed decisions (STATE.md / prior milestones)

| Decision | Value | Relevance to M17 |
| -------- | ----- | ---------------- |
| `--output` suppresses stdout | file only | Unchanged for CSV |
| Format from `--format` only | no extension inference | CSV same as M10 |
| Overwrite output files | yes | Unchanged |
| No `mkdir -p` for `--output` | fail fast | Unchanged |
| Diagnostics channel | stderr | Unchanged with `--output` |
| `--top` on table/markdown | slice at render | M16 — CSV excluded |
| `--top` on JSON | ignored (M16) | CSV same behavior |
| Requirement ID start | `HOTSPOT-121` | Continues after M15 (`HOTSPOT-120`) |
