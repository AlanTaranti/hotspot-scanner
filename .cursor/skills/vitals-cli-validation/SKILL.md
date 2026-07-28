---
name: vitals-cli-validation
description: CLI validation workflow for hotspot-scanner — exit codes, fixture runs, JSON output checks. Use when validating bin/, scan wiring, or tests/fixtures/. Triggers on "validate CLI", "test fixture", "exit code", "hotspot-scanner scan", "snapshot JSON". Do NOT use for unit test authoring alone (testing-patterns rule) or spec acceptance (verifier-implementation). Flag encyclopedia SoT is docs/cli-reference.md.
---

# Hotspot Scanner CLI Validation

Automated validation for `@vitals/hotspot-scanner` CLI. No interactive UI UAT.

**Fixtures:** `tests/fixtures/` (repos, git-log samples, complexity files).

**SoTs:** Flag encyclopedia + exit codes → [docs/cli-reference.md](../../../docs/cli-reference.md). Pipeline design → [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md). Fixture methodology → [TESTING.md](../../../.specs/codebase/TESTING.md).

## Base commands

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo>
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --min-hotspot-score 0.5 --top 5
```

Examples with formats:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format json --output /tmp/scan.json
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format markdown --output /tmp/report.md
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format csv --output /tmp/report.csv
```

## Exit codes

Canonical table: [docs/cli-reference.md → Exit codes](../../../docs/cli-reference.md#exit-codes).

## When to validate

- `bin/` — new flags, exit codes, output format
- `src/scan.ts` / trend / assess wiring — end-to-end changes
- New or updated fixtures in `tests/fixtures/`

## Assess validation

```bash
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --min-hotspot-score 0.5 --top 5
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --format json --min-hotspot-score 0.5 --top 5
```

Checks:

- Exit `0` on success (including partial per-file trend failures)
- Table shows summary pattern counts; detail only for `deteriorating`
- JSON `version` is `"1.0"`, `kind` is `"hotspot-assess"`; candidates have no `points` arrays
- `--min-hotspot-score` outside `[0, 1]` or `--top` `0` → exit `2`

## Trend validation

```bash
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --format json --since "10 years ago"
```

Checks:

- Exit `0` on success
- Table output contains `Pattern:` above sparklines
- JSON `version` is `"3.0"` with `meta.growthPattern.kind` and `summary`
- CSV has metric headers only (no pattern column)

Drill-down bridge:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --explain src/high.ts 2>&1 | grep '^next:'
```

## Fixture validation checklist

1. Path exists (`tests/fixtures/repos/<slug>/`)
2. Is a valid git repository (for integration scans)
3. `pnpm exec hotspot-scanner scan <path>` exits `0` on success
4. JSON output matches schema when `--format json`
5. Output shows `--since` window used

## JSON output checks (scan)

- Top-level `version` is `"3.0"`
- `hotspots` array sorted by score descending; each item includes `ncloc`
- No top-level `functions`, `coupling`, or `granularity` keys
- `meta.scannerVersion` present on fresh scans

## Negative CLI checks

Removed surface must fail with exit `2`:

```bash
pnpm exec hotspot-scanner compare . --baseline ./x.json   # unknown command
pnpm exec hotspot-scanner baseline save .                 # unknown command
pnpm exec hotspot-scanner scan . --baseline ./x.json      # unknown option
pnpm exec hotspot-scanner scan . --strict                 # unknown option
```

## Related agents

| Agent                     | When                                    |
| ------------------------- | --------------------------------------- |
| `fixture-builder`         | Create/update fixture repos and samples |
| `verifier-implementation` | Spec acceptance after CLI changes       |
| `verifier-quality-gates`  | `pnpm build && pnpm test`               |

## References

- Skill: [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
- Rule: [testing-patterns.mdc](../../rules/testing-patterns.mdc)
- Index: [AGENTS.md](../../../AGENTS.md)
