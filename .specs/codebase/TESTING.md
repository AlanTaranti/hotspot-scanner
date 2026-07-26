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
| CLI            | Flag defaults, `--concurrency`, `completion <shell>`, `doctor --format json`, invalid args | Vitest; mock `process.exit`                                                                  |
| Integration    | Full scan on fixture repo                            | Vitest + `tests/fixtures/repos/small-ts/` (primary E2E); `with-renames/` (M26 rename confidence E2E); `merge-heavy/` (M55 merge + delete E2E) |
| Performance    | Large repo timing; overlap vs sequential A/B         | Manual `pnpm bench` harness (`scripts/bench-scan.mjs`) — **not** part of `pnpm test` / CI    |

## Git Miner fixtures (`tests/fixtures/git-log/`)

Hand-crafted `git log --numstat --name-only` line streams injected at the miner spawn boundary. Headers document expected warnings and churn outcomes.

| Fixture | Purpose |
| ------- | ------- |
| `basic.txt` | Baseline numstat parse; no rename warnings |
| `rename-multi.txt` | Linked rename chain (`a.ts` → `b.ts` → `c.ts`); canonical `c.ts` churn; no blind-spot warnings |
| `rename-unlinked.txt` | Copy-paste delete+add (no `=>`); M50 heuristic `link()`; expects unlinked-rename warning; churn unified under new path |
| `rename-since-truncation.txt` | In-window rename link; use with `since` option → truncation warning |
| `merge-delete.txt` | Merge commits and deletes |
| `binary.txt` | Binary file numstat edge cases |
| `large-synthetic.txt` | Streaming / memory regression |

**Repo fixture (M26):** `tests/fixtures/repos/with-renames/` — content-preserving `git mv` chain; E2E asserts unified canonical churn under `src/c.ts`, find-renames enabled, and documented file-miner warnings. See fixture `README.md` for expected outcomes. Integration: `src/scan.integration.test.ts`.

**Repo fixture (M55):** `tests/fixtures/repos/merge-heavy/` — feature-branch merge commit plus file delete on `main`; E2E asserts `src/keep.ts` in hotspot rankings and deleted `src/remove.ts` absent. Bootstrapped via `ensureFixtureRepo` in `tests/fixtures/repos/global-setup.ts`. Integration: `src/scan.integration.test.ts` (describe `runScan integration — merge-heavy fixture`).

**Function churn:** patch-stream fixtures under `tests/fixtures/git-patch/`; rename / ambiguous cases assert pós-rename overlap warning in `src/git/function-churn/*.test.ts`. M35 + M47: `spawn.test.ts` / `index.test.ts` cover pathspec argv per chunk, `partitionPathspecs`, empty-path skip, sequential batching over threshold, and ARG_MAX emergency; `aggregate.test.ts` locks interval-index equivalence.

## Function-mode scan efficiency regressions (M35, M47)

Integration and unit coverage for pathspec-restricted patch spawn, sequential batching over threshold, AST allowlist, and file-mode non-regression. Primary file: `src/scan.integration.test.ts` (describe `runScan integration — function-mode efficiency (M35)`).

| Assertion | Requirement | Test surface |
| --------- | ----------- | ------------ |
| File mode never spawns patch stream | HOTSPOT-392, HOTSPOT-397 | `streamGitPatchLog` spy — `granularity: "file"` → zero calls |
| Function mode pathspec argv (under threshold) | HOTSPOT-388 | Spy captures `paths`; single spawn; `buildGitPatchLogArgv` includes `--` + sorted pathspecs; `-M`, `-p`, `--unified=0` preserved |
| Function mode batched pathspec spawns (over threshold) | HOTSPOT-668 | Integration spy — allowlist `> 1000` → ≥2 sequential spawns, each chunk `≤ 1000` with `--` pathspecs; no unrestricted (`paths` undefined) spawn |
| Typical churned ranking parity | HOTSPOT-388 | `small-ts` function order matches `EXPECTED_CHURNED_FUNCTION_RANKING` |
| Zero-churn file inclusion (M50 revisit) | HOTSPOT-761, HOTSPOT-765 | Isolated `small-ts` + `src/untouched.ts` — present in file `hotspots` **and** `functions` |
| AST allowlist (patch-only after M50) | HOTSPOT-386 | `src/complexity/index.test.ts` — `pathAllowlist` still supported on analyzer API; scan omits it in function mode |
| Scan wiring | HOTSPOT-384, HOTSPOT-393–395 | `src/scan.test.ts` — `buildFunctionModePathAllowlist` for patch only; complexity full discovery in function mode |
| ARG_MAX emergency fallback | HOTSPOT-383, HOTSPOT-667 | `spawn.test.ts` / `index.test.ts` — half-size retry then unrestricted + `PATHSPEC_ARG_MAX_FALLBACK` |
| Dry-run pathspec scale warning | HOTSPOT-680–683 | `scan-preview.test.ts` — warning only when eligible count `> 1000`; no mine |
| Mega-commit threshold wiring | HOTSPOT-670–679 | `aggregate.test.ts`, `merge-options.test.ts`, `git/index.test.ts`, `scan.test.ts`, `bin/hotspot-scanner.test.ts` |
| Interval index semantics | HOTSPOT-389–391 | `aggregate.test.ts` — nested, adjacent, non-overlap, multi-hunk |

