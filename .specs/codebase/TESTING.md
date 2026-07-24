# TESTING — @vitals/hotspot-scanner

## Quality gate

```bash
pnpm build && pnpm test
```

Required before marking any task Complete. Agents: use `verifier-quality-gates` or run inline.

## Test runner

**Vitest** (documented in [STATE.md](../project/STATE.md)).

Config: `vitest.config.ts` at repo root.

- `pnpm test` runs `vitest run --coverage` (coverage is not optional)
- Manual equivalent: `pnpm exec vitest --run --coverage`
- Vitest resolves `#scan`, `#report`, `#diagnostics`, `#scoring`, and `#compare` aliases to **source** modules under `src/` during tests — run `pnpm build` before `pnpm test` (enforced by the quality gate; build validates production `dist/` output and package imports)

## Coverage

`vitest.config.ts` enforces thresholds; this section documents that config.

### Provider and output

| Setting    | Value                        |
| ---------- | ---------------------------- |
| Provider   | `v8` (`@vitest/coverage-v8`) |
| Output dir | `coverage/` (gitignored)     |

### Included / excluded files

| Config key         | Patterns                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| `coverage.include` | `src/**/*.ts`, `bin/**/*.ts`                                            |
| `coverage.exclude` | `src/types/**`, `src/complexity/worker.ts`, `**/*.test.ts`, `**/*.d.ts` |

### `coverage.thresholds` (global, per-file)

| Setting      | Value  |
| ------------ | ------ |
| `perFile`    | `true` |
| `lines`      | ≥ 90%  |
| `functions`  | ≥ 90%  |
| `branches`   | ≥ 80%  |
| `statements` | ≥ 80%  |

**Threshold behavior:**

- **Global per-file** — every included source file must meet all four metrics individually (not just aggregate or per-directory).
- **Scope** — all `src/**` (except `src/types/**`) and `bin/**`; no path-specific exemptions.
- **Failure mode** — `pnpm test` exits non-zero with per-file threshold errors naming file and metric.

Reference (keep in sync with `vitest.config.ts`):

```ts
coverage: {
  provider: "v8",
  include: ["src/**/*.ts", "bin/**/*.ts"],
  exclude: ["src/types/**", "src/complexity/worker.ts", "**/*.test.ts", "**/*.d.ts"],
  thresholds: {
    perFile: true,
    branches: 80,
    functions: 90,
    lines: 90,
    statements: 80,
  },
}
```

> Original design targeted ≥80% lines on `src/git/**`, `src/complexity/**`, and `src/scoring/**`. Gate enforcement follows `vitest.config.ts` global per-file thresholds above.

## Test layers

| Layer          | What                                                 | Tools                                                                                        |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unit           | Scoring formulas, git log line parsing, McCabe nodes | Vitest + fixtures                                                                            |
| Git Miner      | Rename, merge, delete cases                          | Vitest + `tests/fixtures/git-log/`                                                           |
| Function churn | Hunk overlap, nested credit, interval index (M35) | Vitest + `tests/fixtures/git-patch/`; `aggregate.test.ts` equivalence vs `hunkIntersectsFunction` |
| Complexity     | Known McCabe values                                  | Vitest + `tests/fixtures/complexity/`                                                        |
| CLI            | Flag defaults, `--concurrency`, invalid args           | Vitest; mock `process.exit`                                                                  |
| Integration    | Full scan on fixture repo                            | Vitest + `tests/fixtures/repos/small-ts/` (primary E2E); `with-renames/` (M26 rename confidence E2E); P2: `merge-heavy/` |
| Performance    | Large repo timing                                    | Manual benchmark (not CI)                                                                    |

## Git Miner fixtures (`tests/fixtures/git-log/`)

Hand-crafted `git log --numstat --name-only` line streams injected at the miner spawn boundary. Headers document expected warnings and churn outcomes.

