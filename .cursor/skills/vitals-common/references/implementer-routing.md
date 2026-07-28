# Implementer Routing (hotspot-scanner)

Canonical module ownership for `tasks.md` path assignment and implementer delegation.

**Full Path|Role SoT:** [STRUCTURE.md](../../../../.specs/codebase/STRUCTURE.md) — this file is the task-routing overlay only.

## Module map → task ownership

| Path prefix            | Domain                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `src/git/`             | Git Change Miner (streaming parse, rename, file-history for trend)     |
| `src/complexity/`      | NCLOC size analyzer + indentation metrics (pool/worker optional)       |
| `src/trend/`           | Complexity trend + growth pattern classify                             |
| `src/assess/`          | Hotspot assess (scan → filter → sequential trends)                     |
| `src/scoring/`         | HotspotScorer (file hotspots)                                          |
| `src/diagnostics/`     | stderr warnings + progress                                             |
| `src/doctor/`          | Pre-flight checks                                                      |
| `src/scan-result/`     | `parseScanResult` / `ScanResultParseError`                             |
| `src/report/`          | table / JSON / markdown / CSV (+ trend/assess reporters)               |
| `src/config/`          | `.hotspot-scanner.json` load / merge / validate                        |
| `src/paths/`           | PathScope globs + monorepo remount                                     |
| `src/scan.ts`          | File-only pipeline orchestration                                       |
| `src/scan-preview.ts`  | `--dry-run` scope preview                                              |
| `src/package-meta.ts`  | `meta.scannerVersion`                                                  |
| `src/types/`           | Domain type definitions (no runtime logic)                             |
| `bin/`                 | CLI entry + `*-actions.ts` (flags/wiring only — no domain logic)       |
| `schemas/`             | JSON Schema contracts                                                  |
| `tests/fixtures/`      | Fixture repos and samples (`fixture-builder` preferred)                |

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

SoT: [INTEGRATIONS.md](../../../../.specs/codebase/INTEGRATIONS.md) + [testing-patterns.mdc](../../../rules/testing-patterns.mdc).

- Mock **git** only at `GitMiner` boundary — not in scorers or reporter.
- Mock **`createWorkerPool`** at the ComplexityAnalyzer boundary — not in scoring.
- No ts-morph / AST McCabe in this codebase (NCLOC state machine).

## Blocked conditions

| Condition                                                  | Action                                          |
| ---------------------------------------------------------- | ----------------------------------------------- |
| Task depends on incomplete upstream module                 | Blocked — complete dependency task first        |
| Fragile area (git parse, NCLOC, scoring) without tests     | Block Complete until tests exist per TESTING.md |
| Missing fixture for integration task                       | Delegate `fixture-builder` or Blocked           |

## CLI validation routing

When task touches `bin/` or end-to-end scan:

- Per-task gate may use targeted Vitest
- Full CLI validation via `vitals-cli-validation` skill before feature Done
