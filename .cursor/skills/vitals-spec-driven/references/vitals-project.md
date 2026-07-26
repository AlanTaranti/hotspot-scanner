# @vitals/hotspot-scanner — Project Context

**Canonical project detail** for agents and skills. Index and policies: [AGENTS.md](../../../../AGENTS.md).

---

## Identity

- **Package:** `@vitals/hotspot-scanner` (npm)
- **CLI bin:** `hotspot-scanner` (unscoped)
- **Purpose:** Local CLI that ranks TS/JS maintenance hotspots from NCLOC and Git churn (file-level)
- **Pipeline:** `git → NCLOC size analysis → hotspot scoring → report` (+ optional `--baseline` compare)
- **Design SoT:** [`.specs/codebase/ARCHITECTURE.md`](../../../../.specs/codebase/ARCHITECTURE.md)
- **Module map SoT:** [`.specs/codebase/STRUCTURE.md`](../../../../.specs/codebase/STRUCTURE.md)

## Module map

| Path                     | Status      | Role                                                                                                                                                    |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bin/hotspot-scanner.ts` | implemented | Commander CLI — `scan <path>` with `--since`, `--format`, `--top`, `--include`/`--exclude`, `--output`, `--baseline` |
| `src/git/`               | implemented | GitMiner — streaming `git log` numstat for file churn                                                                                                   |
| `src/complexity/`        | implemented | Size analyzer — NCLOC (`ncloc.ts`, pool/worker optional)                                                                                                  |
| `src/scoring/`           | implemented | HotspotScorer (file hotspots)                                                                                                                           |
| `src/diagnostics/`       | implemented | stderr warnings + progress                                                                                                                              |
| `src/report/`            | implemented | Reporter — table, JSON, markdown, CSV bundle (+ compare variants)                                                                                       |
| `src/compare/`           | implemented | `loadBaseline`, `compareScanResults` (hotspots only)                                                                                                    |
| `src/config/`            | implemented | `.hotspot-scanner.json` load + `mergeScanOptions` (CLI > config > defaults)                                                                             |
| `src/scan.ts`            | implemented | `runScan()` — config + file-only pipeline orchestration                                                                                                 |
| `src/types/`             | implemented | Domain types (no runtime logic)                                                                                                                         |
| `src/index.ts`           | implemented | Public library API                                                                                                                                      |
| `schemas/`               | implemented | JSON Schema for `ScanResult` / `CompareResult` (`version: "3.0"`)                                                                                       |

## Gate check

**Full gate (required before finishing any implementation):** see [AGENTS.md](../../../../AGENTS.md) § Quality gate and [TESTING.md](../../../../.specs/codebase/TESTING.md).

```bash
pnpm build && pnpm test
```

## Domain concepts

- **FileChangeStats** — per-file churn: `commitCount`, `linesChanged`, `authors`, `lastModified`
- **ComplexityResult** — file-level `ncloc` (working tree)
- **hotspotScore** — formula SoT: [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)
- **CompareResult** — delta vs `--baseline` JSON (`new` / `removed` / `rankChanged`) for hotspots only
- **Config** — `.hotspot-scanner.json` only; CLI-only: `format`, `output`, `baseline`

## Requirement IDs / Commit / YAGNI

See [AGENTS.md](../../../../AGENTS.md) — `HOTSPOT-*`, commit only when asked, YAGNI.

## Validation (CLI)

No interactive UI UAT. Canonical fixture path: `tests/fixtures/repos/<slug>`.

1. `pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>`
2. Exit codes: `0` success, `!= 0` invalid repo/git/args
3. Exercise `--since`, `--format`, `--baseline`, `--output` when relevant
4. Co-located `*.test.ts` for unit coverage

## Fragile areas

See [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md) and [fragile-areas.mdc](../../../../.cursor/rules/fragile-areas.mdc) — git streaming, NCLOC definition, scoring, compare/baseline, JSON schemas.

## Knowledge sources

1. `.specs/codebase/` (Design SoT) + [STATE.md](../../../../.specs/project/STATE.md) + [ROADMAP.md](../../../../.specs/project/ROADMAP.md)
2. `vitals-pipeline-domain` skill for scan pipeline context
3. `vitals-cli-validation` for CLI/fixture checks
