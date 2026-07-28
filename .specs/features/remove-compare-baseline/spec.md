# Milestone 71 — Remove Compare & Baseline Specification

**Feature slug:** `remove-compare-baseline`  
**Milestone:** ROADMAP M71  
**Depth:** Complex  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**Precedent:** [remove-coupling-analysis](../remove-coupling-analysis/) (M56)  
**Sisters / inverse:** [scan-compare](../scan-compare/spec.md) (M13), [workflow-subcommands](../workflow-subcommands/spec.md) (M40), [compare-interpretation](../compare-interpretation/spec.md) (M53), [csv-bundle](../csv-bundle/spec.md) (M18), [json-contract](../json-contract/spec.md) (M20), [contract-enrich-additive](../contract-enrich-additive/spec.md) (M66), [cli-surface-parity](../cli-surface-parity/spec.md) (M63), [warnings-bookend-dx](../warnings-bookend-dx/spec.md) (M68)

Historical Done specs for compare/baseline (M13/M40/M53, etc.) are **not reopened** — this milestone **supersedes** their product behavior.

## Problem Statement

Compare and baseline workflows (`compare`, `baseline save`, `scan --baseline`, `--strict`, compare reporters, compare JSON schema, and public compare APIs) add a large dual-path surface while the product direction is a **scan-only** pipeline: git churn + NCLOC → hotspot ranking → report. Keeping stubs or a deprecation window would leave dead contract, CLI, docs, and agent guidance. A hard cut aligns CLI, package API, schemas, reporters, and living docs in one breaking change.

## Goals

- [ ] CLI has no `compare` / `baseline` entry points and no `scan --baseline` / `--strict`
- [ ] Package API exports `parseScanResult` + `ScanResultParseError` only from the former compare surface; no `compareScanResults` / `loadBaseline` / `Compare*`
- [ ] `schemas/compare-result.json` deleted; scan schema stays `version: "3.0"`
- [ ] Reporters and scan path never call compare; `COMPARE_SINCE_MISMATCH` gone
- [ ] Living docs, skills, completions, and AGENTS describe scan-only workflows
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                               | Reason                          |
| ----------------------------------------------------- | ------------------------------- |
| npm publish / npx                                     | Deferred                        |
| CI recipes / SARIF                                    | Deferred                        |
| Fail-on-warning                                       | Deferred                        |
| Item C (scan body full warnings)                      | Deferred                        |
| Score formula / NCLOC changes                         | Unrelated                       |
| Soft deprecation / legacy flags / empty compare stubs | Hard cut locked                 |
| Reopening historical Done compare specs               | Stay historical; M71 supersedes |

---

## User Stories

### P1: CLI has no compare/baseline entry points ⭐ MVP

**User Story**: As a CLI user, I want only scan-oriented commands so that help, completions, and argv parsing match a scan-only product.

**Why P1**: Compare/baseline are the primary user-facing dual path; removing them is the product outcome.

**Acceptance Criteria**:

1. WHEN the CLI is invoked with subcommand `compare` or `baseline` (including `baseline save`) THEN commander SHALL treat it as an unknown command and exit `2`
2. WHEN `scan` is invoked with `--baseline` or `--strict` THEN commander SHALL treat it as an unknown option and exit `2`
3. WHEN shell completion scripts list commands/flags THEN they SHALL omit `compare`, `baseline`, `--baseline`, and `--strict`
4. WHEN `bin/scan-actions.ts` / `bin/hotspot-scanner.ts` are inspected THEN compare-only helpers (`writeCompareExplainBlock`, `enforceStrictCompare`, `executeCompareAndRender`, `writeBaselineJson`) SHALL be absent
5. WHEN scan uses `--explain` / `--fail-on-explain-miss` / formats / `--output` THEN behavior SHALL remain available (scan-mode only)

**Independent Test**: Negative CLI unit/integration tests for unknown command/option → exit `2`; completion string asserts; help text omits compare/baseline.

**Requirements**: HOTSPOT-1300, HOTSPOT-1301, HOTSPOT-1302, HOTSPOT-1315

---