| Fixture | Purpose |
| ------- | ------- |
| `basic.txt` | Baseline numstat parse; no rename warnings |
| `rename-multi.txt` | Linked rename chain (`a.ts` → `b.ts` → `c.ts`); canonical `c.ts` churn; no blind-spot warnings |
| `rename-unlinked.txt` | Copy-paste delete+add (no `=>`); expects unlinked-rename warning; churn split across paths |
| `rename-since-truncation.txt` | In-window rename link; use with `since` option → truncation warning |
| `merge-delete.txt` | Merge commits and deletes |
| `binary.txt` | Binary file numstat edge cases |
| `large-synthetic.txt` | Streaming / memory regression |

**Repo fixture (M26):** `tests/fixtures/repos/with-renames/` — content-preserving `git mv` chain; E2E asserts unified canonical churn under `src/c.ts`, find-renames enabled, and documented file-miner warnings. See fixture `README.md` for expected outcomes. Integration: `src/scan.integration.test.ts`.

**Function churn:** patch-stream fixtures under `tests/fixtures/git-patch/`; rename / ambiguous cases assert pós-rename overlap warning in `src/git/function-churn/*.test.ts`. M35: `spawn.test.ts` / `index.test.ts` cover pathspec argv, empty-path skip, and `PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000) fallback; `aggregate.test.ts` locks interval-index equivalence.

## Function-mode scan efficiency regressions (M35)

Integration and unit coverage for pathspec-restricted patch spawn, AST allowlist, and file-mode non-regression. Primary file: `src/scan.integration.test.ts` (describe `runScan integration — function-mode efficiency (M35)`).

| Assertion | Requirement | Test surface |
| --------- | ----------- | ------------ |
| File mode never spawns patch stream | HOTSPOT-392, HOTSPOT-397 | `streamGitPatchLog` spy — `granularity: "file"` → zero calls |
| Function mode pathspec argv | HOTSPOT-388 | Spy captures `paths`; `buildGitPatchLogArgv` includes `--` + sorted pathspecs; `-M`, `-p`, `--unified=0` preserved |
| Typical churned ranking parity | HOTSPOT-388 | `small-ts` function order matches `EXPECTED_CHURNED_FUNCTION_RANKING` |
| Zero-churn file omission (intentional) | HOTSPOT-387, HOTSPOT-398 | Isolated `small-ts` + `src/untouched.ts` — present in file `hotspots`, absent from `functions` |
| AST allowlist | HOTSPOT-386 | `src/complexity/index.test.ts` — discover ∩ allowlist; empty intersection skips workers |
| Scan wiring | HOTSPOT-384, HOTSPOT-393–395 | `src/scan.test.ts` — `buildFunctionModePathAllowlist`, `pathAllowlist` passed only in function mode |
| ARG_MAX fallback | HOTSPOT-383 | `spawn.test.ts` / `index.test.ts` — over-threshold omits pathspecs |
| Interval index semantics | HOTSPOT-389–391 | `aggregate.test.ts` — nested, adjacent, non-overlap, multi-hunk |

Mock boundary: spy/inject at `streamGitPatchLog` via `createFunctionChurnMiner` deps in integration tests — not in scorers or reporter.

## Mock boundaries

- Mock **git** at `GitMiner` and `FunctionChurnMiner` adapter boundaries — not in scorers or reporter
- Mock **ts-morph** only at `ComplexityAnalyzer` adapter boundary
- Pipeline integration tests use real fixtures where practical

### Pipeline overlap (M34)

Structural overlap and barrier ordering are proven in `src/scan.test.ts` with injected delayed `mine` / `analyze` mocks — assert both stages in-flight concurrently (file mode), scoring/coupling only after both settle, function-churn only after complexity and never during numstat, sibling `AbortSignal` on failure, and git-then-complexity warning order. **Do not** rely on wall-clock timing asserts in CI; integration equivalence on `tests/fixtures/repos/small-ts/` lives in `src/scan.integration.test.ts`.

## CLI validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug> --since "12 months ago" --format json
```

See skill `vitals-cli-validation` for exit codes and flag matrix.

**M28 diagnostics:** integration tests assert `meta.warnings` as `ScanWarning[]` objects; contract tests (`tests/contract/json-schema.test.ts`) validate `$defs.ScanWarning` on scan and compare JSON. Invalid `--concurrency` exits non-zero before scan.

## Integrity rules

- Do not weaken assertions or remove cases to pass the gate
- Falling test count = potential regression — investigate
