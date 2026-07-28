# Milestone 71 — Remove Compare & Baseline Context

**Feature slug:** `remove-compare-baseline`  
**Milestone:** ROADMAP M71  
**Depth:** Complex  
**Requirement IDs:** HOTSPOT-1300+ (gaps reserved as needed)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Precedent:** [remove-coupling-analysis](../remove-coupling-analysis/) (M56)  
**Sisters / inverse (historical Done — superseded, not reopened):** [scan-compare](../scan-compare/spec.md) (M13), [workflow-subcommands](../workflow-subcommands/spec.md) (M40), [compare-interpretation](../compare-interpretation/spec.md) (M53), [csv-bundle](../csv-bundle/spec.md) (M18), [json-contract](../json-contract/spec.md) (M20), [contract-enrich-additive](../contract-enrich-additive/spec.md) (M66), [output-interpretation-ux](../output-interpretation-ux/spec.md) (M41), [cli-surface-parity](../cli-surface-parity/spec.md) (M63), [warnings-bookend-dx](../warnings-bookend-dx/spec.md) (M68), [feedback-copy-ux](../feedback-copy-ux/spec.md) (M62)

---

## Intent

Completely remove scan-compare and baseline workflows from the product: `compare` subcommand, `baseline save`, `scan --baseline`, `--strict`, compare reporters, `schemas/compare-result.json`, public `compareScanResults` / `loadBaseline` / `Compare*` types, warning `COMPARE_SINCE_MISMATCH`, fixtures, and living-doc claims. Product becomes **scan-only**:

```text
git log → NCLOC → scoring → report (table / JSON / markdown / CSV)
```

Hard cut — no deprecation window, no shim flags, no empty compare stubs (precedent: M56).

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| Milestone | **M71**                                                                      |
| Slug      | `remove-compare-baseline`                                                    |
| Depth     | **Complex**                                                                  |
| IDs       | **HOTSPOT-1300+** (reserve gaps; next free band after M68–M70 HOTSPOT-1230+) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Hard cut — no deprecation (LOCKED)

**Question:** Soft-deprecate compare/baseline behind flags or keep empty stubs?

**Choice:** **Hard cut** — remove entirely. No deprecation window, no shim flags, no empty compare stubs, no header-only compare CSV leftovers.

**Rationale:** Same pattern as M56 (remove coupling) and M18 (CSV hard cut). YAGNI on compatibility shims.

**Status:** **Confirmed** — do not re-open

**Applies to:** Entire feature; HOTSPOT-1300+.

---

## Decision: Public API — keep `parseScanResult` only (LOCKED)

**Question:** What remains from the compare/baseline public surface?

**Choice:**

| Remove                                                                | Keep              |
| --------------------------------------------------------------------- | ----------------- |
| `compareScanResults`                                                  | `parseScanResult` |
| `loadBaseline`                                                        | —                 |
| `CompareResult`, `CompareMeta`, `HotspotCompareSection`, `RankChange` | —                 |

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1303–1305, HOTSPOT-1309, HOTSPOT-1311.

---

## Decision: Error rename — `ScanResultParseError` (LOCKED)

**Question:** Keep `BaselineError` name after baseline is gone?

**Choice:** Rename `BaselineError` → **`ScanResultParseError`**. Hard cut — **no alias**, no dual export. Public API must have no “baseline” naming.

Hint copy for invalid payloads must drop `baseline save` language; prefer re-scan with `--format json --output <path>` (or equivalent scan-only guidance).

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1304.

---

## Decision: `parseScanResult` home path (LOCKED)

**Question:** Where does `parseScanResult` live after `src/compare/` is deleted?

**Choice:** **`src/scan-result/`**

| Item          | Path                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| Module        | `src/scan-result/parse-scan-result.ts`                                      |
| Barrel        | `src/scan-result/index.ts`                                                  |
| Unit tests    | `src/scan-result/parse-scan-result.test.ts`                                 |
| Package alias | **No** new `#scan-result` — drop `#compare`; export via `src/index.ts` only |

**Rejected:** `src/contract/` (easy to confuse with `schemas/`); leaving under a hollow `src/compare/`.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1303; design § Components.

---

## Decision: Scan JSON stays `version: "3.0"` (LOCKED)

**Question:** Bump scan contract when deleting compare?

**Choice:** Stay at **`version: "3.0"`**. Scan shape unchanged. Delete compare contract entirely (`schemas/compare-result.json` gone). No scan schema migration.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1306, HOTSPOT-1307.

---

## Decision: CLI / warning surface removal (LOCKED)

**Remove:**

| Surface     | Items                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Subcommands | `compare`, `baseline save` (and `baseline` parent)                                                 |
| Scan flags  | `--baseline`, `--strict` (compare-only)                                                            |
| Wiring      | `writeCompareExplainBlock`, `enforceStrictCompare`, `executeCompareAndRender`, `writeBaselineJson` |
| Warning     | `COMPARE_SINCE_MISMATCH` (emitters + docs)                                                         |

**Keep:**

| Surface                                              | Notes                                              |
| ---------------------------------------------------- | -------------------------------------------------- |
| Scan `--explain`                                     | Unchanged (scan-mode explain)                      |
| `--fail-on-explain-miss`                             | Unchanged                                          |
| Formats / `--output` / CSV / table / markdown / JSON | Scan path only                                     |
| Exit `1`                                             | Only `--fail-on-explain-miss` miss (no `--strict`) |

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1300–1302, HOTSPOT-1310.

---

## Decision: Historical Done specs stay historical (LOCKED)

**Do not reopen** M13 / M40 / M53 (and other compare Done specs). They remain historical Done. M71 documents **supersession** in ROADMAP/STATE/spec header / living docs. Do not rewrite historical Done feature specs.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-1314.

---

## Out of scope (LOCKED)

| Item                                     | Reason                          |
| ---------------------------------------- | ------------------------------- |
| npm publish / npx                        | Deferred                        |
| CI recipes / SARIF                       | Deferred                        |
| Fail-on-warning                          | Deferred                        |
| Item C (full warning lines in scan body) | Deferred                        |
| Score formula / NCLOC                    | Unrelated                       |
| Soft deprecation / legacy flags          | Hard cut locked                 |
| Reopening historical Done compare specs  | Stay historical; M71 supersedes |

---

## Related closed decisions (prior milestones — superseded product behavior)

| Decision                                           | Prior value                             | M71 effect                     |
| -------------------------------------------------- | --------------------------------------- | ------------------------------ |
| Scan compare / baseline (M13)                      | `scan --baseline` + delta report        | Removed                        |
| Workflow subcommands (M40)                         | `baseline save`, `compare`              | Removed                        |
| Compare interpretation (M53)                       | triage, compare `--explain`, `--strict` | Removed                        |
| Compare CSV / meta enrich (M18/M66)                | Compare CSV trio + compare `$schema`    | Removed                        |
| `BaselineError` name (M20+)                        | Baseline-oriented parse errors          | → `ScanResultParseError`       |
| Exit `1` for `--strict` + `COMPARE_SINCE_MISMATCH` | AGENTS exit table                       | Exit `1` only for explain-miss |
| Config `baseline` key                              | Already rejected (M21)                  | Still absent — no config work  |
