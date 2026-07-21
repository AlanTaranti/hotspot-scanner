# TESTING — @vitals/hotspot-scanner

## Quality gate

```bash
pnpm build && pnpm test
```

Required before marking any task Complete. Agents: use `verifier-quality-gates` or run inline.

## Test runner

**Vitest** (not Jest from IMPL §9 — documented in [STATE.md](../project/STATE.md)).

Config: `vitest.config.ts` at repo root.

## Coverage targets

| Scope | Threshold | Notes |
|-------|-----------|-------|
| `src/git/**`, `src/complexity/**`, `src/scoring/**` | **≥80%** lines | Per IMPL §9 |
| Other `src/**` | Best effort | No hard threshold until modules exist |

**Excluded from coverage:**

- `src/types/**`
- `**/*.test.ts`
- `**/*.d.ts`

## Test layers

| Layer | What | Tools |
|-------|------|-------|
| Unit | Scoring formulas, git log line parsing, McCabe nodes | Vitest + fixtures |
| Git Miner | Rename, merge, delete cases | Vitest + `tests/fixtures/git-log/` |
| Complexity | Known McCabe values | Vitest + `tests/fixtures/complexity/` |
| CLI | Flag defaults and invalid args | Vitest; mock `process.exit` |
| Integration | Full scan on fixture repo | Vitest + `tests/fixtures/repos/` |
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
