# TESTING — @vitals/hotspot-scanner

## Quality gate

```bash
pnpm build && pnpm test
```

Required before marking any task Complete. Agents: use `verifier-quality-gates` or run inline.

## Test runner

**Vitest** (not Jest from IMPL §9 — documented in [STATE.md](../project/STATE.md)).

Config: `vitest.config.ts` at repo root.

- `pnpm test` runs `vitest run --coverage` (coverage is not optional)
- Manual equivalent: `pnpm exec vitest --run --coverage`
- Vitest resolves `#scan`, `#report`, `#diagnostics`, and `#scoring` aliases to **source** modules under `src/` during tests — run `pnpm build` before `pnpm test` (enforced by the quality gate; build validates production `dist/` output and package imports)

## Coverage

`vitest.config.ts` enforces thresholds; this section documents that config.

### Provider and output

| Setting | Value |
|---------|-------|
| Provider | `v8` (`@vitest/coverage-v8`) |
| Output dir | `coverage/` (gitignored) |

### Included / excluded files

| Config key | Patterns |
|------------|----------|
| `coverage.include` | `src/**/*.ts`, `bin/**/*.ts` |
| `coverage.exclude` | `src/types/**`, `**/*.test.ts`, `**/*.d.ts` |

### `coverage.thresholds` (global, per-file)

| Setting | Value |
|---------|-------|
| `perFile` | `true` |
| `lines` | ≥ 90% |
| `functions` | ≥ 90% |
| `branches` | ≥ 80% |
| `statements` | ≥ 80% |

**Threshold behavior:**

- **Global per-file** — every included source file must meet all four metrics individually (not just aggregate or per-directory).
- **Scope** — all `src/**` (except `src/types/**`) and `bin/**`; no path-specific exemptions.
- **Failure mode** — `pnpm test` exits non-zero with per-file threshold errors naming file and metric.

Reference (keep in sync with `vitest.config.ts`):

```ts
coverage: {
  provider: "v8",
  include: ["src/**/*.ts", "bin/**/*.ts"],
  exclude: ["src/types/**", "**/*.test.ts", "**/*.d.ts"],
  thresholds: {
    perFile: true,
    branches: 80,
    functions: 90,
    lines: 90,
    statements: 80,
  },
}
```

> IMPL §9 originally specified ≥80% lines on `src/git/**`, `src/complexity/**`, and `src/scoring/**`. Gate enforcement follows `vitest.config.ts` global per-file thresholds above.

## Test layers

| Layer | What | Tools |
|-------|------|-------|
| Unit | Scoring formulas, git log line parsing, McCabe nodes | Vitest + fixtures |
| Git Miner | Rename, merge, delete cases | Vitest + `tests/fixtures/git-log/` |
| Complexity | Known McCabe values | Vitest + `tests/fixtures/complexity/` |
| CLI | Flag defaults and invalid args | Vitest; mock `process.exit` |
| Integration | Full scan on fixture repo | Vitest + `tests/fixtures/repos/small-ts/` (primary E2E); P2: `with-renames/`, `merge-heavy/` |
| Performance | Large repo timing | Manual benchmark (not CI) |

## Mock boundaries

- Mock **git** only at `GitMiner` adapter boundary — not in scorers or reporter
- Mock **ts-morph** only at `ComplexityAnalyzer` adapter boundary
- Pipeline integration tests use real fixtures where practical

## CLI validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/<repo>
pnpm exec hotspot-scanner scan tests/fixtures/<repo> --since "12 months ago" --format json
```

See skill `vitals-cli-validation` for exit codes and flag matrix.

## Integrity rules

- Do not weaken assertions or remove cases to pass the gate
- Falling test count = potential regression — investigate
