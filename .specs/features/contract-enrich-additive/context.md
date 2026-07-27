# Milestone 66 — Contract Enrich (Additive 3.0) Context

**Feature slug:** `contract-enrich-additive`  
**Milestone:** M66  
**Depth:** Large  
**IDs:** HOTSPOT-1160–1199 (1185–1199 reserved)  
**Status:** Locked (planning) — decisions provided; no open discuss items  
**Sisters:** [scan-compare](../scan-compare/) (M13), [json-contract](../json-contract/) (M20), [compare-interpretation](../compare-interpretation/) (M53), [remove-coupling-analysis](../remove-coupling-analysis/) (M56), [ncloc-metric](../ncloc-metric/) (M57), [scan-observability](../scan-observability/) (M51 additive `meta.timings` exemplar)

**Gathered:** 2026-07-26  
**Spec:** [`.specs/features/contract-enrich-additive/spec.md`](./spec.md)

---

## Feature Boundary

Enrich JSON/compare DX **additively under `version: "3.0"`** — no contract version bump; existing `3.0` baselines remain valid without re-scan.

**In scope:**

1. `meta.scannerVersion` (package.json version) on ScanResult and CompareResult meta
2. Top-level `$schema` URL on JSON scan/compare output aligned with schema `$id`
3. Additive score / NCLOC / commit-count deltas on compare `rankChanged` items; human + CSV surfaces show them

**Out of scope:** JSON major bump (`3.1` / `4.0`); auto-migrating legacy baselines; changing ranking/scoring formulas; new CLI flags; deltas on `new`/`removed`; dual nested baseline/current entity objects; changing triage thresholds.

---

## Decision: Stay on JSON `version: "3.0"` (LOCKED)

**Question:** Bump contract version for new fields?

**Choice:** **Keep `version: "3.0"`.** All enrichments are additive (optional in schema for reading old documents; always emitted on new scans/compares where applicable). Same pattern as M51 `meta.timings` under the then-current version.

**Rationale:** Best DX — operators keep existing baseline JSON files; compare still works; no forced re-scan.

**Applies to:** HOTSPOT-1160–1184.

---

## Decision: `meta.scannerVersion` (LOCKED)

**Question:** Where and how is package version exposed?

**Choice:**

| Surface | Field | Emission |
| ------- | ----- | -------- |
| `ScanResult.meta` | `scannerVersion: string` | Always on successful new scans (`runScan`) |
| `CompareResult.meta` | `scannerVersion: string` | Always on new compares (`compareScanResults` / compare meta assembly) |
| Nested `CompareMeta.baseline` / `.current` | May carry `scannerVersion` when present on those ScanMetas | Copied with nested meta; **absent** on old baselines is OK |

**Source:** `package.json` `"version"` (e.g. `"1.0.0"` today). Shared cached reader (doctor already reads package.json for engines — prefer a small reusable helper, not duplicate ad-hoc paths).

**Schema:** Declare `scannerVersion` under `ScanMeta.properties` and `CompareMeta.properties`. **Not** required for baseline-era documents (optional for forward-compat reading). Contract / unit tests assert presence on fresh scan and compare output.

**`loadBaseline`:** Accept metas with or without `scannerVersion`. When present and a string, preserve it on parsed `ScanMeta` (parity with optional `timings`). Ignore / do not require top-level `$schema` on baseline files.

**Human table/markdown:** Do **not** require dumping `scannerVersion` in executive summary (JSON/CSV meta is enough). CSV `meta.json` includes it when present via meta serialize.

**Applies to:** HOTSPOT-1160–1165.

---

## Decision: Top-level `$schema` on JSON output (LOCKED)

**Question:** How do consumers discover the schema for scan/compare JSON?

**Choice:** Emit top-level `$schema` in **`renderJson`** / **`renderCompareJson`** only (serialization concern — **not** a required field on in-memory `ScanResult` / `CompareResult` domain types).

| Format | URL (exact) |
| ------ | ----------- |
| Scan JSON | `https://vitals.dev/hotspot-scanner/schemas/scan-result.json` |
| Compare JSON | `https://vitals.dev/hotspot-scanner/schemas/compare-result.json` |

