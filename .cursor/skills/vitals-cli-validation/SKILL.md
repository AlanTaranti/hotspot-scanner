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

With flags:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --since "12 months ago" --format json --top 20  # --top ignored; full arrays
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format markdown --output /tmp/report.md
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format csv --output /tmp/report.csv
# CSV bundle files: /tmp/report.meta.json, /tmp/report.hotspots.csv
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format json --output /tmp/baseline.json
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --baseline /tmp/baseline.json --format json
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --baseline /tmp/baseline.json --format csv --output /tmp/compare.csv
# Compare CSV bundle: /tmp/compare.meta.json + hotspot delta CSVs under /tmp/compare.*
```

## Exit codes

| Code   | Meaning                                                |
| ------ | ------------------------------------------------------ |
| `0`    | Scan completed successfully                            |
| `!= 0` | Invalid repo/path, git error, or invalid CLI arguments |

See [AGENTS.md](../../../AGENTS.md) § Validation.

## Flag matrix

| Flag                   | Purpose                                                                               | Default               |
| ---------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `scan <path>`          | Repository to analyze                                                                 | required              |
| `--since <period>`     | Git history window                                                                    | ~12 months (proposed) |
| `--format json`        | JSON instead of CLI table                                                             | table                 |
| `--format markdown`    | GFM report for PRs                                                                    | table                 |
| `--format csv`         | Multi-file CSV bundle (requires `--output`); stem-derived paths + `meta.json` sidecar | table                 |
| `--output <path>`      | Write report to file (required for `--format csv`)                                    | stdout                |
| `--baseline <path>`    | Compare against saved baseline JSON                                                   | —                     |
| `--top <N>`            | Limit table/markdown rows (ignored for json/csv)                                      | `20`                  |

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
5. Output shows `--since` window used

## JSON output checks

- Top-level `version` field is `"3.0"`
- `hotspots` array sorted by score descending; each item includes `ncloc`
- No top-level `functions`, `coupling`, or `granularity` keys
- Required fields per domain types in `src/types/domain.ts`

## Compare output checks (`--baseline`)

- Top-level `version` field is `"3.0"`
- `hotspots` has `new`, `removed`, `rankChanged` arrays
- `meta.baseline` and `meta.current` contain `ScanMeta` objects
- `meta.warnings` is an array (may be empty)
- Baseline file must be valid `ScanResult` v3.0 JSON; rejects `1.0`/`2.0`, `coupling`, `cyclomaticComplexity`, or `functions`

## Related agents

| Agent                     | When                                    |
| ------------------------- | --------------------------------------- |
| `fixture-builder`         | Create/update fixture repos and samples |
| `verifier-implementation` | Spec acceptance after CLI changes       |
| `verifier-quality-gates`  | `pnpm build && pnpm test`               |

## References

- Design SoT: [`.specs/codebase/ARCHITECTURE.md`](../../../.specs/codebase/ARCHITECTURE.md), [TESTING.md](../../../.specs/codebase/TESTING.md)
- Skill: [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
- Rule: [testing-patterns.mdc](../../rules/testing-patterns.mdc)