### P1: Package API keeps parse-only contract helper ⭐ MVP

**User Story**: As a programmatic consumer, I want `parseScanResult` (and `ScanResultParseError`) without compare/baseline APIs so that I can validate scan JSON without a removed feature surface.

**Why P1**: Locked public-API decision — keep parse, drop compare/loadBaseline/Compare*.

**Acceptance Criteria**:

1. WHEN `src/index.ts` exports are inspected THEN they SHALL include `parseScanResult` and `ScanResultParseError` and SHALL NOT export `compareScanResults`, `loadBaseline`, `BaselineError`, or `Compare*` types
2. WHEN `parseScanResult` lives in the tree THEN it SHALL reside under **`src/scan-result/`** (not under `src/compare/`)
3. WHEN invalid scan JSON is parsed THEN the error class SHALL be named `ScanResultParseError` (no `BaselineError` alias)
4. WHEN package `imports` / aliases are inspected THEN `#compare` SHALL be absent
5. WHEN valid `version: "3.0"` scan JSON is parsed THEN `parseScanResult` SHALL succeed (same scan contract as today)

**Independent Test**: Unit tests co-located under `src/scan-result/`; public export grep; `#compare` absent from `package.json`.

**Requirements**: HOTSPOT-1303, HOTSPOT-1304, HOTSPOT-1305, HOTSPOT-1311

---

### P1: Compare schema gone; scan stays 3.0 ⭐ MVP

**User Story**: As a downstream integrator, I want only the scan JSON schema published at `"3.0"` so that my contracts match the reduced product.

**Why P1**: Contract SoT must not advertise a deleted compare result.

**Acceptance Criteria**:

1. WHEN `schemas/` is listed THEN `compare-result.json` SHALL be absent
2. WHEN `package.json` `"exports"` are inspected THEN `./schemas/compare-result.json` SHALL be absent; scan schema export SHALL remain
3. WHEN `schemas/scan-result.json` is read THEN `version` SHALL still be `"3.0"` with unchanged scan shape (no compare-driven migration)
4. WHEN contract tests run THEN they SHALL validate scan (and config) schemas only — no compare-result cases

**Independent Test**: Glob for `schemas/compare-result.json` → empty; `tests/contract/json-schema.test.ts` updated; Ajv validates scan `"3.0"`.

**Requirements**: HOTSPOT-1306, HOTSPOT-1307

---

### P1: Reporters and domain never call compare ⭐ MVP

**User Story**: As a maintainer, I want compare domain/report modules and types deleted so that scan reporters never import or emit compare deltas, and `COMPARE_SINCE_MISMATCH` cannot appear.

**Why P1**: Dead compare code would keep coverage thresholds and docs noise.

**Acceptance Criteria**:

1. WHEN `src/compare/` is searched THEN the directory SHALL be absent (after `parseScanResult` relocation)
2. WHEN report modules are listed THEN `compare-*.ts`, `explain-compare.ts`, and `slice-compare.ts` (and tests) SHALL be absent; shared scan helpers (`path-column`, etc.) SHALL remain
3. WHEN `src/types/domain.ts` is read THEN `CompareResult`, `CompareMeta`, `HotspotCompareSection`, and `RankChange` SHALL be absent
4. WHEN warning emitters / codes are searched THEN `COMPARE_SINCE_MISMATCH` SHALL be absent from runtime and living warning-code docs
5. WHEN scan report index / glossary / summary paths are read THEN they SHALL have no compare-only branches

**Independent Test**: Glob deleted paths → empty; report unit suite green without compare fixtures; warning-code doc row gone.

**Requirements**: HOTSPOT-1308, HOTSPOT-1309, HOTSPOT-1310

---

### P1: Living docs and agent surfaces are scan-only ⭐ MVP

**User Story**: As a reader of project docs and agent skills, I want the product described as scan-only, with M71 supersession noted and historical Done sister specs left untouched.

**Why P1**: Docs/skills drift is a known CONCERNS risk after hard cuts (M56 precedent).

**Acceptance Criteria**:

