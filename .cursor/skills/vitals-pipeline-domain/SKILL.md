---
name: vitals-pipeline-domain
description: Pipeline domain context for hotspot-scanner — Git Miner, NCLOC, scoring, scan-result, config, report, trend, assess. Use when implementing or reviewing src/git/, src/complexity/, src/scoring/, src/scan-result/, src/config/, src/report/, src/trend/, src/assess/, src/scan.ts, schemas/, or bin/ wiring. Do NOT use for planning specs (vitals-spec-driven / planner-feature) or Execute orchestration (vitals-execute / orchestrator-implementer).
---

# Hotspot Scanner Pipeline Domain

Concise domain pointers for `@vitals/hotspot-scanner`. **Do not treat this skill as a Design SoT.**

| Topic | SoT |
| ----- | --- |
| Modules / pipelines / contracts | [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md) |
| Path \| Role layout | [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md) |
| Formulas / fragile risks | [CONCERNS.md](../../../.specs/codebase/CONCERNS.md) |
| Adapters / mocks | [INTEGRATIONS.md](../../../.specs/codebase/INTEGRATIONS.md) |
| Flags / exit codes | [docs/cli-reference.md](../../../docs/cli-reference.md) |
| Task path ownership | [implementer-routing.md](../vitals-common/references/implementer-routing.md) |

## Pipeline stages (paths only)

```
git log (stream) → NCLOC size analysis → hotspot scoring → report
```

Also: `trend` (`src/trend/`), `assess` (`src/assess/`), CLI wiring in `bin/`.

| Stage | Module |
| ----- | ------ |
| Git | `src/git/` |
| Size / NCLOC | `src/complexity/` |
| Scoring | `src/scoring/` |
| Config | `src/config/` |
| Scan-result parse | `src/scan-result/` |
| Report | `src/report/` |
| Trend / Assess | `src/trend/`, `src/assess/` |
| Orchestration | `src/scan.ts` |
| CLI | `bin/` |
| Schemas | `schemas/` |

## Domain reminders

- **hotspotScore** — formula in CONCERNS.md (`2ch / (c + h)` with `c` from normalized NCLOC)
- **NCLOC (RT-005)** — state machine in `ncloc.ts`; not AST/McCabe
- **JSON scan contract** — `schemas/scan-result.json` (`version: "3.0"`); `parseScanResult` rejects legacy fields (`coupling`, `functions`, `cyclomaticComplexity`)
- **Superseded** — compare/baseline CLI and coupling analysis are gone; do not reintroduce without a new feature spec

## Related skills

- CLI/fixture checks: [vitals-cli-validation](../vitals-cli-validation/SKILL.md)
- Project overlay: [vitals-common](../vitals-common/SKILL.md)
- Index: [AGENTS.md](../../../AGENTS.md)
