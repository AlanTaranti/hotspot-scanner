# STATE — @vitals/hotspot-scanner

Persistent memory for decisions, blockers, and lessons across sessions.

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-21 | **Vitest** over Jest | Already in `package.json`; no reason to switch |
| 2026-07-21 | Default `--since`: **12 months** | Aligns with large-repo scenario; user must see window in output |
| 2026-07-21 | Raw **commit count** for churn (not relative code churn) | Closed decision — see ADR rationale below |
| 2026-07-21 | **McCabe** implementation owned by project | ts-morph for AST only; no abandoned complexity packages |
| 2026-07-21 | Exit code **0** on successful scan (no fail thresholds in v1) | v1 non-goal for CI gate |
| 2026-07-21 | Cursor tooling adapted from vitals-arch workflow | Keep `vitals-*` skill names; retarget domain to hotspot-scanner |
| 2026-07-21 | **`child_process.spawn`** over `simple-git` for Git Miner | YAGNI — no new runtime dependency; streaming control in `src/git/spawn.ts` |
| 2026-07-21 | Rename via `old => new` line parsing + `PathAliasMap` | `git log --follow` does not work for global log mining (RT-003) |
| 2026-07-21 | Hotspot normalization: **log1p + min-max** per scan | User decision; dampens heavy-tailed churn/complexity (M4 context.md) |
| 2026-07-21 | Default `--min-cochange`: **3** (`DEFAULT_MIN_COCHANGE`) | User decision; filters noise pairs; CLI wiring in M5 |
| 2026-07-22 | Default `--top`: **20** (`DEFAULT_TOP`) | User confirmed; limits both hotspot and coupling rankings |
| 2026-07-22 | Hotspot combiner: **harmonic mean** `2ch/(c+h)` | Favors balanced dual-signal files over one-axis outliers; same log1p+min-max normalization (M8) |

## Architecture decisions (ADRs)

| ID | Decision | Rationale |
|----|----------|-----------|
| ADR-2026-018 | CLI standalone and self-contained | Decoupled from other tools; own release cycle |
| ADR-2026-019 | `ts-morph` + project-owned McCabe, TS/JS-only | Dedicated complexity packages abandoned 7–10 years; full control over decision-node definition |
| ADR-2026-020 | Single `git log` stream feeds churn and coupling | Half the I/O on large repos; one parser produces `FileChangeStats` + `CoChangeEvent[]` |
| ADR-2026-021 | CLI binary `hotspot-scanner` without npm scope | Standard pattern for scoped packages exposing a CLI |

### Alternatives considered and rejected

| Alternative | Rejected in favor of | Why |
|-------------|---------------------|-----|
| ESLint `complexity` rule + `eslintcc` | ADR-2026-019 (own McCabe) | Prefer direct control over metric definition over third-party rule config |
| Dedicated complexity packages (`ts-complex`, `escomplex`) | ADR-2026-019 | Unmaintained 7–10 years |
| LOC as complexity proxy | ADR-2026-019 | TS/JS scope enables real cyclomatic complexity via AST |
| External CLI (`lizard`) | ADR-2026-019 | Would add Python toolchain to Node project |
| Module integrated into another internal tool | ADR-2026-018 | Roadmap coupling unacceptable |
| Language-agnostic LOC-only approach | ADR-2026-019 | Defeats precision goal of v1 |
| Separate `git log` queries per signal | ADR-2026-020 | Doubles I/O cost on large repos (RT-001) |
| Relative code churn (`linesChanged / fileSize`) | Raw commit count (Decisions table) | Moving denominator problem; aggravates RT-003 rename distortion; closed for v1 |

## Blockers

_None._

## Lessons

- Vitest vs original Jest mention: document in TESTING.md, do not silently diverge.

## Deferred

- Worker-thread parallelization for large repos
- npm private registry vs Git install distribution
