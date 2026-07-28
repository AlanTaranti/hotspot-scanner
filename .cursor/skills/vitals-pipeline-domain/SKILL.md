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

## Pipeline stages

```
git log (stream) → NCLOC size analysis → hotspot scoring → report
```

Also: `trend` (`src/trend/`), `assess` (`src/assess/`), CLI wiring in `bin/`. Module paths: STRUCTURE.md + implementer-routing.

## Domain reminders (pointers only)

- **hotspotScore / NCLOC (RT-005)** — CONCERNS.md (do not restate formulas here)
- **JSON scan contract** — `schemas/scan-result.json` + ARCHITECTURE.md; `parseScanResult` rejects legacy fields
- **Superseded** — compare/baseline CLI and coupling analysis are gone; do not reintroduce without a new feature spec

## Related skills

- CLI/fixture checks: [vitals-cli-validation](../vitals-cli-validation/SKILL.md)
- Project overlay: [vitals-common](../vitals-common/SKILL.md)
- Index: [AGENTS.md](../../../AGENTS.md)