Mock boundary: spy/inject at `streamGitPatchLog` via `createFunctionChurnMiner` deps in integration tests — not in scorers or reporter.

## Ranking accuracy plus regressions (M50)

Integration smokes in `src/scan.integration.test.ts` (describe `runScan integration — ranking accuracy plus (M50)`). Unit/contract coverage for individual slices lives in task-specific modules (`rename-warnings.test.ts`, `enrich-coupling-static.test.ts`, `hotspot-scorer.test.ts`, `analyze-file.test.ts`, etc.).

| Assertion | Requirement | Test surface |
| --------- | ----------- | ------------ |
| Heuristic rename unifies churn + enrich static edge | HOTSPOT-766 | Isolated `small-ts` — unlinked `foo.ts`→`foo.tsx`; canonical churn, `RENAME_HISTORY_INCOMPLETE`, coupling `hasStaticDependency` |
| PARSE_FAILED in file hotspots | HOTSPOT-767 | Isolated `small-ts` + `src/broken.ts` — `parseFailed: true`, score 0, warning; no function rows |
| Callbacks/IIFEs + zero-churn function AST | HOTSPOT-768 | Isolated `small-ts` + staged `callbacks-iife.ts` — `<anonymous>:L*` names, `commitCount: 0` |
| Living docs sync | HOTSPOT-737, HOTSPOT-745, HOTSPOT-765, HOTSPOT-769 | `.specs/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `TESTING.md` |

## Mock boundaries

- Mock **git** at `GitMiner` and `FunctionChurnMiner` adapter boundaries — not in scorers or reporter
- Mock **ts-morph** only at `ComplexityAnalyzer` adapter boundary
- Pipeline integration tests use real fixtures where practical

### Pipeline overlap (M34) and sequential opt-out (M49)

Structural overlap and barrier ordering are proven in `src/scan.test.ts` with injected delayed `mine` / `analyze` mocks — assert both stages in-flight concurrently (file mode, default), scoring/coupling only after both settle, function-churn only after complexity and never during numstat, sibling `AbortSignal` on failure, and git-then-complexity warning order. With `sequential: true`, unit tests assert stages are **not** concurrently in-flight and fail-closed on stage errors without scoring. **Do not** rely on wall-clock timing asserts in CI; integration equivalence on `tests/fixtures/repos/small-ts/` (default overlap vs `sequential: true` hotspot/coupling parity; function mode with sequential) lives in `src/scan.integration.test.ts`.

**Performance / bench (outside Vitest gate):** `pnpm bench` exercises default overlap vs `--sequential` A/B for operator timing — documented in `scripts/benchmark-scan.md`; not invoked by `pnpm test` and no duration fail policy in CI.

## CLI validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug> --since "12 months ago" --format json
```

See skill `vitals-cli-validation` for exit codes and flag matrix.

**M28 diagnostics:** integration tests assert `meta.warnings` as `ScanWarning[]` objects; contract tests (`tests/contract/json-schema.test.ts`) validate `$defs.ScanWarning` on scan and compare JSON. Invalid `--concurrency` exits non-zero before scan.

**M51 doctor JSON:** `src/doctor/format.test.ts` + `bin/hotspot-scanner.test.ts` — `doctor --format json` stdout shape (`version`, `findings`, `exitCode`).

**M54 completion:** `bin/hotspot-scanner.test.ts` — `completion <shell>` prints script to stdout; invalid shell → `CliUsageError`.

**M42 explain + progress:** `src/report/explain.test.ts` (grammar, lookup, stderr formatting); `src/diagnostics/logger.test.ts` and `src/complexity/pool.test.ts` (complexity phase counters and throttle); `bin/hotspot-scanner.test.ts` (CLI `--explain` stderr vs JSON stdout); `src/scan.integration.test.ts` (git + complexity + function-churn progress ordering).

**M53 compare interpretation:** `src/report/compare-triage.test.ts` (delta triage rules, cap, sliced input); `src/report/explain-compare.test.ts` (compare explain classification and fields); `compare-table.test.ts` / `compare-markdown.test.ts` / `index.test.ts` (triage section wiring); `bin/hotspot-scanner.test.ts` (`--strict` exit on `COMPARE_SINCE_MISMATCH`, compare `--explain` stderr vs JSON stdout). Living docs: `.specs/codebase/ARCHITECTURE.md`, `README.md`, `docs/recipes.md`, `docs/warning-codes.md` (HOTSPOT-837–839).

## Integrity rules

- Do not weaken assertions or remove cases to pass the gate
- Falling test count = potential regression — investigate
