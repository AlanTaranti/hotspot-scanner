# STATE — @taranti/hotspot-scanner

Persistent memory for decisions, blockers, and lessons across sessions.

**Last Updated:** 2026-07-28
**Current Work:** M79 + M80 Done — package-scope-rename + github-repo-identity; see ROADMAP Current

Archive of chronological Execute rows: [STATE-ARCHIVE.md](STATE-ARCHIVE.md).

## Active

**M79 Done** — [package-scope-rename](../features/package-scope-rename/spec.md) (`@taranti/hotspot-scanner`). **M80 Done** — [github-repo-identity](../features/github-repo-identity/spec.md) (live GitHub URLs → `AlanTaranti/hotspot-scanner`). Prior band M7–M78 Done. Deferred horizon: see § Deferred. Milestone status: [ROADMAP.md](ROADMAP.md) **Current**.

## Blockers

_None._

## Deferred

- **npm publish / npx / `pnpm dlx` install path** — future backlog (out of M37–M45 / M62–M70). Decide private registry vs public npm vs Git-only later; until then official use path is GitHub clone + pnpm build.
- **CI recipes / fail-on stable deltas / SARIF** (DX items 20–23) — not in shipped DX batches
- **Item C — full warning lines in scan report body** — deferred past M68 bookend + M73 top-only rollups
- **Fail-on-warning CI gates** — deferred (not M68)
- **`--fail-on-deteriorating` / SARIF for assess** — deferred past M77 MVP
- **Historical AST post-rename** (item 28 / Post-M46 accuracy ask) — **do not prioritize**; M26 avisos only; no milestone number (CONCERNS unmitigated matrix). True fix = per-commit function ranges — effort A.

## Decisions

Lasting product locks. Chronological Execute / Planned→Done rows: [STATE-ARCHIVE.md](STATE-ARCHIVE.md).

