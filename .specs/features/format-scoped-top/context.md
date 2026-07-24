# Milestone 16 — Format-Scoped Top Limit Context

**Spec**: [`.specs/features/format-scoped-top/spec.md`](./spec.md)  
**Status**: Done

Captured decisions for M16. No open gray areas — all choices confirmed from ROADMAP M16 and M17 precedent.

---

## Decision: `--top` scoped to table and markdown

**Question:** Which output formats should `--top N` limit?

**Choice:** **`table` and `markdown` only.** `json` and `csv` export full ranked arrays; `--top` is ignored at render time.

**Rationale:**

- `runScan()` returns full sorted lists (M5 D3, M6 integration spec); machine-readable exports should preserve them
- Human-readable terminal/PR output benefits from concise default (`DEFAULT_TOP = 20`)
- M17 established CSV full-export; M16 extends the same rule to JSON
- ROADMAP M16 explicit requirement

**Status:** **Confirmed**

**Applies to:** T1 reporter dispatch, HOTSPOT-129, HOTSPOT-131, HOTSPOT-132.

---

## Decision: JSON breaking change (intentional)

**Question:** Is changing JSON output from sliced to full arrays a breaking change?

**Choice:** **Yes — intentional.** Pre-M16, `--format json --top N` returned at most N items per array. Post-M16, JSON always returns full arrays regardless of `--top`.

**Rationale:**

- ARCHITECTURE.md already documents desired behavior (written during M17)
- Pipelines treating JSON as canonical export need complete data
- Users wanting limited JSON can use `jq '.hotspots[:N]'` post-export
- Baselines saved with pre-M16 sliced JSON remain valid for compare (M13 baseline-as-truth)

**Status:** **Confirmed**

**Applies to:** T3 STATE.md update, HOTSPOT-134.

---

## Decision: Compare classification unchanged

**Question:** Does M16 change how `compareScanResults()` classifies entities?

**Choice:** **No.** Classification always uses full rankings from baseline and current scans (M13). Only table/markdown **display** of delta arrays is sliced via `sliceCompareResult`.

**Rationale:**

- M13 context.md decision: “Render only — classification uses full rankings”
- M16 narrows which formats call `sliceCompareResult` (table/markdown only, not JSON/CSV)

**Status:** **Confirmed**

**Applies to:** T1, HOTSPOT-130.

---

## Decision: No warning when `--top` ignored for JSON/CSV

**Question:** Should the CLI warn when `--top` is set with `--format json` or `--format csv`?

**Choice:** **No warning.** Flag is parsed and validated (positive integer) but silently ignored at render.

**Rationale:**

- YAGNI — avoids stderr noise in CI scripts that pass `--top` uniformly across formats
- Commander help text documents scope
- Same pattern as optional flags on other tools

**Status:** **Confirmed**

**Applies to:** T2 CLI help, HOTSPOT-134.

---

## Decision: CSV code unchanged

**Question:** Does M16 require CSV renderer changes?

**Choice:** **No.** M17 already bypasses slice helpers for CSV. M16 only adds JSON to the bypass path in `createReporter()`.

**Rationale:**

- `renderCsv` / `renderCompareCsv` already receive unsliced results
- M16 tests include CSV regression guard only

**Status:** **Confirmed**

**Applies to:** T1 (no csv.ts changes), HOTSPOT-133 regression test.

---

## Decision: Slice helpers unchanged

**Question:** Should `sliceScanResult` / `sliceCompareResult` gain format-awareness?

**Choice:** **No.** Helpers remain format-agnostic. `createReporter()` decides whether to call them based on `options.format`.

**Rationale:**

- Single responsibility — slice logic separate from dispatch
- M17 CSV pattern: bypass at factory, not inside slice helpers
- Easier unit testing of slice edge cases in isolation

**Status:** **Confirmed**

**Applies to:** T1, design.md § createReporter dispatch.

---

## Related closed decisions (STATE.md / prior milestones)

| Decision                             | Value                | Relevance to M16                                   |
| ------------------------------------ | -------------------- | -------------------------------------------------- |
| Default `--top`                      | `20` (`DEFAULT_TOP`) | Unchanged; applies to table/markdown               |
| Pipeline full lists                  | `runScan()` no slice | JSON/CSV now align with pipeline output            |
| M5 reporter owns display limit       | slice at render      | Scoped by format in M16                            |
| M13 compare `--top`                  | display-only slice   | JSON/CSV excluded from slice in M16                |
| M17 CSV `--top` ignored              | full export          | Precedent for JSON                                 |
| M5 `reporter-cli/spec.md` HOTSPOT-45 | JSON sliced at N     | **Superseded** by M16 — historical spec not edited |
| Requirement ID start                 | `HOTSPOT-129`        | Continues after M17 (`HOTSPOT-128`)                |
