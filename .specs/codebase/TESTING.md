# TESTING — @vitals/hotspot-scanner

Testing infrastructure and patterns SoT. Product contracts: [ARCHITECTURE.md](ARCHITECTURE.md). Fragile risks: [CONCERNS.md](CONCERNS.md). Exit codes: [docs/cli-reference.md](../../docs/cli-reference.md#exit-codes). Doc ownership: [DOC-OWNERSHIP.md](DOC-OWNERSHIP.md).

## Quality gate

```bash
pnpm build && pnpm test
```

Required before marking any task Complete. Agents: use `verifier-quality-gates` or run inline. Run `pnpm lint` when changing `bin/` or ESLint config.

`pnpm hooks:smoke` validates Cursor hooks under `.cursor/hooks/` — **not** part of the product gate.

## Test runner

**Vitest.** Config: `vitest.config.ts` at repo root.

- `pnpm test` runs `vitest run --coverage` (coverage is not optional)
- Vitest resolves these `#` aliases to **source** modules under `src/` during tests: `#scan`, `#report`, `#diagnostics`, `#scoring`, `#types`, `#config`, `#doctor`, `#git`, `#trend`, `#assess`
- **`tests/compiled-cli.smoke.test.ts`** exercises the **compiled** CLI at `dist/bin/hotspot-scanner.js` (`trend`/`scan`/`doctor --help`); run `pnpm build` before `pnpm test` (gate order: build then test)

## Test organization

| Kind | Location pattern | Notes |
| ---- | ---------------- | ----- |
| Unit / module | `src/**/*.test.ts`, `bin/**/*.test.ts` | Prefer co-located next to the module under test |
| Integration | `src/**/*.integration.test.ts`, `bin/**/*.integration.test.ts`, `tests/*.integration.test.ts` | Fixture repos under `tests/fixtures/repos/` |
| Contract | `tests/contract/**/*.test.ts` | JSON Schema validation |
| Compiled smoke | `tests/compiled-cli.smoke.test.ts` | Requires `dist/` from `pnpm build` |

`vitest.config.ts` `include`: the four patterns above. `exclude`: `tests/fixtures/**`, `node_modules/**`, `dist/**`.

## Coverage

`vitest.config.ts` enforces thresholds; this section documents that config.

**Commit hook note:** the Cursor `gate-before-commit` hook can allow a commit for `tests/`-only edits, but the project gate (`pnpm build && pnpm test`) is still required before Done — see [quality-gates.mdc](../../.cursor/rules/quality-gates.mdc). Tracked code paths are defined by `CODE_PATH_RE` in `.cursor/hooks/lib/paths.mjs` — see [hooks/README.md](../../.cursor/hooks/README.md).

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

## Test layers

| Layer          | What                                                 | Tools                                                                                        |
| -------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unit           | Scoring formulas, git log line parsing, NCLOC scanner | Vitest + fixtures                                                                            |
| Git Miner      | Rename, merge, delete cases                          | Vitest + `tests/fixtures/git-log/`                                                           |
| Size / NCLOC   | Known NCLOC counts (comments, strings, blank lines)  | Vitest + `src/complexity/ncloc.test.ts` + fixture sources                                    |
| CLI            | Flag defaults, `--concurrency`, `completion <shell>`, `doctor --format json`, invalid args | Vitest; mock `process.exit`                                                                  |
| Integration    | Full scan / trend on fixture repos                   | Vitest + `tests/fixtures/repos/small-ts/` (primary E2E); `with-renames/` (renames); `merge-heavy/` (merges); `trend-indent/` (trend) |
| Contract       | JSON schemas: scan `3.0`, complexity-trend `3.0`, hotspot-assess `1.0`, config | `tests/contract/json-schema.test.ts`                                                         |
| Performance    | Large repo timing; overlap vs sequential A/B         | Manual `pnpm bench` (`scripts/bench-scan.mjs`) — **not** part of `pnpm test` / CI            |

## Test coverage matrix

| Code Layer | Required Test Type | Location Pattern | Run Command |
| ---------- | ------------------ | ---------------- | ----------- |
| `src/git/` | Unit + git-log fixtures | `src/git/*.test.ts` | `pnpm test` |
| `src/complexity/` | Unit + NCLOC fixtures | `src/complexity/*.test.ts` | `pnpm test` |
| `src/scoring/` | Unit | `src/scoring/*.test.ts` | `pnpm test` |
| `src/scan.ts` / pipeline | Unit + integration | `src/scan.test.ts`, `src/scan*.integration.test.ts` | `pnpm test` |
| `src/report/` | Unit | `src/report/*.test.ts` | `pnpm test` |
| `src/scan-result/` | Unit (parse) | `src/scan-result/*.test.ts` | `pnpm test` |
| `src/trend/`, `src/assess/` | Unit + integration | `src/{trend,assess}/*.test.ts`, `tests/trend.integration.test.ts` | `pnpm test` |
| `bin/` | Unit + integration + compiled smoke | `bin/*.test.ts`, `tests/compiled-cli.smoke.test.ts` | `pnpm build && pnpm test` |
| `schemas/` | Contract | `tests/contract/**/*.test.ts` | `pnpm test` |

## Fixtures

### Git Miner (`tests/fixtures/git-log/`)

Hand-crafted `git log --numstat --name-only` line streams injected at the miner spawn boundary.

| Fixture | Purpose |
| ------- | ------- |
| `basic.txt` | Baseline numstat parse |
| `rename-multi.txt` | Linked rename chain |
| `rename-unlinked.txt` | Heuristic `link()` for unlinked delete+add |
| `rename-unlinked-stem.txt` | Stem-based unlinked rename heuristic |
| `rename-since-truncation.txt` | `--since` truncation warning |
| `merge-delete.txt` | Merge commits and deletes |
| `binary.txt` | Binary file numstat edge cases |
| `large-synthetic.txt` | Streaming / memory regression |

### Repo fixtures (`tests/fixtures/repos/`)

| Fixture | Purpose |
| ------- | ------- |
| `small-ts/` | Primary E2E scan |
| `with-renames/` | Rename identity across history |
| `merge-heavy/` | Merge-commit churn |
| `trend-indent/` | Complexity trend on a single file |

**Bootstrap:** each fixture has `bootstrap-repo.mjs` + `ensureFixtureRepo()`. Vitest `globalSetup` (`tests/fixtures/repos/global-setup.ts`) runs bootstrap for **`small-ts`** and **`merge-heavy` only**. `with-renames/` and `trend-indent/` are bootstrapped by their owning tests or manually (`node bootstrap-repo.mjs` in the fixture dir) before CLI validation.

**Integration wiring:** `src/scan.integration.test.ts`, `src/scan.path-scoping.integration.test.ts`, `tests/trend.integration.test.ts`, `bin/hotspot-scanner.integration.test.ts`.

### Other fixture trees

| Path | Use |
| ---- | --- |
| `tests/fixtures/complexity/` | NCLOC / size analyzer source snippets |
| `tests/fixtures/report/` | Sample scan / trend / assess JSON for renderers and contract |
| `tests/fixtures/scoring/` | Ranking / score golden inputs |
| `tests/fixtures/workers/` | Worker-pool edge workers (error, exit, slow, bad message) |

## Domain regression surfaces

### NCLOC

| Assertion | Test surface |
| --------- | ------------ |
| Blank / comment-only lines → 0 | `ncloc.test.ts` |
| Code + trailing `//` counts | `ncloc.test.ts` |
| `//` inside strings still counts when line has code | `ncloc.test.ts` |
| Unreadable file → `READ_FAILED` + omit hotspot | `analyze-batch.test.ts`, `index.test.ts` |
| Worker vs inline equivalence | `pool.test.ts`, `index.test.ts` |

### Pipeline overlap / sequential

Structural overlap proven in `src/scan.test.ts` with injected delayed `mine` / `analyze` mocks. Integration equivalence on `small-ts/` (default overlap vs `sequential: true`) in `src/scan.integration.test.ts`.

**Performance / bench (outside Vitest gate):** `pnpm bench` — documented in `scripts/benchmark-scan.md`.

## Mock boundaries

- Mock **git** at `GitMiner` adapter boundary — not in scorers or reporter
- Mock **size analyzer** at `ComplexityAnalyzer` / `createWorkerPool` boundary
- Pipeline integration tests use real fixtures where practical

## Contract test surfaces

Schema field semantics: [ARCHITECTURE.md](ARCHITECTURE.md). Tests below keep contracts green:

| Surface | Where |
| ------- | ----- |
| Scan / config / trend / assess JSON Schema | `tests/contract/json-schema.test.ts` |
| `ScanWarning` `$defs` | contract tests |
| `parseScanResult` accept `3.0` / reject legacy shapes | `src/scan-result/parse-scan-result.test.ts` |
| Fresh scan JSON `$schema` / `meta.scannerVersion` | `src/report/json.test.ts` |
| Scan interpretation (`triage`, `--explain`, `--fail-on-explain-miss`) | `src/report/triage.test.ts`, `src/report/explain.test.ts`, `bin/` tests |

## CLI validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug> --since "12 months ago" --format json
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --format json
```

Run workflow and flag matrix: skill `vitals-cli-validation`. Canonical exit-code table: [docs/cli-reference.md § Exit codes](../../docs/cli-reference.md#exit-codes).

## Parallelism assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (co-located) | Yes | No shared mutable fixture repos; mocks local to file | `src/**/*.test.ts`, `bin/**/*.test.ts` |
| Contract | Yes | Read-only schema + sample JSON fixtures | `tests/contract/` |
| Integration (fixture repos) | Yes | Per-fixture dirs; `globalSetup` / `ensureFixtureRepo()` bootstrap | `*.integration.test.ts` |
| Compiled CLI smoke | Yes (after build) | Spawns `dist/bin/`; requires prior `pnpm build` | `tests/compiled-cli.smoke.test.ts` |

Vitest runs files in parallel by default. Do not share writable state across test files without isolation.

## Gate check commands

This project uses a **single** product gate (no Quick/Full tiers):

| Gate | When to Use | Command |
| ---- | ----------- | ------- |
| Product | Before marking any implementation task Complete | `pnpm build && pnpm test` |
| Lint (supplemental) | When changing `bin/` or ESLint config | `pnpm lint` |
| Hooks smoke (out-of-band) | After changing `.cursor/hooks/` | `pnpm hooks:smoke` |

## Integrity rules

- Do not weaken assertions or remove cases to pass the gate
- Falling test count = potential regression — investigate
