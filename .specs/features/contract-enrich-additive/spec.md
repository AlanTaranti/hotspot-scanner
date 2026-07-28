# Milestone 66 — Contract Enrich (Additive 3.0) Specification

**Feature slug:** `contract-enrich-additive`  
**Milestone:** M66  
**Priority:** High  
**Status:** Specs Done  
**Depth:** Large  
**IDs:** HOTSPOT-1160–1199 (1185–1199 reserved)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)  
**Sisters:** [scan-compare](../scan-compare/) (M13), [json-contract](../json-contract/) (M20), [compare-interpretation](../compare-interpretation/) (M53), [remove-coupling-analysis](../remove-coupling-analysis/) (M56), [ncloc-metric](../ncloc-metric/) (M57); additive pattern exemplar [scan-observability](../scan-observability/) (M51 `meta.timings`)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [CONCERNS.md](../../codebase/CONCERNS.md), `schemas/`, `src/types/domain.ts`

---

## Problem Statement

JSON `version: "3.0"` baselines and compare reports are valid but lean for tooling DX: consumers cannot tell which scanner build produced a file, IDEs cannot auto-link output to the published schema via `$schema`, and compare `rankChanged` rows expose rank movement without score / NCLOC / commit deltas — so operators must manually diff two scans. Enrichment must stay **additive** so existing baselines remain usable without re-scan.

## Goals

- [ ] Every new scan emits `meta.scannerVersion` from `package.json`; compare meta does likewise
- [ ] Scan/compare JSON includes top-level `$schema` matching schema `$id` URLs
- [ ] Each `rankChanged` item includes `scoreDelta`, `nclocDelta`, `commitCountDelta` (current − baseline)
- [ ] Table, markdown, JSON, and CSV surfaces expose those deltas; explain includes them
- [ ] Schemas + contract tests updated; old baselines without new fields still load
- [ ] Living docs reflect the additive contract; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                             | Reason                             |
| --------------------------------------------------- | ---------------------------------- |
| JSON version bump (`3.1` / `4.0`)                   | Locked additive under `3.0`        |
| Auto-migrate / rewrite old baselines                | Fail-or-accept only; no migration  |
| Dual nested baseline/current entities on RankChange | YAGNI — deltas + baseline `entity` |
| Delta fields on `new` / `removed`                   | No paired metrics                  |
| New CLI flags or config keys                        | Serialization/compare only         |
| Ranking / scoring / NCLOC formula changes           | Unrelated                          |
| Retarget M53 triage to current score                | Deferred                           |
| Executive-summary `scannerVersion` line             | JSON/CSV meta enough               |

---

## User Stories

### P1: `meta.scannerVersion` ⭐ MVP

**User Story:** As a JSON consumer or CI operator, I want `meta.scannerVersion` on scan and compare results so I can tell which package version produced an artifact without guessing from file mtime.

**Why P1:** Locked DX; enables support and drift detection across baselines.

**Acceptance Criteria:**

1. WHEN a scan completes successfully THEN `ScanResult.meta.scannerVersion` SHALL be a non-empty string equal to the package `"version"` from `package.json`.
2. WHEN a compare result is produced THEN `CompareResult.meta.scannerVersion` SHALL be a non-empty string equal to the package `"version"` that produced the compare.
3. WHEN `schemas/scan-result.json` / `compare-result.json` are updated THEN `scannerVersion` SHALL be declared under the relevant meta `properties` and SHALL NOT be required for baseline-era documents.
4. WHEN `loadBaseline` loads a valid `3.0` scan JSON without `meta.scannerVersion` THEN it SHALL succeed.
5. WHEN `loadBaseline` loads a valid `3.0` scan JSON with `meta.scannerVersion` as a string THEN it SHALL preserve that string on the parsed `ScanMeta`.
6. WHEN JSON `version` is emitted THEN it SHALL remain `"3.0"`.

**Requirements:** HOTSPOT-1160, HOTSPOT-1161, HOTSPOT-1162, HOTSPOT-1163, HOTSPOT-1164, HOTSPOT-1165

**Independent Test:** Unit scan asserts `meta.scannerVersion`; compare unit asserts compare meta; load-baseline fixtures with/without field; contract schema compile.

---

### P1: Top-level `$schema` on JSON output ⭐ MVP

**User Story:** As an IDE or pipeline consumer, I want `$schema` on scan/compare JSON so editors and validators resolve the published contract automatically.

**Why P1:** Aligns output with schema `$id`; zero-config validation DX.

