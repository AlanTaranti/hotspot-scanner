# Milestone 14 — Enriched Coupling Design

**Spec**: [`.specs/features/enriched-coupling/spec.md`](./spec.md)  
**Context**: [`.specs/features/enriched-coupling/context.md`](./context.md)  
**Status**: Done

---

## Architecture Overview

M14 adds a **post-score enrichment** step: temporal coupling ranking stays identical; each surviving `CouplingPair` gains `hasStaticDependency` by inspecting working-tree sources for resolvable static module edges between the two paths.

```mermaid
flowchart LR
  Git[GitMiner] --> Score[scoreCoupling]
  Score --> Enrich[enrichCouplingStaticDeps]
  Enrich --> Result[ScanResult.coupling]
  Result --> Report[Reporters]
```

**Baseline:** [scoring design](../scoring/design.md), `CouplingPair` in `src/types/domain.ts`, reporters under `src/report/`.  
**Downstream:** M20 JSON Schema must require `hasStaticDependency` on coupling items.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `scoreCoupling` | `src/scoring/coupling-scorer.ts` | Unchanged; call enrich **after** |
| `canonicalPair` / path form | coupling-scorer | Match enrichment paths to same canonical strings |
| `runScan` | `src/scan.ts` | Wire enrich between score and `ScanResult` assembly |
| Reporters | `src/report/*` | Add column/field; reuse formatting helpers |
| Fixture repos | `tests/fixtures/repos/small-ts/` | Integration; add small import-linked pair if needed |
| Report fixtures | `tests/fixtures/report/*.json` | Add boolean to sample coupling objects |

### Integration Points

| Consumer | Impact |
| -------- | ------ |
| `src/types/domain.ts` | Add `hasStaticDependency: boolean` |
| `src/scoring/` | New enrich module + unit tests |
| `src/scan.ts` | Call enricher with `repoPath` |
| `src/report/` | table, markdown, csv, compare-* |
| `src/compare/load-baseline.ts` | Soft: accept pairs with or without field until M20 hardens (M14 may cast; M20 validates) |
| Fixtures / README / ARCHITECTURE | Document field |

### Fragile areas (CONCERNS.md)

| Area | Mitigation |
| ---- | ---------- |
| Scoring formulas | Do **not** edit strength formula; enrich only |
| Complexity / McCabe | No change; no ts-morph in scoring enricher |

---

## Components

### CouplingPair type

- **Purpose**: Domain contract for ranked pairs including static-edge flag
- **Location**: `src/types/domain.ts`
- **Interfaces**:
  - `CouplingPair { fileA, fileB, coChangeCount, couplingStrength, hasStaticDependency }`
- **Dependencies**: None
- **Reuses**: Existing coupling fields

### enrichCouplingStaticDeps

- **Purpose**: Set `hasStaticDependency` on each pair by reading sources under `repoPath`
- **Location**: `src/scoring/enrich-coupling-static.ts` (name flexible)
- **Interfaces**:
  - `enrichCouplingStaticDeps(pairs: CouplingPair[], repoPath: string): Promise<CouplingPair[]>` or sync if sync `fs` preferred — match scan async style
  - Internal: extract static specifiers; resolve relative to importer; compare to peer path
- **Dependencies**: `node:fs`, path utilities
- **Reuses**: Path canonicalization conventions from git/scoring (repo-relative posix-ish paths as already stored on pairs)

### Pipeline wiring

- **Purpose**: Ensure all `runScan` consumers get enriched pairs
- **Location**: `src/scan.ts`
- **Interfaces**: Call enricher after `createTemporalCouplingScorer().score(...)`
- **Dependencies**: enrich module
- **Reuses**: Existing scan error/warning hooks if a read fails (optional warn)

### Reporters

- **Purpose**: Display / serialize the new field
- **Location**: `src/report/table.ts`, `markdown.ts`, `csv.ts`, `compare-*.ts`, JSON via object pass-through
- **Interfaces**: Column additions; CSV header `hasStaticDependency`
- **Dependencies**: Updated `CouplingPair`
- **Reuses**: Existing numeric/string formatters

---

## Data Models

```typescript
interface CouplingPair {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  couplingStrength: number;
  hasStaticDependency: boolean;
}
```

**Relationships**: Same ranking entity as M4; additive field only. Compare engine keys remain `fileA|fileB` (identity unchanged).

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Source file missing | `hasStaticDependency = false` | Pair still listed |
| Unreadable file (EACCES) | `false`; optional warning via `onWarning` | Scan continues |
| Malformed import line | Ignore line; continue | Best-effort boolean |
| Empty coupling list | Skip enrich | None |

---

## Tech Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Enrich after score | Yes | Formula purity; fewer files read |
| No ts-morph in scoring | Literal/static string extract | INTEGRATIONS boundary |
| No path aliases | Relative only | YAGNI |
| Schema version | Keep `"1.0"` | Additive like M9/M11 |
| M20 interaction | Schema requires boolean | Plan schemas after M14 Execute preferred; M20 artifacts already list the field |

---

## M20 anticipation

When M20 publishes `schemas/scan-result.json`:

- `coupling.items.properties.hasStaticDependency`: `{ "type": "boolean" }`
- `required` array on coupling items includes `hasStaticDependency`

Baselines produced **before** M14 may omit the field — M20 validation policy should document migration (reject vs default `false`). **Recommendation for M20:** reject missing field for strict contract; document that baselines must be re-scanned post-M14. Capture final choice in M20 context if needed.
