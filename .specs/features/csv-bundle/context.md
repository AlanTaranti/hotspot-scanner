# Milestone 18 — CSV Bundle Export Context

**Feature slug:** `csv-bundle`  
**Captured:** 2026-07-23  
**Trigger:** Breaking redesign of `--format csv` after M17 multi-block Done; locked decisions from planning brief (do **not** re-open)

---

## Decision: Dual consumers (pandas/scripts AND Excel/Sheets)

**Question:** Who are the primary CSV consumers?

**Choice:** **Both** — pandas/scripts **and** Excel/Google Sheets.

**Rationale:**

- Scripts need stable paths and a machine-readable sidecar for metadata
- Spreadsheets need one schema per file (no multi-block join)

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** Layout, metadata placement, empty-file policy, HOTSPOT-135–HOTSPOT-141.

---

## Decision: Multi-file bundle from `--output` stem

**Question:** How is multi-section CSV delivered?

**Choice:** **Multi-file bundle** derived from the `--output` path stem (strip trailing `.csv` if present). Example: `--output out/report.csv` → stem `out/report` → `out/report.hotspots.csv`, `out/report.coupling.csv`, `out/report.meta.json`.

**Rationale:**

- Each file is a single RFC 4180 table (header + data)
- Stable, predictable paths for scripts and Sheets import

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** design § File layout, HOTSPOT-136, HOTSPOT-137, HOTSPOT-139.

---

## Decision: Metadata sidecar only

**Question:** Where does scan/compare metadata live?

**Choice:** **Sidecar `{stem}.meta.json` only** — not embedded as a CSV block inside any data file.

**Rationale:**

- Keeps every CSV file header+data only (RFC 4180, spreadsheet-friendly)
- Scripts read structured meta without CSV parsing

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-136, HOTSPOT-137, design § Meta schema.

---

## Decision: Separate CSVs for ranking vs coupling

**Question:** Can hotspots/functions and coupling share one CSV?

**Choice:** **No** — separate files (scan: ranking + coupling; compare: per delta class).

**Rationale:**

- Incompatible column schemas
- Dual-consumer requirement

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-136, HOTSPOT-137.

---

## Decision: `--format csv` requires `--output`

**Question:** Can CSV go to stdout?

**Choice:** **No** — `--format csv` **requires** `--output`. Missing `--output` → `CliUsageError` (exit `2`).

**Rationale:**

- Bundle is inherently multi-file; stdout cannot represent N paths
- Avoids ambiguous single-stream multi-block revival

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-138, CLI wiring.

---

## Decision: Breaking change — replace multi-block; no legacy

**Question:** Keep M17 multi-block single-file layout behind a flag?

**Choice:** **Breaking replace** — no legacy flag, no dual layout, no emit-only-nonempty option.

**Rationale:**

- M17 layout is superseded; leave M17 historical
- YAGNI on compatibility shims

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** Entire feature; STATE.md; optional one-line note on ROADMAP M17.

---

## Decision: Compare always emits 6 CSVs + meta

**Question:** Skip empty compare sections?

**Choice:** **Always emit all 6 data CSVs + meta** — empty sections are **header-only** (header row, zero data rows). Paths are stable.

**Rationale:**

- Scripts can open fixed paths without existence checks
- Spreadsheets see consistent schemas

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-137, HOTSPOT-141.

---

## Decision: Hierarchical naming

**Question:** How are bundle files named?

**Choice:** Hierarchical suffixes after stem:

| Mode               | Examples                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scan               | `{stem}.hotspots.csv`, `{stem}.coupling.csv`, `{stem}.meta.json`                                                                                                                                               |
| Scan (function)    | `{stem}.functions.csv`, `{stem}.coupling.csv`, `{stem}.meta.json`                                                                                                                                              |
| Compare            | `{stem}.hotspots.new.csv`, `{stem}.hotspots.removed.csv`, `{stem}.hotspots.rank-changed.csv`, `{stem}.coupling.new.csv`, `{stem}.coupling.removed.csv`, `{stem}.coupling.rank-changed.csv`, `{stem}.meta.json` |
| Compare (function) | `{stem}.functions.new.csv`, `{stem}.functions.removed.csv`, `{stem}.functions.rank-changed.csv`, plus same coupling trio + meta                                                                                |

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-139, design § Naming.

---

## Decision: Granularity mutual exclusion

**Question:** Emit both `.hotspots.*` and `.functions.*`?

**Choice:** **XOR** — emit `.hotspots.*` **or** `.functions.*` according to `granularity`, never both.

**Rationale:**

- Matches scan result shape (file vs function mode)
- Avoids empty twin files that confuse consumers

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-140.

---

## Decision: Title rows removed

**Question:** Keep M17 section title rows (single-cell section name)?

**Choice:** **Removed** — each CSV is header + data only (RFC 4180 per file).

**Rationale:**

- Title rows break strict CSV parsers and pandas `read_csv`
- Section identity moves into the filename

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** HOTSPOT-141, render refactor.

---

## Decision: Keep existing `csv-utils.ts` escaping

**Question:** Change RFC 4180 escaping?

**Choice:** **Reuse** `src/report/csv-utils.ts` (`escapeCsvField`, `formatCsvRow`) unchanged.

**Rationale:**

- Already correct per HOTSPOT-121
- YAGNI — no new CSV library, no BOM

**Status:** **Confirmed** — locked; do not re-open

**Applies to:** T1/T2 reuse; Out of Scope (BOM, zip, wide CSV).

---

## Related closed decisions (prior milestones)

| Decision                                 | Value             | Relevance to M18                    |
| ---------------------------------------- | ----------------- | ----------------------------------- |
| M17 multi-block single CSV               | Done / historical | Superseded by this milestone        |
| `--top` ignored for CSV                  | M16/M17           | Unchanged                           |
| Reporter pure (no `fs` in `src/report/`) | M5/M10/M17        | Unchanged — CLI writes bundle       |
| UTF-8 without BOM                        | M17               | Unchanged                           |
| No `mkdir -p` / overwrite OK             | M10               | Apply to each bundle path           |
| Format from `--format` only              | M10               | Unchanged                           |
| Requirement ID start                     | `HOTSPOT-135`     | Continues after M16 (`HOTSPOT-134`) |