**Acceptance Criteria:**

1. WHEN `renderJson` emits scan JSON THEN the payload SHALL include top-level `"$schema": "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/scan-result.json"`.
2. WHEN `renderCompareJson` emits compare JSON THEN the payload SHALL include top-level `"$schema": "https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/compare-result.json"`.
3. WHEN root schemas are updated THEN optional top-level `$schema` (`type: string`) SHALL be declared.
4. WHEN a baseline file includes top-level `$schema` THEN `loadBaseline` / `parseScanResult` SHALL NOT reject solely because of that key.
5. WHEN in-memory domain `ScanResult` / `CompareResult` types are used THEN `$schema` SHALL NOT be required on those TypeScript interfaces (render-layer only).

**Requirements:** HOTSPOT-1166, HOTSPOT-1167, HOTSPOT-1168, HOTSPOT-1169

**Independent Test:** `json.test.ts` / `compare-json.test.ts` assert `$schema`; load-baseline with `$schema` present; contract tests still validate rendered JSON.

---

### P1: Rank-changed metric deltas ⭐ MVP

**User Story:** As an operator comparing against a baseline, I want score / NCLOC / commit-count deltas on rank-changed hotspots so I can see metric movement without manually diffing two scan files.

**Why P1:** Core compare DX; locked shape in context.md.

**Acceptance Criteria:**

1. WHEN `compareScanResults` classifies a hotspot as `rankChanged` THEN that item SHALL include `scoreDelta`, `nclocDelta`, and `commitCountDelta` computed as **current − baseline** from the two `ScanResult` hotspot entries.
2. WHEN `RankChange.entity` is present THEN it SHALL remain the **baseline** `HotspotScore` (existing required field semantics unchanged).
3. WHEN a hotspot appears only in `new` or `removed` THEN it SHALL NOT gain `scoreDelta` / `nclocDelta` / `commitCountDelta` fields.
4. WHEN baseline and current share a file at the **same** rank THEN it SHALL NOT appear in `rankChanged` (unchanged).
5. WHEN compare runs against an old baseline lacking `scannerVersion` / `$schema` THEN deltas SHALL still compute correctly from hotspot metrics (no re-scan required).
6. WHEN `schemas/compare-result.json` describes `RankChangeHotspot` THEN it SHALL declare the three delta properties; new compare JSON SHALL validate against the schema.

**Requirements:** HOTSPOT-1170, HOTSPOT-1171, HOTSPOT-1172, HOTSPOT-1173, HOTSPOT-1174

**Independent Test:** `compare.test.ts` with fixed baseline/current scores → assert exact deltas; fixture without `scannerVersion` still compares.

---

### P1: Report surfaces for deltas ⭐ MVP

**User Story:** As a CLI user, I want table, markdown, JSON, and CSV compare output to expose the new deltas so every format stays useful.

**Why P1:** Parity across M9/M10/M18 report surfaces.

**Acceptance Criteria:**

1. WHEN compare JSON is rendered THEN each `rankChanged` object SHALL include the three delta fields.
2. WHEN compare CSV `hotspots.rank-changed.csv` is rendered THEN columns SHALL include `scoreDelta`, `nclocDelta`, and `commitCountDelta` (recommended after `rankDelta`).
3. WHEN compare table rank-changed section is rendered THEN it SHALL show delta columns for score, NCLOC, and commit count (stable header abbreviations acceptable).
4. WHEN compare markdown rank-changed table is rendered THEN it SHALL show the same three delta columns.
5. WHEN existing Score / NLOC / churn columns render for rank-changed rows THEN they SHALL continue to use `entity.*` (baseline values).
6. WHEN compare `--explain` hits a `rank-changed` target THEN the explain block SHALL include `scoreDelta`, `nclocDelta`, and `commitCountDelta`.

**Requirements:** HOTSPOT-1175, HOTSPOT-1176, HOTSPOT-1177, HOTSPOT-1178, HOTSPOT-1179, HOTSPOT-1180

**Independent Test:** Co-located report unit tests + explain-compare test with fixed RankChange deltas.

---

### P2: Living documentation

**User Story:** As a maintainer, I want ARCHITECTURE / README (and STRUCTURE if a helper module is added) to document additive `scannerVersion`, `$schema`, and rank-changed deltas under `3.0`.

**Why P2:** Keeps Design SoT honest after Execute.

**Acceptance Criteria:**

