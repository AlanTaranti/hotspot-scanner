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
| 2026-07-22 | Expose **`authorCount`** (bus factor) in hotspot output | Derived from `FileChangeStats.authors` Set size; `authors` list remains internal (M9) |
| 2026-07-22 | Function-mode ranking: **hotspotScore with inherited file churn** | Same harmonic combiner as file mode; per-function McCabe + parent file `commitCount`; no per-function git history in v1 (M11). **Superseded for churn source by M23** (see 2026-07-23 hunk-overlap decision) — formula/normalization unchanged |
| 2026-07-23 | Function-mode churn: **hunk overlap** (M23) | For each commit touching a file, if any hunk intersects current `[line, endLine]`, count toward that function; nested → all N; only `--granularity function`; file mode stays numstat-only; no historical AST; JSON `version: "1.0"` shape unchanged. Specs: `.specs/features/per-function-churn/` (Status Planned) |
| 2026-07-23 | **`--top` scoped to table/markdown only** | JSON and CSV export full ranked arrays; `--top` ignored for machine-readable formats (M16). **Breaking change:** pre-M16 `--format json --top N` returned at most N items per array; post-M16 JSON always returns full arrays |
| 2026-07-23 | **`--format csv` → multi-file bundle (M18)** | **Breaking change** vs M17 multi-block single CSV. Stem from `--output`; sidecar `{stem}.meta.json` only; separate ranking/coupling CSVs; compare always emits 6 CSVs + meta (empty = header-only); `--format csv` **requires** `--output` (`CliUsageError` otherwise); no legacy flag / zip / BOM / emit-only-nonempty. Specs: `.specs/features/csv-bundle/` (Status Planned). Leave M17 Done/historical |
| 2026-07-23 | **CI Gate (M12) removed from roadmap** | `hotspotScore` is scan-relative (log1p + min-max); fail thresholds on normalized score are fragile for CI; no `--fail-on-*` gates planned |
| 2026-07-23 | **M21 config file: `.hotspot-scanner.json` only** | User locked — not `.hotspotrc`, not dual lookup. Precedence: CLI flags > config file > defaults. Keys: `since`, `include`, `exclude`, `granularity`, `minCochange`, `top`. Load from `repoPath` root only (no parent walk). Specs: `.specs/features/config-file/` |
| 2026-07-23 | **M14 enriched coupling: post-score boolean** | After `scoreCoupling`, set `hasStaticDependency` via relative import/export/require resolution (no ts-morph in scoring; no path aliases). Missing source → `false`. Additive under JSON `version: "1.0"`. Specs: `.specs/features/enriched-coupling/` |
| 2026-07-23 | **M20 schemas require `hasStaticDependency`** | Reject baselines missing the field (re-scan). Ajv preferred as devDependency for contract tests; deepen `parseScanResult`. Execute after M14. Specs: `.specs/features/json-contract/` |
| 2026-07-23 | **M14–M22 Execute complete** | M14 enriched coupling, M19 docs sync, M20 JSON schemas, M21 config file, M22 function AST coverage — all Done per ROADMAP |
| 2026-07-23 | **M23 planning complete** | Specs Planned — `per-function-churn` (HOTSPOT-181–193); Execute deferred to separate `orchestrator-implementer` session after Status promotion |
| 2026-07-23 | **M24 Package DX — Scope B + ESLint/Prettier** | Prep-only publish metadata; `files` includes `schemas/`; ESLint flat config; Prettier with `format` + `format:check`; `engines.node >= 22`; no CI, no `dev` script, no AGENTS.md gate change; registry vs Git-install stays Deferred. Specs: `.specs/features/package-dx/` (Status Planned, HOTSPOT-194–202) |
| 2026-07-23 | **M24 `repository.url` default** | No git remote / README URL at planning time — locked default `git+https://github.com/taranti/hotspot-scanner.git` in context.md; replace with origin at Execute if available |

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

## Active

- **Planning / next Execute:** M24 `package-dx` — specs Planned (HOTSPOT-194–202); promote `tasks.md` Status then `orchestrator-implementer` in a new session
- **Also Planned (prior):** M23 `per-function-churn` — specs Planned (HOTSPOT-181–193); Execute when prioritized

## Deferred

- npm private registry vs Git install distribution