| Date       | Decision                                                            | Rationale                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-28 | GitHub owner **`AlanTaranti`**; npm scope **`@taranti`** (distinct) | Real remote is `github.com/AlanTaranti/hotspot-scanner`; npm rename stays M79 `@taranti` — names intentionally differ; do not “fix” one to the other; live surfaces only (historical Done specs / CI out of M80) |
| 2026-07-28 | npm package scope **`@taranti`** (`@taranti/hotspot-scanner`)       | Match author/npm ownership axis; bin stays `hotspot-scanner` (ADR-2026-021); Cursor skill folders stay `vitals-*` (2026-07-21); no npm publish in M79 (Deferred); GitHub owner is separately `AlanTaranti`       |
| 2026-07-21 | **Vitest** over Jest                                                | Already in `package.json`; no reason to switch                                                                                                                                                                   |
| 2026-07-21 | Default `--since`: **12 months**                                    | Aligns with large-repo scenario; user must see window in output                                                                                                                                                  |
| 2026-07-21 | Raw **commit count** for churn (not relative code churn)            | Moving denominator problem; aggravates rename distortion; closed (see Alternatives)                                                                                                                              |
| 2026-07-21 | Exit code **0** on successful scan (no fail-on-score gates)         | `hotspotScore` is scan-relative; CI fail thresholds on normalized score are fragile                                                                                                                              |
| 2026-07-21 | Cursor tooling adapted from vitals-arch workflow                    | Keep `vitals-*` skill names; retarget domain to hotspot-scanner                                                                                                                                                  |
| 2026-07-21 | **`child_process.spawn`** over `simple-git` for Git Miner           | YAGNI — no new runtime dependency; streaming control in `src/git/spawn.ts`                                                                                                                                       |
| 2026-07-21 | Rename via `old => new` line parsing + `PathAliasMap`               | `git log --follow` does not work for global log mining (RT-003)                                                                                                                                                  |
| 2026-07-21 | Hotspot normalization: **log1p + min-max** per scan                 | Dampens heavy-tailed churn/size                                                                                                                                                                                  |
| 2026-07-22 | Default `--top`: **20** (`DEFAULT_TOP`)                             | Limits hotspot ranking (and assess candidate slice)                                                                                                                                                              |
| 2026-07-22 | Hotspot combiner: **harmonic mean** `2ch/(c+h)`                     | Favors balanced dual-signal files over one-axis outliers                                                                                                                                                         |
| 2026-07-22 | Expose **`authorCount`** (bus factor); `authors` list internal      | Derived from `FileChangeStats.authors` Set size                                                                                                                                                                  |
| 2026-07-23 | **`--top` scoped to table/markdown only**                           | JSON and CSV export full ranked arrays; `--top` ignored for machine-readable formats                                                                                                                             |
| 2026-07-23 | **`--format csv` → multi-file bundle**; requires `--output`         | Stem from `--output`; sidecar `{stem}.meta.json`; no zip/BOM. Specs: `.specs/features/csv-bundle/`                                                                                                               |
| 2026-07-23 | Config file: **`.hotspot-scanner.json` only**                       | Not `.hotspotrc`, not dual lookup. Precedence: CLI > config > defaults. Scan params only; parent walk + `--config`                                                                                               |
| 2026-07-24 | **`format` / `output` / hooks stay CLI-only**                       | Rendering/transport not in config (M21 lock)                                                                                                                                                                     |
| 2026-07-24 | Tests **excluded by default**; `--include-tests` opt-in             | Intentional breaking default — rankings omit test paths unless opted in                                                                                                                                          |
| 2026-07-24 | **`--verbose` = git argv only**                                     | Spawn-layer argv trace; not full debug logging; `--quiet` wins                                                                                                                                                   |
| 2026-07-24 | Pipeline overlap opt-out: **`--sequential`** (`--no-overlap` alias) | CLI-only; default file-mode overlap unchanged                                                                                                                                                                    |
| 2026-07-26 | **Hard cut: remove temporal coupling** (M56)                        | No pairs/scoring/static enrich/CLI/JSON `coupling`; scan JSON → `"2.0"` then `"3.0"` with M57; leave historical Done specs untouched                                                                             |
| 2026-07-26 | **Size axis = NCLOC** (not McCabe); function mode hard cut (M57)    | File-level non-commented lines; no `--granularity` / function ranking / `ts-morph`; scan JSON `"3.0"` with `ncloc`                                                                                               |
| 2026-07-26 | **`--warnings` default = summary**; CLI-only                        | Collapse repeated codes on stderr; `meta.warnings` / `onWarning` stay full; no config key                                                                                                                        |
| 2026-07-26 | TTY progress = overwrite + clear; honest bars + finalize            | No fake overall %; clear-to-EOL; quiet/no-progress unchanged                                                                                                                                                     |
| 2026-07-26 | Table File column = **middle-ellipsis**                             | Prefix + basename; width from `stdout.columns` (fallback 24)                                                                                                                                                     |
| 2026-07-26 | Init exemplar = **`$schema` + `$comments`** (not JSONC)             | Editor schema + in-file hints; reserved meta keys not merged / not UNKNOWN_CONFIG_KEY                                                                                                                            |
| 2026-07-26 | Contract enrich = **additive under scan `3.0`**                     | `meta.scannerVersion` / `$schema` without forced re-scan bump                                                                                                                                                    |
| 2026-07-27 | Warnings/Timing rollups = **exec summary only** (M73)               | No pre-write stderr teaser; keep post-write `flushWarnings` detail                                                                                                                                               |
| 2026-07-27 | **Hard cut: remove compare/baseline** (M71)                         | No shim/deprecation; public API keeps `parseScanResult` only; scan stays `"3.0"`; delete compare schema                                                                                                          |
| 2026-07-27 | **`trend` ≠ scan**; Tornhill indent (4 spaces / tab)                | Sibling command + own schema; ASCII sparklines; blank lines ignored                                                                                                                                              |
| 2026-07-27 | Growth Pattern always-on on `trend`                                 | No `--classify` flag; complexity-trend JSON `3.0`                                                                                                                                                                |
| 2026-07-27 | **Dedicated `assess`** (not `scan --trend-top`)                     | Own CLI + schema `hotspot-assess` `1.0`; sequential trends + soft-continue; `--min-hotspot-score` (not `--min-score`); CLI-only                                                                                  |
| 2026-07-27 | Color flags **subcommand-only** (doctor / trend / assess)           | TTY + `--no-color` + `NO_COLOR`; do not hoist to program-global; color status/pattern/score tokens only — not paths/bodies                                                                                       |
| 2026-07-27 | Write confirm on stderr after `--output` / `--csv-single-file`      | `--quiet` suppresses; no new flags                                                                                                                                                                               |