1. WHEN docs are updated THEN they SHALL state JSON stays `version: "3.0"` with additive fields.
2. WHEN docs mention compare deltas THEN they SHALL document the locked shape and `entity` = baseline semantics.
3. WHEN a new package-version helper module is added THEN STRUCTURE SHALL list it.

**Requirements:** HOTSPOT-1183, HOTSPOT-1184

**Independent Test:** Doc review in Execute; no separate runtime test.

---

## Edge Cases

- WHEN baseline meta lacks `scannerVersion` and/or timings THEN compare SHALL still succeed and emit current-side / compare-level `scannerVersion` on new output.
- WHEN baseline JSON includes `$schema` THEN parse SHALL ignore it for validation purposes.
- WHEN `ncloc` or `commitCount` decreases THEN deltas SHALL be negative integers/numbers (no absolute-value coercion).
- WHEN scores differ only by floating point THEN `scoreDelta` SHALL be exact arithmetic difference of the two stored numbers (no extra rounding beyond existing report formatters at display time).
- WHEN `rankChanged` is empty THEN formats SHALL not invent delta rows.
- WHEN package.json version is read THEN a single cached helper SHOULD be reused (scan + compare) to avoid divergent strings within one process.

---

## Requirement Traceability

| Requirement ID    | Story                                           | Phase | Status   |
| ----------------- | ----------------------------------------------- | ----- | -------- |
| HOTSPOT-1160      | P1: scannerVersion on ScanMeta emit             | Tasks | Pending  |
| HOTSPOT-1161      | P1: scannerVersion on CompareMeta emit          | Tasks | Pending  |
| HOTSPOT-1162      | P1: Schema declare scannerVersion (optional)    | Tasks | Pending  |
| HOTSPOT-1163      | P1: loadBaseline accept without scannerVersion  | Tasks | Pending  |
| HOTSPOT-1164      | P1: loadBaseline preserve string scannerVersion | Tasks | Pending  |
| HOTSPOT-1165      | P1: Stay on version `"3.0"`                     | Tasks | Pending  |
| HOTSPOT-1166      | P1: renderJson `$schema` URL                    | Tasks | Pending  |
| HOTSPOT-1167      | P1: renderCompareJson `$schema` URL             | Tasks | Pending  |
| HOTSPOT-1168      | P1: Schema declare optional `$schema`           | Tasks | Pending  |
| HOTSPOT-1169      | P1: Baseline with `$schema` still loads         | Tasks | Pending  |
| HOTSPOT-1170      | P1: RankChange delta fields shape               | Tasks | Pending  |
| HOTSPOT-1171      | P1: Compute current − baseline at compare time  | Tasks | Pending  |
| HOTSPOT-1172      | P1: entity remains baseline HotspotScore        | Tasks | Pending  |
| HOTSPOT-1173      | P1: No deltas on new/removed                    | Tasks | Pending  |
| HOTSPOT-1174      | P1: Schema RankChangeHotspot deltas             | Tasks | Pending  |
| HOTSPOT-1175      | P1: JSON includes deltas                        | Tasks | Pending  |
| HOTSPOT-1176      | P1: CSV rank-changed columns                    | Tasks | Pending  |
| HOTSPOT-1177      | P1: Table delta columns                         | Tasks | Pending  |
| HOTSPOT-1178      | P1: Markdown delta columns                      | Tasks | Pending  |
| HOTSPOT-1179      | P1: entity.* columns unchanged (baseline)       | Tasks | Pending  |
| HOTSPOT-1180      | P1: Explain includes deltas                     | Tasks | Pending  |
| HOTSPOT-1183      | P2: ARCHITECTURE / README additive contract     | Tasks | Pending  |
| HOTSPOT-1184      | P2: STRUCTURE if helper module added            | Tasks | Pending  |
| HOTSPOT-1185–1199 | —                                               | —     | Reserved |

**Coverage:** 25 assigned (1160–1184 with 1181–1182 unused stretch), 15 reserved (1185–1199).

**Unused stretch (available if Execute needs split):** HOTSPOT-1181, HOTSPOT-1182.

---

## Success Criteria

- [ ] Fresh scan JSON has `version: "3.0"`, `meta.scannerVersion`, and `$schema` scan URL
- [ ] Fresh compare JSON has `meta.scannerVersion`, `$schema` compare URL, and rankChanged deltas
- [ ] Old `3.0` baseline without new fields still loads and produces correct deltas
- [ ] Table/markdown/CSV/explain expose deltas; contract tests green
- [ ] `pnpm build && pnpm test` passes after Execute
