# Milestone 56 — Remove Coupling Analysis Specification

**Feature slug:** `remove-coupling-analysis`  
**Milestone:** ROADMAP M56  
**Depth:** Complex  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**Sisters / inverse:** [enriched-coupling](../enriched-coupling/spec.md), [coupling-enrichment](../coupling-enrichment/spec.md), [coupling-stream-aggregate](../coupling-stream-aggregate/spec.md), [static-enrich-cache](../static-enrich-cache/spec.md), [coupling-package-exports](../coupling-package-exports/spec.md), [csv-bundle](../csv-bundle/spec.md), [json-contract](../json-contract/spec.md), [scan-compare](../scan-compare/spec.md), [output-interpretation-ux](../output-interpretation-ux/spec.md)

Historical Done specs for coupling (M4/M14/M27/M32/M33/M44, etc.) are **not reopened** — this milestone **supersedes** their product behavior.

## Problem Statement

Temporal coupling (co-change pairs, coupling strength, static enrich) adds substantial surface area — git pair aggregation, mega-commit guards, enrich modules, CLI/config knobs, JSON/CSV sections, and interpretation copy — while the product direction is to rank maintenance hotspots from **cyclomatic complexity + Git churn only**. Keeping empty arrays or a deprecation flag would leave dead contract and docs noise. A hard cut aligns JSON, CLI, pipeline, and docs in one breaking change.

## Goals

- [ ] JSON contract `version: "2.0"` with **no** top-level `coupling` on scan or compare results
- [ ] Pipeline, CLI, config, and reporters never score, enrich, emit, or filter on coupling
- [ ] Git miner no longer aggregates pairs or emits mega-commit coupling skips
- [ ] Coupling-only modules, fixtures, and tests deleted
- [ ] Living docs / skills / vision describe hotspots as complexity + churn only
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| McCabe decision-node changes | Unrelated |
| Harmonic hotspot score formula | Unrelated |
| Function churn / hunk overlap | Unrelated |
| npm publish / npx | Deferred |
| CI recipes / SARIF | Deferred |
| Soft deprecation / legacy flag / empty `coupling: []` | Hard cut locked |
| Reopening historical Done coupling specs | Stay historical; M56 supersedes |

---

## User Stories

### P1: JSON contract 2.0 without coupling ⭐ MVP

**User Story**: As a downstream integrator, I want scan/compare JSON at version `"2.0"` without a `coupling` array so that my schemas and parsers match the reduced product.

**Acceptance Criteria**:

1. WHEN a successful scan emits JSON THEN `version` SHALL be `"2.0"` and the payload SHALL NOT include a top-level `coupling` property
2. WHEN compare JSON is emitted THEN `version` SHALL be `"2.0"` and the payload SHALL NOT include a top-level `coupling` property
3. WHEN `schemas/scan-result.json` and `schemas/compare-result.json` are published THEN they SHALL require `"2.0"`, SHALL NOT require `coupling`, and SHALL NOT define coupling item schemas as part of the required contract
4. WHEN domain types describe `ScanResult` / `CompareResult` THEN they SHALL omit `coupling` and coupling-only option fields (`minCochange`, `megaCommitThreshold` on scan options as applicable)

**Independent Test**: Contract tests Ajv-validate CLI/`runScan` JSON against updated schemas; grep schemas for `"coupling"` as required key → absent.

**Requirements**: HOTSPOT-890, HOTSPOT-891, HOTSPOT-892, HOTSPOT-893, HOTSPOT-896

---

### P1: Reject legacy baselines ⭐ MVP

**User Story**: As a CLI user with an old baseline, I want a clear `BaselineError` telling me to re-scan so that compare does not silently ignore or invent coupling deltas.

**Acceptance Criteria**:

1. WHEN baseline `version` is `"1.0"` THEN `loadBaseline` / `parseScanResult` SHALL throw `BaselineError` naming unsupported version and include a re-scan hint
2. WHEN baseline JSON contains a top-level `coupling` property THEN validation SHALL reject with `BaselineError` + re-scan hint (even if `version` is spoofed as `"2.0"`)
3. WHEN baseline is valid `"2.0"` without `coupling` THEN load SHALL succeed

**Independent Test**: Unit tests in `load-baseline.test.ts` with 1.0 fixture, spoofed 2.0+coupling, and valid 2.0.

