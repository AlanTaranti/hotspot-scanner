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
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --min-hotspot-score 0.5 --top 5
```

With flags:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --since "12 months ago" --format json --top 20  # --top ignored; full arrays
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format markdown --output /tmp/report.md
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format csv --output /tmp/report.csv
# CSV bundle files: /tmp/report.meta.json, /tmp/report.hotspots.csv
pnpm exec hotspot-scanner scan tests/fixtures/repos/<repo> --format json --output /tmp/scan.json
```

## Exit codes

| Code   | Meaning                                                                 |
| ------ | ----------------------------------------------------------------------- |
| `0`    | Scan completed successfully                                             |
| `1`    | `--fail-on-explain-miss` with missing `--explain` target                |
| `2`    | Invalid CLI args, config errors, or usage (including unknown removed `compare` / `baseline` / `--baseline` / `--strict`) |
| `130`  | Cancelled by `SIGINT`                                                   |
| `143`  | Cancelled by `SIGTERM`                                                  |

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
| `--top <N>`            | Limit table/markdown rows (ignored for json/csv)                                      | `20`                  |
| `--explain <path>`     | File-path score breakdown on stderr after report; hit prints `next: hotspot-scanner trend <path>` | —                     |
| `--fail-on-explain-miss` | Exit `1` when explain target missing (requires `--explain`)                       | —                     |
| `trend <file>`         | Per-file complexity trend; table shows `Pattern:` line; JSON `meta.growthPattern` required | —                     |
| `assess [path]`        | Scan → `hotspotScore` filter → sequential trends; `--min-hotspot-score` (default `0.7`), `--top` (default `20`); JSON `kind: "hotspot-assess"` / `version: "1.0"` | —                     |

Test relevant flags when the feature scope touches CLI.

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
- `meta.scannerVersion` present on fresh scans

## Negative CLI checks (M71)

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

- Design SoT: [`.specs/codebase/ARCHITECTURE.md`](../../../.specs/codebase/ARCHITECTURE.md), [TESTING.md](../../../.specs/codebase/TESTING.md)
- Skill: [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
- Rule: [testing-patterns.mdc](../../rules/testing-patterns.mdc)
