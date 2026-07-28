# @vitals/hotspot-scanner — Project Context

**Canonical project detail** for agents and skills. Index: [AGENTS.md](../../../../AGENTS.md). Ownership: [DOC-OWNERSHIP.md](../../../../.specs/codebase/DOC-OWNERSHIP.md).

---

## Identity

- **Package:** `@vitals/hotspot-scanner` (npm)
- **CLI bin:** `hotspot-scanner` (unscoped)
- **Purpose:** Local CLI that ranks TS/JS maintenance hotspots from NCLOC and Git churn (file-level)
- **Pipeline:** `git → NCLOC size analysis → hotspot scoring → report` (scan-only; no compare/baseline CLI)
- **Design SoT:** [`.specs/codebase/ARCHITECTURE.md`](../../../../.specs/codebase/ARCHITECTURE.md)
- **Module map SoT:** [`.specs/codebase/STRUCTURE.md`](../../../../.specs/codebase/STRUCTURE.md)

## Module map

| Path                     | Status      | Role                                                                                                                                                    |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `init`, `config validate`, `config print`, `doctor`, `scan [path]`, `completion` |
| `src/git/`               | implemented | GitMiner — streaming `git log` numstat for file churn                                                                                                   |
| `src/complexity/`        | implemented | Size analyzer — NCLOC (`ncloc.ts`, pool/worker optional)                                                                                                  |
| `src/scoring/`           | implemented | HotspotScorer (file hotspots)                                                                                                                           |
| `src/diagnostics/`       | implemented | stderr warnings + progress                                                                                                                              |
| `src/report/`            | implemented | Reporter — table, JSON, markdown, CSV bundle                                                                                                            |
| `src/scan-result/`       | implemented | `parseScanResult`, `ScanResultParseError` — programmatic scan JSON validation                                                                           |
| `src/config/`            | implemented | `.hotspot-scanner.json` load + `mergeScanOptions` (CLI > config > defaults)                                                                             |
| `src/scan.ts`            | implemented | `runScan()` — config + file-only pipeline orchestration                                                                                                 |
| `src/types/`             | implemented | Domain types (no runtime logic)                                                                                                                         |
| `src/index.ts`           | implemented | Public library API                                                                                                                                      |
| `schemas/`               | implemented | JSON Schema for `ScanResult` + config (`version: "3.0"`)                                                                                                |

## Gate check

**Full gate:** [quality-gates.mdc](../../../../.cursor/rules/quality-gates.mdc) + [TESTING.md](../../../../.specs/codebase/TESTING.md) § Coverage.

```bash
pnpm build && pnpm test
```

## Domain concepts

- **FileChangeStats** — per-file churn: `commitCount`, `linesChanged`, `authors`, `lastModified`
- **ComplexityResult** — file-level `ncloc` (working tree)
- **hotspotScore** — formula SoT: [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)
- **parseScanResult** — validates `ScanResult` JSON for library consumers (`ScanResultParseError` on failure)
- **Config** — `.hotspot-scanner.json` only; CLI-only: `format`, `output`

## Requirement IDs / Commit / YAGNI

Pointers (do not restate): [feature-planning.mdc](../../../../.cursor/rules/feature-planning.mdc) (`HOTSPOT-*`), [commit-policy.mdc](../../../../.cursor/rules/commit-policy.mdc), [coding-guidelines](../../../../.cursor/skills/coding-guidelines/SKILL.md). Index: [AGENTS.md](../../../../AGENTS.md).

## Validation (CLI)

No interactive UI UAT. Canonical fixture path: `tests/fixtures/repos/<slug>`.

1. `pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>`
2. Exit codes SoT: [docs/cli-reference.md](../../../../docs/cli-reference.md#exit-codes)
3. Skill: `vitals-cli-validation`
4. Co-located `*.test.ts` for unit coverage

## Fragile areas

See [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) and [fragile-areas.mdc](../../../../.cursor/rules/fragile-areas.mdc).

## Knowledge sources

1. `.specs/codebase/` (Design SoT) + DOC-OWNERSHIP + STATE + ROADMAP
2. `vitals-pipeline-domain` skill for scan pipeline context
3. `vitals-cli-validation` for CLI/fixture checks
