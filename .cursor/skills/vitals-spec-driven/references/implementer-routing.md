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

## Cross-feature parallelism

When the orchestrator runs **batch mode** (multiple features), apply the same path-disjoint rules across feature boundaries:

1. **Primary source:** `Path Conflict Check` table in each feature's `tasks.md` (when present).
2. **Fallback:** Compare `Where` paths against the module map above — tasks in different prefix rows are parallel-safe unless they share a specific file.
3. **Always serialize** tasks that touch `src/scan.ts`, `bin/hotspot-scanner.ts`, or JSON schema files — even across features.
4. **Fixtures:** `tests/fixtures/repos/<slug>` with different slugs are parallel-safe; same slug or shared fixture file is not.
5. **Explicit cross-feature deps** (ROADMAP, `design.md`, `Depends on` mentioning another feature) override parallelism — complete the upstream feature/task first.

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
