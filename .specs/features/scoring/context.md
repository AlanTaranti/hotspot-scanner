# Milestone 4 — Scoring Context

**Feature slug:** `scoring`  
**Captured:** 2026-07-21  
**Trigger:** Gray areas in IMPL §4.3 (normalization strategy) and IMPL §16 (`--min-cochange` default)

---

## Decision: Hotspot normalization strategy

**Question:** IMPL §4.3 allows min-max or log-scale normalization — which strategy should M4 lock in?

**Choice:** **Log-scale** — `log1p(value)` then min-max to [0, 1] per scan across the scored file set.

**Rationale:**

- Dampens heavy-tailed churn and complexity distributions common in real repos
- Preserves relative ordering while reducing dominance of outlier files
- Edge cases (single file, all equal values) handled by degenerate min-max → all outputs 0

**Formula:**

```
transformed[i] = log1p(raw[i])
normalized[i] = (transformed[i] - min) / (max - min)   // when max > min
normalized[i] = 0                                       // when max === min
```

**Applies to:** Both complexity and churn metrics independently before multiplying into `hotspotScore`.

---

## Decision: Default `--min-cochange` threshold

**Question:** IMPL §16 leaves default `--min-cochange` as `[CLARIFICAR]`. What value should M4 export for M5 CLI wiring?

**Choice:** **3** — exported as `DEFAULT_MIN_COCHANGE` from `src/scoring/`.

**Rationale:**

- Filters one-off and two-commit coincidences (stricter than 2)
- Common threshold in coupling literature for meaningful pairs
- M5 CLI will use this constant when `--min-cochange` is omitted

**M4 scope:** Scorer accepts `minCochange` parameter; constant exported for future CLI. CLI flag wiring remains M5.

---

## Related closed decisions (STATE.md)

| Decision             | Value                     | Relevance to M4                       |
| -------------------- | ------------------------- | ------------------------------------- |
| Churn metric         | Raw `commitCount`         | HotspotScorer churn input             |
| Coupling denominator | `min(commitsA, commitsB)` | TemporalCouplingScorer formula        |
| Coupling vs hotspot  | Separate rankings         | Coupling does not feed `hotspotScore` |
