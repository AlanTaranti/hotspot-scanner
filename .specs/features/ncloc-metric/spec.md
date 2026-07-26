# Milestone 57 — NCLOC Metric Specification

**Feature slug:** `ncloc-metric`  
**Milestone:** ROADMAP M57  
**Depth:** Complex  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**Sisters / inverse:** [remove-coupling-analysis](../remove-coupling-analysis/spec.md) (M56 hard-cut exemplar), [complexity-analyzer](../complexity-analyzer/spec.md), [harmonic-hotspot-score](../harmonic-hotspot-score/spec.md), [rich-output](../rich-output/spec.md), [function-granularity](../function-granularity/spec.md), [per-function-churn](../per-function-churn/spec.md), [function-mode-scan-efficiency](../function-mode-scan-efficiency/spec.md), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md), [ranking-accuracy-plus](../ranking-accuracy-plus/spec.md), [json-contract](../json-contract/spec.md), [csv-bundle](../csv-bundle/spec.md)

Historical Done specs for McCabe / function mode (M3/M11/M22/M23/M29/M35/M50, etc.) are **not reopened** — this milestone **supersedes** their product behavior.

## Problem Statement

Hotspot ranking uses cyclomatic complexity (McCabe) as axis `c`, which requires a heavy AST stack (ts-morph), fragile decision-node ownership (RT-005), and a large function-mode surface (per-function McCabe, hunk-overlap churn, CSV/compare/explain). The product direction is a simpler, file-level **size** signal: **NCLOC** (non-commented lines of code), still combined with Git churn via the same harmonic formula. Keeping McCabe and function mode would leave dead contract noise and dual mental models. A hard cut — metric swap + function-mode removal + JSON `"3.0"` — aligns analyzer, scoring, CLI, schemas, and docs in one breaking change (parity with M56).

## Goals

- [x] File hotspots use **NCLOC** as axis `c` in `hotspotScore = 2ch/(c+h)` (log1p + min-max + harmonic unchanged)
- [x] JSON contract `version: "3.0"` with field `ncloc` (no `cyclomaticComplexity`, no top-level `functions`)
- [x] Function mode removed end-to-end (CLI/config, miner, scorers, reporters, schemas, tests, docs)
- [x] Baselines `2.0` / legacy complexity fields rejected with clear re-scan `BaselineError`
- [x] Living docs / ADR-2026-019 / skills describe NCLOC + churn (file-only)
- [x] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| npm publish / npx | Deferred |
| CI recipes / SARIF | Deferred |
| Historical AST | Do-not-prioritize |
| Reintroducing temporal coupling | M56 stands |
| Metrics other than NCLOC | YAGNI |
| Soft deprecation / dual McCabe+NCLOC | Hard cut locked |
| Per-function NCLOC | File-level only |
| Reopening historical Done McCabe/function specs | Stay historical; M57 supersedes |

---

## User Stories

### P1: NCLOC as scoring axis `c` ⭐ MVP

**User Story**: As a maintainer, I want files ranked by NCLOC × churn (harmonic) so that hotspots reflect non-commented size plus change frequency without McCabe.

**Acceptance Criteria**:

1. WHEN the size analyzer runs on an eligible source file THEN it SHALL compute file-level **NCLOC** per [context.md](./context.md) (exclude blank and comment-only lines; count lines with code including string literals containing `//`)
2. WHEN hotspot scoring runs THEN it SHALL feed `ncloc` into existing log1p + min-max normalization as axis `c` and keep harmonic combiner `2ch/(c+h)` with zero guard `c+h===0 → 0`
3. WHEN McCabe modules / decision-node fixtures are consulted THEN they SHALL be replaced or retargeted — product path SHALL NOT compute cyclomatic complexity
4. WHEN discovery / PathScope / eligible extensions apply THEN behavior SHALL remain file discovery for TS/JS family extensions (workers may simplify per design)

**Independent Test**: Unit fixtures with known NCLOC; scoring unit tests with fixed `ncloc` + churn → expected order; `small-ts` integration scan returns `ncloc` on hotspots.

**Requirements**: HOTSPOT-920, HOTSPOT-921, HOTSPOT-922, HOTSPOT-923

---

### P1: JSON contract 3.0 with `ncloc` ⭐ MVP

**User Story**: As a downstream integrator, I want scan/compare JSON at version `"3.0"` with `ncloc` and without function arrays so that schemas match the reduced product.

**Acceptance Criteria**:

1. WHEN a successful scan emits JSON THEN `version` SHALL be `"3.0"`, each hotspot SHALL expose `ncloc` (number), and the payload SHALL NOT include `cyclomaticComplexity` or top-level `functions`
2. WHEN compare JSON is emitted THEN `version` SHALL be `"3.0"` and SHALL NOT include a top-level `functions` section; compare SHALL cover hotspots only
3. WHEN `schemas/scan-result.json` and `schemas/compare-result.json` are published THEN they SHALL require `"3.0"`, require `ncloc` on hotspot items, and SHALL NOT define function ranking schemas as part of the required contract
4. WHEN domain types describe results THEN they SHALL use `ncloc`, omit `FunctionHotspotScore` / function complexity types from the public contract, and omit `granularity` from scan/compare meta as applicable

**Independent Test**: Ajv contract tests; grep schemas for `cyclomaticComplexity` / required `functions` → absent.

**Requirements**: HOTSPOT-924, HOTSPOT-925, HOTSPOT-926, HOTSPOT-927

---

### P1: Reject legacy baselines ⭐ MVP

**User Story**: As a CLI user with a `"2.0"` baseline, I want a clear `BaselineError` telling me to re-scan so that compare does not mix McCabe and NCLOC metrics.

**Acceptance Criteria**:

1. WHEN baseline `version` is `"2.0"` or `"1.0"` THEN `loadBaseline` / `parseScanResult` SHALL throw `BaselineError` naming unsupported version and include a re-scan hint
2. WHEN baseline hotspot items contain `cyclomaticComplexity` THEN validation SHALL reject with `BaselineError` + re-scan hint (even if `version` is spoofed as `"3.0"`)
3. WHEN baseline JSON contains top-level `functions` THEN validation SHALL reject with `BaselineError` + re-scan hint
4. WHEN baseline is valid `"3.0"` with `ncloc` and without `functions` THEN load SHALL succeed

**Independent Test**: Unit tests in `load-baseline.test.ts` covering 2.0, spoofed 3.0+cyclomaticComplexity, spoofed 3.0+functions, valid 3.0.

**Requirements**: HOTSPOT-928, HOTSPOT-929, HOTSPOT-930

---

### P1: Remove function mode end-to-end ⭐ MVP

**User Story**: As a CLI user, I want only file-level hotspot ranking so that flags, config, reports, and compare no longer mention functions.

**Acceptance Criteria**:

1. WHEN CLI help/parse runs THEN `--granularity` / `-g` SHALL NOT exist; config SHALL NOT document or apply `granularity`
2. WHEN `runScan` completes THEN it SHALL NOT spawn function-churn, SHALL NOT call function scorers, and SHALL NOT emit a `functions` array
3. WHEN compare runs THEN it SHALL NOT produce function new/removed/rankChanged sections
4. WHEN `--format csv` writes a bundle THEN it SHALL omit `{stem}.functions.csv` and compare `functions.*.csv` (not header-only)
5. WHEN `--only` is used THEN allowed value SHALL be `hotspots` only; `functions` SHALL be invalid
6. WHEN `--explain` targets are parsed THEN `path:function` grammar SHALL be rejected or unsupported; explain SHALL operate on file paths for hotspots only
7. WHEN the tree is searched THEN `src/git/function-churn/`, `function-hotspot-scorer`, and function-only report helpers SHALL be absent (after delete task)

**Independent Test**: CLI unknown `--granularity`; integration asserts no `functions`; CSV key lists; `--only functions` exits ≠ 0; glob deleted paths empty.

**Requirements**: HOTSPOT-931, HOTSPOT-932, HOTSPOT-933, HOTSPOT-934, HOTSPOT-935, HOTSPOT-936, HOTSPOT-937

---

### P1: Reporters, glossary, triage, explain ⭐ MVP

**User Story**: As a reader of table/markdown/CSV and interpretation UX, I want columns and copy to say NLOC (or equivalent) instead of Cpx/complexity, with no function triage/explain paths.

**Acceptance Criteria**:

1. WHEN table/markdown render THEN complexity column label SHALL use **NLOC** (or `ncloc`) instead of Cpx / cyclomatic wording
2. WHEN glossary / triage / summary / `--explain` copy mentions the size axis THEN they SHALL describe NCLOC (non-commented lines), not McCabe
3. WHEN function-specific triage/explain/compare-triage rules exist THEN they SHALL be removed
4. WHEN progress phases are emitted THEN `function-churn` SHALL NOT appear; remaining phases SHALL match file-only pipeline

**Independent Test**: Report unit snapshots/asserts; explain unit tests for file targets only.

**Requirements**: HOTSPOT-938, HOTSPOT-939, HOTSPOT-940

---

### P1: Living documentation and ADR ⭐ MVP

**User Story**: As a reader of project docs and agent skills, I want the product described as NCLOC + churn file hotspots, with ADR-2026-019 superseded and function-mode claims removed.

**Acceptance Criteria**:

1. WHEN PROJECT.md, README, AGENTS, ARCHITECTURE, CONCERNS (RT-005), STRUCTURE, TESTING, INTEGRATIONS (ts-morph role), CONTRIBUTING, recipes, warning-codes are read THEN they SHALL describe NCLOC + churn and SHALL NOT claim McCabe or function granularity as product capabilities
2. WHEN `vitals-pipeline-domain` skill and `fragile-areas` rule are read THEN McCabe decision-node / function-churn rows SHALL be updated or marked superseded; NCLOC scanner shall be the fragile size metric
3. WHEN STATE ADR-2026-019 and rejected-alternatives are read THEN they SHALL document supersession (NCLOC is the product metric; McCabe retired)
4. WHEN historical sister specs are opened THEN they SHALL remain Status Done without content rewrite (optional one-line supersession from M57/ROADMAP only)

**Independent Test**: Doc/skill grep for stale “cyclomatic” / “--granularity function” product claims in living docs (exclude historical `.specs/features/**` as needed).

**Requirements**: HOTSPOT-941, HOTSPOT-942, HOTSPOT-943

---

## Edge Cases

- WHEN a line is only `// comment` or only `/* … */` / JSDoc THEN it SHALL NOT increment NCLOC
- WHEN a line contains code and a trailing `// comment` THEN it SHALL increment NCLOC
- WHEN a string or template literal contains `//` THEN the line SHALL still count if it contains code (not comment-only)
- WHEN a file is unreadable (I/O error) THEN system SHALL warn and skip that file (omit from hotspots) — no McCabe-style syntactic stub required
- WHEN user passes `--granularity` or `-g` THEN commander SHALL fail as unknown option
- WHEN user passes `--only functions` THEN system SHALL error listing allowed `hotspots`
- WHEN config still contains `granularity` THEN treat as unknown key (warn-only `UNKNOWN_CONFIG_KEY`, M55) without applying
- WHEN baseline mixes `"3.0"` with leftover `cyclomaticComplexity` or `functions` THEN reject
- WHEN compare CSV consumers expect functions sidecars THEN scripts break intentionally — document in README/recipes
- WHEN `--concurrency` is set THEN it SHALL still control parallel size analysis / file reads per design (not function-churn)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-920 | P1: NCLOC analyzer definition | Tasks | Done |
| HOTSPOT-921 | P1: Scoring feeds ncloc as `c` | Tasks | Done |
| HOTSPOT-922 | P1: Retire McCabe product path | Tasks | Done |
| HOTSPOT-923 | P1: Discovery/PathScope retained | Tasks | Done |
| HOTSPOT-924 | P1: JSON 3.0 scan | Tasks | Done |
| HOTSPOT-925 | P1: JSON 3.0 compare | Tasks | Done |
| HOTSPOT-926 | P1: Schemas | Tasks | Done |
| HOTSPOT-927 | P1: Domain types | Tasks | Done |
| HOTSPOT-928 | P1: Reject version 2.0/1.0 | Tasks | Done |
| HOTSPOT-929 | P1: Reject cyclomaticComplexity | Tasks | Done |
| HOTSPOT-930 | P1: Reject functions key | Tasks | Done |
| HOTSPOT-931 | P1: Remove granularity CLI/config | Tasks | Done |
| HOTSPOT-932 | P1: runScan no function mode | Tasks | Done |
| HOTSPOT-933 | P1: compare no functions | Tasks | Done |
| HOTSPOT-934 | P1: CSV omit functions files | Tasks | Done |
| HOTSPOT-935 | P1: `--only` without functions | Tasks | Done |
| HOTSPOT-936 | P1: explain file-only | Tasks | Done |
| HOTSPOT-937 | P1: Delete function-churn + function scorers | Tasks | Done |
| HOTSPOT-938 | P1: Report columns NLOC | Tasks | Done |
| HOTSPOT-939 | P1: Glossary/triage/summary copy | Tasks | Done |
| HOTSPOT-940 | P1: Progress phases file-only | Tasks | Done |
| HOTSPOT-941 | P1: Living docs | Tasks | Done |
| HOTSPOT-942 | P1: Skills/rules/INTEGRATIONS | Tasks | Done |
| HOTSPOT-943 | P1: ADR-2026-019 supersession | Tasks | Done |

**Coverage:** 24 total, mapped in tasks.md. IDs after 943 available for Execute gaps (do not reuse 913–919).

---

## Success Criteria

- [x] Hotspots ranked with NCLOC + churn via unchanged harmonic formula
- [x] Schemas/types are `"3.0"` with `ncloc`; no McCabe fields; no `functions` array
- [x] Function mode absent from CLI, pipeline, CSV, compare, explain
- [x] Old baselines fail closed with re-scan guidance
- [x] Docs/skills/ADR match NCLOC product vision
- [x] `pnpm build && pnpm test` passes