These match existing schema `$id` values in `schemas/scan-result.json` and `schemas/compare-result.json`.

**Schema docs:** Declare optional top-level `$schema` (`type: string`) on both root schemas for clarity; `additionalProperties: true` already permits it.

**Baseline load:** Top-level `$schema` on a baseline file MUST NOT cause `BaselineError` (ignored during parse; only `version` + domain fields validated).

**Order in payload:** Prefer `$schema` then `version` then body (implementer discretion if tests lock key order — do not require stable key order beyond presence).

**Applies to:** HOTSPOT-1166–1169.

---

## Decision: Compare metric deltas on `rankChanged` (LOCKED)

**Question:** What additive shape carries score / size / churn deltas without breaking compare?

**Choice — concrete shape:**

```ts
interface RankChange<T> {
  entity: T;              // UNCHANGED required field — see entity semantics below
  baselineRank: number;
  currentRank: number;
  rankDelta: number;      // currentRank - baselineRank (existing)
  scoreDelta: number;     // current.hotspotScore - baseline.hotspotScore
  nclocDelta: number;     // current.ncloc - baseline.ncloc
  commitCountDelta: number; // current.commitCount - baseline.commitCount
}
```

**Computation:** At compare time from the two `ScanResult` hotspot lists (no re-scan). For each key in both rankings with different ranks, read baseline and current `HotspotScore` from the rank maps; set deltas as **current − baseline**.

**Entity semantics (strict additive):** Keep `entity` as the **baseline** `HotspotScore` (today’s `compare.ts` behavior). Do **not** add `baselineEntity` / `currentEntity`. Absolute baseline metrics: `entity.*`. Absolute current metrics: `entity.hotspotScore + scoreDelta` (and likewise for `ncloc`, `commitCount`).

**`new` / `removed`:** No delta fields. Document only — unpaired entities have no baseline↔current metric pair; consumers use the single nested hotspot object as today.

**Unchanged ranks:** Still omitted from `rankChanged` (no delta rows for same-rank files).

**Schema:** Declare `scoreDelta`, `nclocDelta`, `commitCountDelta` on `RankChangeHotspot`. Prefer **required** on the compare schema (CompareResult is not a baseline input). Update fixtures / contract tests. Domain `RankChange<HotspotScore>` always includes the three fields on new compares.

**Formats:**

| Format | Behavior |
| ------ | -------- |
| JSON | Additive fields on each `rankChanged` item |
| CSV | Additive columns on `hotspots.rank-changed.csv`: `scoreDelta`, `nclocDelta`, `commitCountDelta` (after `rankDelta` recommended) |
| Table | Additive columns for rank-changed section (e.g. `ScoreΔ` / `NLOCΔ` / `CommitsΔ` — stable abbreviations OK); existing Score/NLOC/Churn columns continue to render `entity.*` (baseline) |
| Markdown | Same delta columns in the rank-changed table |
| Explain (compare) | Rank-changed explain blocks include the three deltas |

**Triage (M53):** Unchanged rules; still use `entity.hotspotScore` (baseline). Do **not** retarget triage to `entity + scoreDelta` in M66 (YAGNI / separate if needed later).

**Applies to:** HOTSPOT-1170–1182.

---

## Decision: Living docs (LOCKED)

**Choice:** Update ARCHITECTURE (JSON contract / compare delta fields), README (JSON examples / compare columns as needed), TESTING contract note if schemas change, STRUCTURE only if a new helper module is added. No ROADMAP/STATE edits in this planning session (per mission).

**Applies to:** HOTSPOT-1183–1184.

---

## Deferred / Rejected

| Idea | Disposition |
| ---- | ----------- |
| Bump to `3.1` / `4.0` | Rejected — additive under `3.0` |
| `currentEntity` + `baselineEntity` dual nest | Rejected — YAGNI; deltas + baseline `entity` suffice |
| Deltas on `new` / `removed` | Rejected — no pair |
| Force re-scan for scannerVersion | Rejected — optional on load |
| Executive-summary scannerVersion line | Deferred — JSON meta enough |
| Retarget M53 triage to current score | Deferred |
| Changing which side `entity` embeds | Rejected — would break additive semantics under `3.0` |