## Architecture decisions (ADRs)

| ID           | Decision                                                                                     | Rationale                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-2026-018 | CLI standalone and self-contained                                                            | Decoupled from other tools; own release cycle                                                                                                                                                                                                           |
| ADR-2026-019 | ~~`ts-morph` + project-owned McCabe, TS/JS-only~~ → **Superseded by M57: NCLOC file metric** | Originally: dedicated complexity packages abandoned 7–10 years; McCabe decision-node control (RT-005). **M57 Done:** product size axis is **NCLOC** (non-commented lines via state-machine scanner); McCabe + function mode retired; `ts-morph` removed |
| ADR-2026-020 | Single `git log` stream feeds churn only                                                     | Half the I/O vs per-signal queries on large repos (RT-001); one parser produces `FileChangeStats`. Pre-M56 also aggregated `pairCounts` for coupling (M32) — removed in M56                                                                             |
| ADR-2026-021 | CLI binary `hotspot-scanner` without npm scope                                               | Standard pattern for scoped packages exposing a CLI                                                                                                                                                                                                     |

### Alternatives considered and rejected

| Alternative                                                 | Rejected in favor of                      | Why                                                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ESLint `complexity` rule + `eslintcc`                       | ADR-2026-019 (own McCabe) → M57 NCLOC     | Prefer direct control over metric definition over third-party rule config; McCabe path retired in M57                          |
| Dedicated complexity packages (`ts-complex`, `escomplex`)   | ADR-2026-019 → M57 NCLOC                  | Unmaintained 7–10 years; M57 does not revive them                                                                              |
| LOC as complexity proxy                                     | ~~ADR-2026-019 (McCabe)~~ → **M57 NCLOC** | v1 rejected raw LOC for AST McCabe; **M57 product metric is NCLOC** (file-level non-commented lines — not raw LOC, not McCabe) |
| External CLI (`lizard`)                                     | ADR-2026-019 → M57 NCLOC                  | Would add Python toolchain to Node project                                                                                     |
| Module integrated into another internal tool                | ADR-2026-018                              | Roadmap coupling unacceptable                                                                                                  |
| Language-agnostic LOC-only approach                         | ADR-2026-019 → M57 NCLOC scanner          | v1 precision goal via AST superseded; M57 still TS/JS-scoped NCLOC with comment/string-aware counting                          |
| Separate `git log` queries per signal                       | ADR-2026-020                              | Doubles I/O cost on large repos (RT-001)                                                                                       |
| Relative code churn (`linesChanged / fileSize`)             | Raw commit count (Decisions table)        | Moving denominator problem; aggravates RT-003 rename distortion; closed for v1                                                 |
| `format` / `output` / `baseline` in `.hotspot-scanner.json` | CLI-only (M21)                            | Rendering/transport stay in CLI; config holds scan parameters only (Post-M46 reject)                                           |
| Soft-deprecate McCabe / keep function mode                  | M57 hard cut                              | Parity with M56; YAGNI on dual metrics and empty `functions: []`                                                               |

## Lessons

- Vitest vs original Jest mention: document in TESTING.md, do not silently diverge.
- Hard cuts (M56 coupling, M57 McCabe/function mode, M71 compare/baseline) beat soft deprecation for this CLI — update living docs + schemas in the same Execute; leave historical Done feature specs untouched.
- Prefer **additive** fields under an existing JSON `version` (M66 under scan `3.0`) when consumers would otherwise be forced to re-scan; bump `version` only for hard shape breaks (M56→`2.0`, M57→`3.0`, trend M75→`3.0`).
- Three contract spaces coexist: scan `3.0`, complexity-trend `3.0`, hotspot-assess `1.0` — document all three in PROJECT/ARCHITECTURE to avoid agents conflating them.
