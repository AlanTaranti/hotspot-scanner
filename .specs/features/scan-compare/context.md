# Milestone 13 — Scan Compare Context

**Feature slug:** `scan-compare`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M13 scope, M10 JSON export + M11 function granularity, user decisions during planning

---

## Decision: CLI shape

**Question:** How should users invoke scan compare — subcommand or flag on `scan`?

**Choice:** **`scan --baseline <file>` only** — extend the existing `scan` command with an optional `--baseline` flag. No separate `compare` subcommand.

**Rationale:**

- Reuses all existing `scan` flags (`--since`, `--granularity`, `--format`, `--output`, `--top`, `--include`, `--exclude`, `--min-cochange`) without duplication
- Typical CI flow: `scan --format json --output baseline.json` then `scan --baseline baseline.json --format markdown`
- User confirmed during planning (initial `compare` subcommand revised to `--baseline` flag)

**Status:** **Confirmed**

**Applies to:** T4 CLI wiring, HOTSPOT-108.

---

## Decision: Scan without baseline unchanged

**Question:** Should `scan` without `--baseline` change any existing behavior?

**Choice:** **No** — omitting `--baseline` is identical to M11. Normal scan report on stdout/file.

**Rationale:**

- Default path must not regress existing consumers or integration tests
- Compare is opt-in via explicit flag

**Status:** **Confirmed**

**Applies to:** T4 CLI branch, HOTSPOT-108.

---

## Decision: Compare scope (baseline-as-truth)

**Question:** What entity set does the compare operate on?

**Choice:** **Baseline-as-truth** — entities present in the baseline JSON define the tracked set (removed / rank-changed). Entities in the current full ranking absent from baseline keys are reported as `new`.

**Rationale:**

- Baselines saved with `--top N` contain exactly N entities — compare tracks those N over time
- "New" surfaces regressions that enter the ranking without requiring a full-repo diff
- User confirmed during planning

**Status:** **Confirmed**

**Applies to:** T2 compare engine, HOTSPOT-105, HOTSPOT-106.

---

## Decision: Rank source for current scan

**Question:** For rank-changed classification, which current ranking is used?

**Choice:** **Full `runScan()` ranking, pre-slice** — current rank is the 1-based index in the complete ranked array returned by the pipeline. Baseline rank is the 1-based index in the saved baseline array.

**Rationale:**

- ARCHITECTURE documents pipeline returning full ranked lists; `--top` applies at render via `sliceScanResult`
- An entity can leave the top-N baseline set while still existing in the full ranking (rank-changed, not removed)
- Removed = baseline key absent from the full current ranking entirely

**Status:** **Confirmed**

**Applies to:** T2 compare engine, HOTSPOT-105, HOTSPOT-106.

---

## Decision: Granularity mismatch

**Question:** What happens when baseline `meta.granularity` differs from the current scan granularity?

**Choice:** **Hard error** — CLI exits `!= 0` with a clear message. No partial compare.

**Rationale:**

- File-mode hotspots and function-mode functions are different entity universes
- Comparing across granularities is undefined and would produce misleading deltas

**Status:** **Confirmed**

**Applies to:** T1 validation, T2 engine, HOTSPOT-107.

---

## Decision: `since` mismatch

**Question:** What happens when baseline `meta.since` differs from the current scan `--since`?

**Choice:** **Warning on stderr, continue** — compare proceeds; warning included in `CompareResult.meta.warnings` and surfaced in delta reporters.

**Rationale:**

- CI workflows may legitimately compare against an older baseline window
- Rank deltas remain meaningful; user should be informed but not blocked

**Status:** **Confirmed**

**Applies to:** T2 engine, HOTSPOT-107, T3 reporters.

---

## Decision: Compare output schema

**Question:** Should compare mutate `ScanResult` or introduce a new type?

**Choice:** **New `CompareResult` type** under `version: "1.0"` — does not alter `ScanResult` v1.0 schema used for baselines.

**Rationale:**

- Baseline JSON remains valid `ScanResult` for round-trip export/import
- Delta shape (`new`, `removed`, `rankChanged`) is structurally distinct from scan output
- Additive; no version bump on `ScanResult`

**Status:** **Confirmed**

**Applies to:** T1 types, T3 reporters, HOTSPOT-109, HOTSPOT-110.

---

## Decision: Compare I/O boundary

**Question:** Where does file I/O for compare output live?

**Choice:** **Reporter returns string; CLI writes stdout/file** — same pattern as M10. `validateBaselinePath()` and `loadBaseline()` read baseline in `src/compare/`; transport stays in `bin/`.

**Rationale:**

- M5/M10 established pure reporters + CLI transport
- `src/report/` stays free of baseline filesystem reads (loader in `src/compare/`)

**Status:** **Confirmed**

**Applies to:** T1 loader, T3 reporters, T4 CLI, design § CLI Wiring.

---

## Decision: Exit code on successful compare

**Question:** What exit code when compare completes without errors?

**Choice:** **`0`** — successful compare always exits `0`, regardless of delta content (new/removed/rank-changed). CI fail thresholds are M12.

**Rationale:**

- Consistent with v1 STATE.md decision (no fail thresholds until M12)
- Delta presence is informational, not a gate failure

**Status:** **Confirmed**

**Applies to:** T4 CLI, HOTSPOT-108.

---

## Decision: `--top` on compare output

**Question:** Does `--top N` affect compare classification or only display?

**Choice:** **Render only** — `sliceCompareResult()` slices `new`, `removed`, and `rankChanged` arrays per section before render. Classification uses full rankings.

**Rationale:**

- Mirrors M5/M10/M11 `sliceScanResult` pattern
- User expects `--top 10` to limit displayed delta rows, not hide classification logic

**Status:** **Confirmed**

**Applies to:** T3 `sliceCompareResult`, HOTSPOT-109, HOTSPOT-110.

---

## Decision: Entity identity keys

**Question:** How are entities keyed for matching across baseline and current?

**Choice:**

| Entity | Key |
| ------ | --- |
| File hotspot | `filePath` |
| Function hotspot | `filePath` + `\0` + `functionName` + `\0` + `line` (or equivalent composite) |
| Coupling pair | canonical `(fileA, fileB)` where `fileA < fileB` lexicographically — reuse `canonicalPair` from `coupling-scorer.ts` |

**Rationale:**

- Stable keys already implied by M4/M11 sort tie-breaks
- Coupling canonicalization prevents `a|b` vs `b|a` false mismatches

**Status:** **Confirmed**

**Applies to:** T1 key helpers, T2 engine, HOTSPOT-104.

---

## Related closed decisions (STATE.md / prior milestones)

| Decision | Value | Relevance to M13 |
| -------- | ----- | ---------------- |
| JSON schema version | `"1.0"` | Baseline must be `ScanResult` v1.0 |
| Exit code on successful scan | `0` | Same for successful compare |
| Report channel | stdout (or `--output` file) | Delta report uses same transport |
| Diagnostics channel | stderr | Warnings (`since` mismatch) on stderr |
| `--top` slicing | Render-time via `sliceScanResult` | New `sliceCompareResult` for delta |
| Requirement ID start | `HOTSPOT-103` | Continues after M11 (`HOTSPOT-102`) |
