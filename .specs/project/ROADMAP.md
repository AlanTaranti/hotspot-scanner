# ROADMAP — @vitals/hotspot-scanner

Status: **M4 Scoring complete** (M1 scaffold + M2 + M3 + M4 implemented; M5+ pending).

## Milestone 1 — Scaffold

→ [`.specs/features/scaffold/spec.md`](../features/scaffold/spec.md)

- [ ] Package scripts (`build`, `test`), `vitest.config.ts`
- [ ] Module layout under `src/` and `bin/hotspot-scanner.ts` stub
- [ ] Domain types in `src/types/`
- [ ] Placeholder integration test wiring

## Milestone 2 — Git Change Miner

→ [`.specs/features/git-change-miner/spec.md`](../features/git-change-miner/spec.md)

- [x] Streaming parse of `git log --numstat --name-only`
- [x] `FileChangeStats` aggregation
- [x] `CoChangeEvent[]` extraction per commit
- [x] Rename handling (`old => new` + `PathAliasMap`)
- [x] Fixtures: real `git log` samples (merges, renames, deletes)

## Milestone 3 — Complexity Analyzer

→ [`.specs/features/complexity-analyzer/spec.md`](../features/complexity-analyzer/spec.md)

- [x] ts-morph adapter for `.ts`/`.tsx`/`.js`/`.jsx`
- [x] McCabe cyclomatic complexity (project-owned decision nodes)
- [x] Invalid syntax: warn and skip file
- [x] Fixture TS files with manually verified complexity values

## Milestone 4 — Scoring

→ [`.specs/features/scoring/spec.md`](../features/scoring/spec.md)

- [x] HotspotScorer: log-scale normalize complexity + churn, compute `hotspotScore`
- [x] TemporalCouplingScorer: `couplingStrength = coChangeCount / min(commitsA, commitsB)`
- [x] `DEFAULT_MIN_COCHANGE = 3` + minCochange threshold in scorer

## Milestone 5 — Reporter + CLI

- [ ] CLI table output (top hotspots + top coupling pairs)
- [ ] JSON output (`version`, `hotspots`, `coupling`)
- [ ] Flags: `--since`, `--format`, `--top`, `--min-cochange`
- [ ] Progress/warning logs for large repos

## Milestone 6 — Integration

- [ ] Full scan on versioned Git fixture repo
- [ ] Manual performance benchmark on large synthetic repo
- [ ] Coverage ≥80% on scoring and parsing modules
