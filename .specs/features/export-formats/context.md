# Milestone 10 — Export Formats Context

**Feature slug:** `export-formats`  
**Captured:** 2026-07-22  
**Trigger:** ROADMAP M10 scope, M5 stderr/stdout channel decisions, user confirmation during planning

---

## Decision: `--output` suppresses stdout report

**Question:** When `--output <path>` is used, should the report also appear on stdout?

**Choice:** **File only** — report is written to the file; stdout is silent for report content. stderr remains the channel for warnings and progress.

**Rationale:**

- Explicit file export API should not duplicate output to two sinks
- Matches common CLI tools (`eslint --output-file`, `prettier --write`)
- Preserves M5 invariant: diagnostics on stderr, report on stdout — with `--output`, stdout simply has no report
- User confirmed this option during planning (2026-07-22)

**Status:** **Confirmed**

**Applies to:** T2 CLI wiring, HOTSPOT-83, HOTSPOT-89.

---

## Decision: Markdown includes `linesChanged`

**Question:** Should the markdown hotspots table include `linesChanged`, which M9 omits from the terminal table for width?

**Choice:** **Yes** — markdown table includes a **Lines** column (`linesChanged`).

**Rationale:**

- PR/markdown viewers handle wide tables better than terminal columns
- M9 JSON already exposes `linesChanged`; markdown can be richer than CLI table
- User confirmed during planning (2026-07-22)

**Status:** **Confirmed**

**Applies to:** T1 `renderMarkdown()`, design § Markdown Layout, HOTSPOT-86.

---

## Decision: Overwrite existing output files

**Question:** Should `--output` refuse to overwrite an existing file?

**Choice:** **Overwrite** — no `--no-clobber` flag in M10.

**Rationale:**

- CI and local workflows typically want fresh reports each run
- YAGNI — add opt-out only if users request it

**Status:** **Confirmed**

**Applies to:** T2, HOTSPOT-88.

---

## Decision: No auto-create parent directories

**Question:** Should the CLI create missing parent directories for `--output <path>`?

**Choice:** **No** — fail with a clear error if the parent directory does not exist.

**Rationale:**

- Explicit paths reduce surprise (user meant `./reports/out.md` not `/tmp/random/`)
- YAGNI — `mkdir -p` behavior can be added later if needed

**Status:** **Confirmed**

**Applies to:** T2 path validation, HOTSPOT-84.

---

## Decision: Format from `--format` only

**Question:** Should output format be inferred from file extension (e.g., `.json` → json)?

**Choice:** **No** — `--format` flag is the sole source of truth; file extension is not inspected.

**Rationale:**

- Avoids mismatch when user writes `report.txt` with `--format json`
- Consistent with M5 case-sensitive explicit `--format` validation

**Status:** **Confirmed**

**Applies to:** T2 CLI, HOTSPOT-85, HOTSPOT-88.

---

## Decision: File I/O at CLI boundary

**Question:** Where should `fs.writeFile` live — `bin/` or `src/report/`?

**Choice:** **`bin/hotspot-scanner.ts`** — reporter returns string; CLI handles stdout vs file write.

**Rationale:**

- M5 pattern: reporter is pure string render; transport is CLI concern
- Keeps `src/report/` free of filesystem dependencies (easier unit tests)
- Aligns with AGENTS.md — no domain logic in bin, but I/O routing is CLI responsibility

**Status:** **Confirmed**

**Applies to:** design.md § CLI Wiring, T2.

---

## Related closed decisions (STATE.md / M5 context)

| Decision                       | Value        | Relevance to M10                     |
| ------------------------------ | ------------ | ------------------------------------ |
| Warnings/progress channel      | stderr       | Unchanged with `--output`            |
| Report channel (no `--output`) | stdout       | Unchanged                            |
| Default `--format`             | `table`      | Unchanged                            |
| JSON schema version            | `"1.0"`      | Unchanged — file export is same JSON |
| Requirement ID start           | `HOTSPOT-83` | Continues after M9 (`HOTSPOT-82`)    |
