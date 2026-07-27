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
- Vitest resolves `#scan`, `#report`, `#diagnostics`, `#scoring`, and `#compare` aliases to **source** modules under `src/` during tests — run `pnpm build` before `pnpm test`

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
| Integration    | Full scan on fixture repo                            | Vitest + `tests/fixtures/repos/small-ts/` (primary E2E); `with-renames/` (M26); `merge-heavy/` (M55) |
| Contract       | JSON `version: "3.0"` schema validation              | `tests/contract/json-schema.test.ts`                                                         |
| Performance    | Large repo timing; overlap vs sequential A/B         | Manual `pnpm bench` (`scripts/bench-scan.mjs`) — **not** part of `pnpm test` / CI            |

## Git Miner fixtures (`tests/fixtures/git-log/`)

Hand-crafted `git log --numstat --name-only` line streams injected at the miner spawn boundary.

| Fixture | Purpose |
| ------- | ------- |
| `basic.txt` | Baseline numstat parse |
| `rename-multi.txt` | Linked rename chain |
| `rename-unlinked.txt` | M50 heuristic `link()` |
| `rename-since-truncation.txt` | `--since` truncation warning |
| `merge-delete.txt` | Merge commits and deletes |
| `binary.txt` | Binary file numstat edge cases |
| `large-synthetic.txt` | Streaming / memory regression |

**Repo fixtures:** `with-renames/`, `merge-heavy/` — integration in `src/scan.integration.test.ts`.

## NCLOC regressions (M57)

| Assertion | Test surface |
| --------- | ------------ |
| Blank / comment-only lines → 0 | `ncloc.test.ts` |
| Code + trailing `//` counts | `ncloc.test.ts` |
| `//` inside strings still counts when line has code | `ncloc.test.ts` |
| Unreadable file → `READ_FAILED` + omit hotspot | `analyze-batch.test.ts`, `index.test.ts` |
| Worker vs inline equivalence | `pool.test.ts`, `index.test.ts` |

## Pipeline overlap (M34) and sequential opt-out (M49)

Structural overlap proven in `src/scan.test.ts` with injected delayed `mine` / `analyze` mocks. Integration equivalence on `small-ts/` (default overlap vs `sequential: true`) in `src/scan.integration.test.ts`.

**Performance / bench (outside Vitest gate):** `pnpm bench` — documented in `scripts/benchmark-scan.md`.

## Mock boundaries

- Mock **git** at `GitMiner` adapter boundary — not in scorers or reporter
- Mock **size analyzer** at `ComplexityAnalyzer` / `createWorkerPool` boundary
- Pipeline integration tests use real fixtures where practical

## CLI validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug>
pnpm exec hotspot-scanner scan tests/fixtures/repos/<slug> --since "12 months ago" --format json
```

See skill `vitals-cli-validation` for exit codes and flag matrix.

**M28 diagnostics:** `meta.warnings` as `ScanWarning[]`; contract tests validate `$defs.ScanWarning`.

**M53 compare interpretation:** `compare-triage.test.ts`, `explain-compare.test.ts`, bin tests for `--strict` and compare `--explain`.

**Baseline contract (M57):** `load-baseline.test.ts` rejects `2.0`, `cyclomaticComplexity`, `functions`; accepts `3.0` with `ncloc`.

**Additive contract (M66):** `version` stays `"3.0"`; contract tests assert optional `scannerVersion` / root `$schema` on schemas and required `scoreDelta` / `nclocDelta` / `commitCountDelta` on `RankChangeHotspot`. `load-baseline.test.ts` accepts baselines without `scannerVersion` and with top-level `$schema` ignored. Fresh scan/compare JSON from `json.test.ts` / `compare-json.test.ts` asserts `$schema` URLs and `meta.scannerVersion`.

## Integrity rules

- Do not weaken assertions or remove cases to pass the gate
- Falling test count = potential regression — investigate
