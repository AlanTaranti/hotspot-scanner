# Implementer Routing (hotspot-scanner)

Canonical module ownership for `tasks.md` path assignment and implementer delegation.

## Module map → task ownership

| Path prefix       | Domain                                                  |
| ----------------- | ------------------------------------------------------- |
| `src/git/`        | Git Change Miner (streaming parse, rename handling)     |
| `src/complexity/` | McCabe complexity via ts-morph                          |
| `src/scoring/`    | HotspotScorer, FunctionHotspotScorer                    |
| `src/report/`     | CLI table + JSON reporter                               |
| `src/scan.ts`     | Pipeline orchestration                                  |
| `src/types/`      | Domain type definitions                                 |
| `bin/`            | CLI flags and entry (no domain logic)                   |
| `tests/fixtures/` | Fixture repos and samples (`fixture-builder` preferred) |

## Parallelism rules

- `[P]` only when tasks touch **disjoint** path prefixes and tests are parallel-safe
- Do not parallelize tasks that both modify `src/scan.ts` wiring

## Mock boundaries

- Mock **git** only at `GitMiner` boundary — not in scorers.
- Mock **ts-morph** only at `ComplexityAnalyzer` boundary — not in scoring.

## Blocked conditions

| Condition                                               | Action                                          |
| ------------------------------------------------------- | ----------------------------------------------- |
| Task depends on incomplete upstream module              | Blocked — complete dependency task first        |
| Fragile area (git parse, McCabe, scoring) without tests | Block Complete until tests exist per TESTING.md |
| Missing fixture for integration task                    | Delegate `fixture-builder` or Blocked           |

## CLI validation routing

When task touches `bin/` or end-to-end scan:

- Per-task gate may use targeted Vitest
- Full CLI validation via `vitals-cli-validation` skill before feature Done
