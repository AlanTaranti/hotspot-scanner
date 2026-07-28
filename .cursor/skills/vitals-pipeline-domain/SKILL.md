---
name: vitals-pipeline-domain
description: Pipeline domain context for hotspot-scanner — Git Miner, NCLOC, scoring, scan-result, config, report, trend, assess, diagnostics, doctor, paths, types, scan-preview, package-meta, schemas, bin. Use when implementing or reviewing src/**, schemas/, or bin/ wiring. Do NOT use for planning specs (vitals-spec-driven / planner-feature) or Execute orchestration (vitals-execute / orchestrator-implementer).
---

# Hotspot Scanner Pipeline Domain

Concise domain pointers for `@taranti/hotspot-scanner`. **Do not treat this skill as a Design SoT.**

| Topic | SoT |
| ----- | --- |
| Modules / pipelines / contracts | [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md) |
| Path \| Role layout | [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md) |
| Formulas / fragile risks | [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) |
| Fragile coding guardrails | [fragile-areas.mdc](../../rules/fragile-areas.mdc) |
| Adapters / mocks | [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md) |
| Flags / exit codes | [docs/cli-reference.md](../../../docs/cli-reference.md) |
| Task path ownership | [implementer-routing.md](../vitals-common/references/implementer-routing.md) |

## Pipeline stages

```
git log (stream) → NCLOC size analysis → hotspot scoring → report
```

Also: `trend` (`src/trend/`), `assess` (`src/assess/`), CLI wiring in `bin/`. Full module prefixes: STRUCTURE.md + implementer-routing.

## Module prefixes → routing

Path ownership for `tasks.md` assignment lives only in [implementer-routing.md](../vitals-common/references/implementer-routing.md). Covered prefixes: `src/git/`, `src/complexity/`, `src/trend/`, `src/assess/`, `src/scoring/`, `src/diagnostics/`, `src/doctor/`, `src/scan-result/`, `src/report/`, `src/config/`, `src/paths/`, `src/scan.ts`, `src/scan-preview.ts`, `src/package-meta.ts`, `src/types/`, `bin/`, `schemas/`, `tests/fixtures/`.

## Domain reminders (pointers only)

- **hotspotScore / NCLOC (RT-005)** — CONCERNS.md (do not restate formulas here)
- **JSON scan contract** — `schemas/scan-result.json` + ARCHITECTURE.md; `parseScanResult` rejects legacy fields
- **Superseded** — compare/baseline CLI and coupling analysis are gone; do not reintroduce without a new feature spec

## Related skills

- CLI/fixture checks: [vitals-cli-validation](../vitals-cli-validation/SKILL.md)
- Project overlay: [vitals-common](../vitals-common/SKILL.md)
- Index: [AGENTS.md](../../../AGENTS.md)