**Requirements**: HOTSPOT-894, HOTSPOT-895

---

### P1: Pipeline and reporters omit coupling ⭐ MVP

**User Story**: As a user running `scan` / `compare`, I want outputs (table, markdown, JSON, CSV, summary/glossary/triage) that never mention or rank coupling pairs so that the product matches complexity+churn ranking only.

**Acceptance Criteria**:

1. WHEN `runScan` completes THEN it SHALL NOT call temporal coupling scoring or static enrich
2. WHEN `compareScanResults` runs THEN it SHALL NOT produce coupling new/removed/rankChanged sections
3. WHEN table/markdown/JSON reporters render THEN they SHALL omit coupling sections, columns, glossary/triage rules, and slice keys for coupling
4. WHEN `--format csv` writes a bundle THEN it SHALL omit `{stem}.coupling.csv` and compare `coupling.*.csv` files (not header-only)
5. WHEN `--only` is used THEN allowed values SHALL be `hotspots` and `functions` only; `coupling` SHALL be invalid

**Independent Test**: Unit/integration asserts on `small-ts` scan/compare; CSV key lists; `--only coupling` exits non-zero.

**Requirements**: HOTSPOT-897, HOTSPOT-898, HOTSPOT-899, HOTSPOT-900, HOTSPOT-901

---

### P1: CLI and config surface cleanup ⭐ MVP

**User Story**: As a CLI user, I want coupling-related flags and config keys gone so that help/completion/exemplar match the product.

**Acceptance Criteria**:

1. WHEN CLI help/parse runs THEN `--min-cochange` and `--mega-commit-threshold` SHALL NOT exist
2. WHEN config loader/exemplar run THEN `minCochange` and `megaCommitThreshold` SHALL NOT be recognized as supported scan keys (unknown-key warn path may still apply if pasted — prefer remove from exemplar and documented keys)
3. WHEN shell completion scripts list scan flags/values THEN they SHALL omit removed flags and `--only coupling`
4. WHEN public library exports are inspected THEN coupling scorers/types SHALL NOT be exported from `src/index.ts`

**Independent Test**: CLI unit tests; config exemplar snapshot; completion string asserts; `src/index.ts` export grep.

**Requirements**: HOTSPOT-902, HOTSPOT-903, HOTSPOT-907, HOTSPOT-912

---

### P1: Git miner without pair aggregation ⭐ MVP

**User Story**: As a maintainer, I want the git miner to aggregate only file churn so that mega-commit coupling skips and pairCounts disappear from the codebase.

**Acceptance Criteria**:

1. WHEN the numstat stream aggregates THEN it SHALL NOT maintain `pairCounts`
2. WHEN mine completes THEN `canonicalizePairCounts` SHALL NOT exist / be called
3. WHEN a commit has many unique in-scope files THEN the miner SHALL NOT skip coupling (feature gone) and SHALL NOT emit `MEGA_COMMIT_SKIPPED`
4. WHEN path filters apply to git results THEN they SHALL NOT filter `pairCounts`

**Independent Test**: Git aggregate/canonicalize/mega-commit unit tests updated or deleted; no `MEGA_COMMIT_SKIPPED` in warning-codes docs after docs task.

**Requirements**: HOTSPOT-904, HOTSPOT-911

---

### P1: Delete coupling-only modules and fixtures ⭐ MVP

**User Story**: As a maintainer, I want coupling-only source, tests, and fixtures removed so that coverage and discovery do not keep dead code green.

**Acceptance Criteria**:

1. WHEN the tree is searched THEN `coupling-scorer`, `enrich-coupling-static`, `tsconfig-path-map`, `package-exports-map`, and dedicated coupling report format modules SHALL be absent
2. WHEN fixtures are listed THEN `tests/fixtures/repos/alias-coupling/`, `package-exports-coupling/`, and `tests/fixtures/scoring/coupling-pairs.json` SHALL be removed (or emptied and unreferenced)
3. WHEN sample report JSON fixtures still exist THEN they SHALL match 2.0 without `coupling`

**Independent Test**: Glob for deleted paths → empty; gate still green.

**Requirements**: HOTSPOT-905, HOTSPOT-906

---

### P1: Living documentation and vision ⭐ MVP

**User Story**: As a reader of project docs and agent skills, I want the product described as complexity + churn hotspots only, with M56 supersession noted and ADR-2026-020 revisited.

