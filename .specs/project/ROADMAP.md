# ROADMAP — @vitals/hotspot-scanner

Status: **M2 Git Change Miner complete** (M1 scaffold + M2 implemented; M3+ pending).

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

- [ ] ts-morph adapter for `.ts`/`.tsx`/`.js`/`.jsx`
- [ ] McCabe cyclomatic complexity (project-owned decision nodes)
- [ ] Invalid syntax: warn and skip file
- [ ] Fixture TS files with manually verified complexity values

## Milestone 4 — Scoring

- [ ] HotspotScorer: normalize complexity + churn, compute `hotspotScore`
- [ ] TemporalCouplingScorer: `couplingStrength = coChangeCount / min(commitsA, commitsB)`
- [ ] `--min-cochange` threshold

## Milestone 5 — Reporter + CLI

- [ ] CLI table output (top hotspots + top coupling pairs)
- [ ] JSON output (`version`, `hotspots`, `coupling`)
- [ ] Flags: `--since`, `--format`, `--top`, `--min-cochange`
- [ ] Progress/warning logs for large repos

## Milestone 6 — Integration

- [ ] Full scan on versioned Git fixture repo
- [ ] Manual performance benchmark on large synthetic repo
- [ ] Coverage ≥80% on scoring and parsing modules
