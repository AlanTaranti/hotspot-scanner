---
name: vitals-cli-validation
description: CLI validation workflow for hotspot-scanner — exit codes, fixture runs, JSON output checks. Use when validating bin/, scan wiring, or tests/fixtures/. Triggers on "validate CLI", "test fixture", "exit code", "hotspot-scanner scan", "snapshot JSON". Do NOT use for unit test authoring alone (testing-patterns rule) or spec acceptance (verifier-implementation). Flag encyclopedia SoT is docs/cli-reference.md.
---

# Hotspot Scanner CLI Validation

Automated validation for `@vitals/hotspot-scanner` CLI. No interactive UI UAT.

## Ownership (SoT map)

| Concern | Owner |
| ------- | ----- |
| Fixture **listing / methodology** (which trees exist, what each proves) | [TESTING.md](../../../.specs/codebase/TESTING.md) |
| Fixture **layout** | [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md) |
| Flags / exit codes | [docs/cli-reference.md](../../../docs/cli-reference.md) |
| Pipeline design | [ARCHITECTURE.md](../../../.specs/codebase/ARCHITECTURE.md) |
| **CLI assertions** (what to check per command) | **This skill** § CLI assertions |
| **Fixture authoring** (how to create/update a tree) | **This skill** § Fixture authoring + agent `fixture-builder` |

Base `scan` / `trend` / `assess` invocations against fixture repos: TESTING.md § CLI validation — do not restate them here. Add `--format json|markdown|csv` (with `--output <path>`) when checking a renderer.

## When to validate

- `bin/` — new flags, exit codes, output format
- `src/scan.ts` / trend / assess wiring — end-to-end changes
- New or updated fixtures in `tests/fixtures/`

---

## CLI assertions

### Assess

Run `assess` with `--min-hotspot-score 0.5 --top 5`, once as table and once with `--format json`. Checks:

- Exit `0` on success (including partial per-file trend failures)
- Table shows summary pattern counts; detail only for `deteriorating`
- JSON `version` is `"1.0"`, `kind` is `"hotspot-assess"`; candidates have no `points` arrays
- `--min-hotspot-score` outside `[0, 1]` or `--top` `0` → exit `2`

### Trend

Run `trend` on `trend-indent/src/trend.ts` with a wide `--since`, once as table and once with `--format json`. Checks:

- Exit `0` on success
- Table output contains `Pattern:` above sparklines
- JSON `version` is `"3.0"` with `meta.growthPattern.kind` and `summary`
- CSV has metric headers only (no pattern column)

Drill-down bridge:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --explain src/high.ts 2>&1 | grep '^next:'
```

### JSON output checks (scan)

- Top-level `version` is `"3.0"`
- `hotspots` array sorted by score descending; each item includes `ncloc`
- No top-level `functions`, `coupling`, or `granularity` keys
- `meta.scannerVersion` present on fresh scans

### Negative CLI checks

Removed surface must fail with exit `2`:

```bash
pnpm exec hotspot-scanner compare . --baseline ./x.json   # unknown command
pnpm exec hotspot-scanner baseline save .                 # unknown command
pnpm exec hotspot-scanner scan . --baseline ./x.json      # unknown option
pnpm exec hotspot-scanner scan . --strict                 # unknown option
```

---

## Fixture authoring

Used by `fixture-builder`. Listing/methodology SoT remains [TESTING.md](../../../.specs/codebase/TESTING.md); layout: [STRUCTURE.md](../../../.specs/codebase/STRUCTURE.md).

1. **Define purpose** — what the fixture must prove (e.g. rename chain → churn preserved with `--follow`).
2. **Minimal tree** — smallest set of files/commits; version Git repos in `tests/fixtures/repos/<slug>/`.
3. **Git log samples** — raw `git log --numstat` output in `tests/fixtures/git-log/` for unit tests.
4. **Complexity samples** — TS/JS files with known NCLOC (and indentation when needed) in `tests/fixtures/complexity/`.
5. **README.md** — in fixture folder: purpose, expected scan highlights, CLI command to validate.
6. **Validate** — scan the fixture path and check: path exists, it is a valid git repository (integration scans), exit `0`, JSON matches the schema with `--format json`, and the output reports the `--since` window used.

Fixture source is excluded from Vitest include — validation is via CLI or dedicated integration tests.

---

## Related agents

| Agent                     | When                                    |
| ------------------------- | --------------------------------------- |
| `fixture-builder`         | Create/update fixture repos and samples |
| `verifier-implementation` | Spec acceptance after CLI changes       |
| `verifier-quality-gates`  | Project gate per [quality-gates.mdc](../../rules/quality-gates.mdc) |

## References

- Skill: [vitals-pipeline-domain](../vitals-pipeline-domain/SKILL.md)
- Rule: [testing-patterns.mdc](../../rules/testing-patterns.mdc)
- Index: [AGENTS.md](../../../AGENTS.md)