1. WHEN README, recipes, warning-codes, AGENTS exit-code table, ARCHITECTURE, STRUCTURE, TESTING, CONCERNS, PROJECT, fragile-area hooks, and vitals-* skills are read THEN they SHALL NOT claim compare/baseline/`--strict`/`COMPARE_SINCE_MISMATCH` as product capabilities
2. WHEN AGENTS exit codes are read THEN exit `1` SHALL document only `--fail-on-explain-miss` (not `--strict` compare)
3. WHEN historical feature specs under sisters are opened THEN they SHALL remain Status Done without content rewrite (supersession via ROADMAP/STATE/M71 only)
4. WHEN completions/help examples are read THEN they SHALL describe scan-only workflows

**Independent Test**: Doc/skill `rg` sanity excluding `.specs/features/**` historical; AGENTS table review.

**Requirements**: HOTSPOT-1312, HOTSPOT-1313, HOTSPOT-1314

---

## Edge Cases

- WHEN user runs `hotspot-scanner compare …` or `hotspot-scanner baseline save …` THEN exit `2` (unknown command)
- WHEN user runs `hotspot-scanner scan --baseline x.json` or `scan --strict` THEN exit `2` (unknown option)
- WHEN user passes `--explain` without compare THEN scan-mode explain SHALL still work
- WHEN user passes `--fail-on-explain-miss` with missing explain target THEN exit `1` (unchanged)
- WHEN invalid JSON is fed to `parseScanResult` THEN `ScanResultParseError` SHALL be thrown with scan-oriented re-scan hint (no `baseline save` wording)
- WHEN leftover `hotspot-baseline.json` files exist on disk THEN the product SHALL ignore them (no loader); users may delete manually — out of product scope
- WHEN scripts expected compare CSV/JSON THEN they break intentionally — document breaking change in README/recipes

---

## Requirement Traceability

| Requirement ID | Story                                      | Phase | Status  |
| -------------- | ------------------------------------------ | ----- | ------- |
| HOTSPOT-1300   | P1: CLI — delete subcommands               | Tasks | Pending |
| HOTSPOT-1301   | P1: CLI — delete `--baseline` / `--strict` | Tasks | Pending |
| HOTSPOT-1302   | P1: CLI — unknown → exit 2                 | Tasks | Pending |
| HOTSPOT-1303   | P1: Relocate `parseScanResult`             | Tasks | Pending |
| HOTSPOT-1304   | P1: Rename `ScanResultParseError`          | Tasks | Pending |
| HOTSPOT-1305   | P1: Public API trim                        | Tasks | Pending |
| HOTSPOT-1306   | P1: Delete compare schema                  | Tasks | Pending |
| HOTSPOT-1307   | P1: Scan schema stays 3.0 + contract tests | Tasks | Pending |
| HOTSPOT-1308   | P1: Delete compare domain + report modules | Tasks | Pending |
| HOTSPOT-1309   | P1: Remove Compare* types                  | Tasks | Pending |
| HOTSPOT-1310   | P1: Remove `COMPARE_SINCE_MISMATCH`        | Tasks | Pending |
| HOTSPOT-1311   | P1: Drop `#compare` alias                  | Tasks | Pending |
| HOTSPOT-1312   | P1: Purge fixtures + negative CLI tests    | Tasks | Pending |
| HOTSPOT-1313   | P1: Living docs / skills / AGENTS          | Tasks | Pending |
| HOTSPOT-1314   | P1: Supersession; sisters stay Done        | Tasks | Pending |
| HOTSPOT-1315   | P1: Keep scan `--explain` / formats        | Tasks | Pending |

**Coverage:** 16 total, mapped in tasks.md. IDs 1316–1329 reserved for Execute gaps.

---

## Success Criteria

- [ ] No CLI or package path performs compare or baseline save/load
- [ ] `parseScanResult` + `ScanResultParseError` live under `src/scan-result/` and remain public
- [ ] Compare schema/types/modules/fixtures/warning code gone; scan stays `"3.0"`
- [ ] Living docs/skills/completions/AGENTS are scan-only; sisters not rewritten
- [ ] `pnpm build && pnpm test` passes
