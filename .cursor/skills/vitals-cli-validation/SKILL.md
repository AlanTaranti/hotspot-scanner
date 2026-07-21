---
name: vitals-cli-validation
description: CLI validation workflow for hotspot-scanner — exit codes, flags, fixture runs, JSON output. Use when validating bin/, scan wiring, or tests/fixtures/. Triggers on "validate CLI", "test fixture", "exit code", "hotspot-scanner scan", "snapshot JSON". Do NOT use for unit test authoring alone (testing-patterns rule) or spec acceptance (verifier-implementation).
---

# Hotspot Scanner CLI Validation

Automated validation for `@vitals/hotspot-scanner` CLI. No interactive UI UAT.

**Project path convention:** fixtures live in `tests/fixtures/` (repos, git-log samples, complexity files).

## Base command

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo>
```

With flags (per IMPL §6.1):

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --since "12 months ago" --format json --top 20
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --min-cochange 3
```

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | Scan completed successfully |
| `!= 0` | Invalid repo/path, git error, or invalid CLI arguments |

See [AGENTS.md](../../../AGENTS.md) § Validation.

## Flag matrix (IMPL §6.1)

| Flag | Purpose | Default |
| ---- | ------- | ------- |
| `scan <path>` | Repository to analyze | required |
| `--since <period>` | Git history window | ~12 months (proposed) |
| `--format json` | JSON instead of CLI table | table |
| `--top <N>` | Limit ranking items | TBD |
| `--min-cochange <N>` | Min co-changes for coupling pairs | TBD |

Test relevant flags when the feature scope touches CLI.

## When to validate

- `bin/hotspot-scanner.ts` — new flags, exit codes, output format
- `src/scan.ts` — end-to-end wiring changes
- New or updated fixtures in `tests/fixtures/`

## Fixture validation checklist

1. Path exists (`tests/fixtures/repos/<slug>/`)
2. Is a valid git repository (for integration scans)
3. `pnpm exec hotspot-scanner scan <path>` exits `0` on success
4. JSON output matches schema when `--format json`
5. Output shows `--since` window used (IMPL §6.2)

## JSON output checks

- Top-level `version` field present
- `hotspots` array sorted by score descending
- `coupling` array sorted by strength descending
- Required fields per IMPL §5.1

## Related agents

| Agent | When |
| ----- | ---- |
| `fixture-builder` | Create/update fixture repos and samples |
| `verifier-implementation` | Spec acceptance after CLI changes |
| `verifier-quality-gates` | `pnpm build && pnpm test` |

## References

- Design SoT: [specifications/IMPL-2026-003-hotspot-scanner.md](../../../specifications/IMPL-2026-003-hotspot-scanner.md) §6, §9
- Skill: [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
- Rule: [testing-patterns.mdc](../../rules/testing-patterns.mdc)