**Acceptance Criteria**:

1. WHEN README, PROJECT, AGENTS, ARCHITECTURE, CONCERNS, STRUCTURE, TESTING, INTEGRATIONS, CONTRIBUTING, recipes, warning-codes are read THEN they SHALL NOT claim temporal coupling as a product capability
2. WHEN `vitals-pipeline-domain` skill and `fragile-areas` rule are read THEN coupling enrich / pairCounts / mega-commit coupling rows SHALL be removed or marked superseded
3. WHEN `package.json` keywords are read THEN `temporal-coupling` SHALL be absent
4. WHEN STATE ADR-2026-020 is revisited THEN it SHALL state the single stream feeds churn only
5. WHEN historical feature specs under sisters are opened THEN they SHALL remain Status Done without content rewrite (optional one-line supersession pointer from M56 only)

**Independent Test**: Doc/skill grep for stale “temporal coupling” product claims; keyword grep.

**Requirements**: HOTSPOT-908, HOTSPOT-909, HOTSPOT-910

---

## Edge Cases

- WHEN user passes `--min-cochange` or `--mega-commit-threshold` THEN commander SHALL fail as unknown option (exit ≠ 0)
- WHEN user passes `--only coupling` THEN system SHALL error with allowed values `hotspots, functions`
- WHEN config file still contains `minCochange` / `megaCommitThreshold` THEN behavior SHALL follow post-M55 unknown-key warn-only **or** explicit reject — **prefer**: treat as unknown keys (warn-only `UNKNOWN_CONFIG_KEY`) without applying values (no silent accept into ScanOptions)
- WHEN baseline mixes `"2.0"` with leftover `coupling` THEN reject (HOTSPOT-895)
- WHEN compare CSV consumers expect six data files THEN scripts break intentionally — document breaking change in README/recipes
- WHEN `--only functions` or `--only hotspots` THEN behavior unchanged aside from absence of coupling sidecars

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-890 | P1: JSON 2.0 scan | Tasks | Pending |
| HOTSPOT-891 | P1: JSON 2.0 compare | Tasks | Pending |
| HOTSPOT-892 | P1: Schemas | Tasks | Pending |
| HOTSPOT-893 | P1: Domain types | Tasks | Pending |
| HOTSPOT-894 | P1: Reject version 1.0 | Tasks | Pending |
| HOTSPOT-895 | P1: Reject coupling key | Tasks | Pending |
| HOTSPOT-896 | P1: Contract tests | Tasks | Pending |
| HOTSPOT-897 | P1: runScan no coupling | Tasks | Pending |
| HOTSPOT-898 | P1: compare no coupling | Tasks | Pending |
| HOTSPOT-899 | P1: Reporters omit | Tasks | Pending |
| HOTSPOT-900 | P1: CSV omit coupling files | Tasks | Pending |
| HOTSPOT-901 | P1: `--only` without coupling | Tasks | Pending |
| HOTSPOT-902 | P1: Remove CLI flags | Tasks | Pending |
| HOTSPOT-903 | P1: Remove config keys | Tasks | Pending |
| HOTSPOT-904 | P1: Git miner cleanup | Tasks | Pending |
| HOTSPOT-905 | P1: Delete modules | Tasks | Pending |
| HOTSPOT-906 | P1: Delete fixtures | Tasks | Pending |
| HOTSPOT-907 | P1: Public exports | Tasks | Pending |
| HOTSPOT-908 | P1: Living docs | Tasks | Pending |
| HOTSPOT-909 | P1: Skills/rules/keywords | Tasks | Pending |
| HOTSPOT-910 | P1: Supersession + ADR revisit | Tasks | Pending |
| HOTSPOT-911 | P1: filter-git pairCounts | Tasks | Pending |
| HOTSPOT-912 | P1: Completion scripts | Tasks | Pending |

**Coverage:** 23 total, mapped in tasks.md. IDs 913–919 reserved for Execute gaps.

---

## Success Criteria

- [ ] No product path emits or scores temporal coupling
- [ ] Schemas and types are `"2.0"` without `coupling`
- [ ] Old baselines fail closed with re-scan guidance
- [ ] Coupling-only code/fixtures gone; docs/skills match vision
- [ ] `pnpm build && pnpm test` passes
