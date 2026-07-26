# Milestone 56 — Remove Coupling Analysis Context

**Feature slug:** `remove-coupling-analysis`  
**Milestone:** ROADMAP M56  
**Depth:** Complex  
**Requirement IDs:** HOTSPOT-890+ (gaps reserved as needed)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Sisters / inverse:** [enriched-coupling](../enriched-coupling/spec.md) (M14), [coupling-enrichment](../coupling-enrichment/spec.md) (M27), [coupling-stream-aggregate](../coupling-stream-aggregate/spec.md) (M32), [static-enrich-cache](../static-enrich-cache/spec.md) (M33), [coupling-package-exports](../coupling-package-exports/spec.md) (M44), [csv-bundle](../csv-bundle/spec.md) (M18), [json-contract](../json-contract/spec.md) (M20), [scan-compare](../scan-compare/spec.md) (M13), [output-interpretation-ux](../output-interpretation-ux/spec.md) (M41)

---

## Intent

Completely remove temporal coupling analysis from the product: co-change pairs, coupling scoring, static enrich (relative / tsconfig / package exports), CLI/config knobs, JSON `coupling` arrays, CSV coupling sidecars, tests, fixtures, and living documentation. Hotspots remain complexity + churn only.

Hard cut — no deprecation window, no legacy flag (precedents: M18 csv-bundle, M12 scope removal).

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field | Value |
| ----- | ----- |
| Milestone | **M56** |
| Slug | `remove-coupling-analysis` |
| Depth | **Complex** |
| IDs | **HOTSPOT-890+** (reserve gaps as needed) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Hard cut — no deprecation (LOCKED)

**Question:** Soft-deprecate coupling behind a flag or keep empty `coupling: []`?

**Choice:** **Hard cut** — remove the feature entirely. No legacy CLI flag, no empty `coupling` array in JSON, no header-only coupling CSV stubs.

**Rationale:** Same pattern as M18 (replace multi-block CSV) and M12 (remove CI fail-on-score). YAGNI on compatibility shims.

**Status:** **Confirmed** — do not re-open

**Applies to:** Entire feature; HOTSPOT-890+.

---

## Decision: JSON contract → version `"2.0"` (LOCKED)

**Question:** How does the published JSON contract change?

**Choice:**

- Bump `ScanResult.version` and `CompareResult.version` to **`"2.0"`**
- **Remove** top-level `coupling` from both result types (do **not** keep `coupling: []`)
- Update `schemas/scan-result.json` and `schemas/compare-result.json` accordingly (drop CouplingPair `$defs` / required `coupling`)

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-890–892, HOTSPOT-896.

---

## Decision: Baseline rejection (LOCKED)

**Question:** What happens to existing `1.0` baselines (and any JSON that still has `coupling`)?

**Choice:** Reject via `BaselineError` with a clear **re-scan** message (M20/M27 pattern):

- `version === "1.0"` → unsupported
- presence of top-level `coupling` → reject (even if version spoofed to `"2.0"`)
- Expected version for load: **`"2.0"`** only

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-894, HOTSPOT-895; `src/compare/load-baseline.ts`.

---

## Decision: CSV bundle omits coupling files (LOCKED)

**Question:** Emit empty/header-only `{stem}.coupling.csv` for path stability?

**Choice:** **Omit** entirely:

- Scan: no `{stem}.coupling.csv`
- Compare: no `coupling.new|removed|rank-changed.csv` trio

Not header-only. Compare data CSV count drops from 6 → 3 (+ meta). Supersedes M18 “always emit coupling.csv”.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-900; leave M18 Done/historical with M56 supersession note.

---

## Decision: CLI / config surface removal (LOCKED)

**Remove:**

| Surface | Items |
| ------- | ----- |
| CLI flags | `--min-cochange`, `--mega-commit-threshold` |
| `--only` | value `coupling` (keep `hotspots` \| `functions`) |
| Config keys | `minCochange`, `megaCommitThreshold` (loader + exemplar) |

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-901–903, HOTSPOT-912.

---

## Decision: Git miner coupling removal (LOCKED)

**Remove from miner:**

- `pairCounts` / stream pair aggregation
- `canonicalizePairCounts`
- Mega-commit guard (unique in-scope file threshold for coupling)
- `MEGA_COMMIT_SKIPPED` warning code and `mega-commit-warnings` module behavior tied to coupling skip

**Keep:** Single streaming `git log` for **churn** / `FileChangeStats` (ADR-2026-020 revisited: stream still feeds churn only). `PathAliasMap` / renames unchanged.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-904, HOTSPOT-911.

---

## Decision: Delete enrich + coupling scoring modules (LOCKED)

**Delete entirely** (source + co-located tests):

- `src/scoring/coupling-scorer.ts`
- `src/scoring/enrich-coupling-static.ts`
- `src/scoring/tsconfig-path-map.ts`
- `src/scoring/package-exports-map.ts`
- Related report helpers dedicated to coupling (e.g. `coupling-format.ts`) when unused

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-905.

---

## Decision: Historical Done specs stay historical (LOCKED)

**Do not reopen** M4 / M14 / M27 / M32 / M33 / M44 (and other coupling Done specs). They remain historical Done. M56 documents **supersession** in ROADMAP/STATE/spec header.

**Status:** **Confirmed** — do not re-open

**Applies to:** HOTSPOT-910.

---

## Decision: What stays (LOCKED)

| Keep | Notes |
| ---- | ----- |
| Churn / `FileChangeStats` | Unchanged |
| Hotspot scoring (harmonic) | Complexity + churn only |
| `PathAliasMap` / renames | Unchanged |
| Complexity (McCabe) | Unchanged |
| Compare for hotspots / functions | Unchanged |
| `--only hotspots` \| `functions` | Unchanged |

**Status:** **Confirmed** — do not re-open

---

## Out of scope (LOCKED)

| Item | Reason |
| ---- | ------ |
| McCabe decision nodes | Unrelated |
| Harmonic hotspot score formula | Unrelated |
| Function churn | Unrelated |
| npm publish | Deferred |
| CI / SARIF | Deferred |

---

## Related closed decisions (prior milestones — superseded product behavior)

| Decision | Prior value | M56 effect |
| -------- | ----------- | ---------- |
| Default `--min-cochange`: 3 | M4/M5 | Removed |
| Dual-stream / enriched coupling | M14/M27/M33/M44 | Removed |
| Stream `pairCounts` + mega-commit | M32/M47 | Removed |
| JSON `version: "1.0"` + required `coupling` | M20 | → `"2.0"`, no `coupling` |
| CSV always emit `coupling.csv` | M18 | Omit coupling files |
| ADR-2026-020 single stream for churn+coupling | STATE | Revisit: stream feeds churn only |
