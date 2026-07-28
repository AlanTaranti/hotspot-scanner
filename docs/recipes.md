# Recipes

Short copy-paste cookbooks for common **hotspot-scanner** workflows. Commands assume you have built the CLI from a clone (`pnpm install && pnpm build`); use `pnpm exec hotspot-scanner` from the repo root, or `hotspot-scanner` when the bin is on your `PATH`. Full flag and pipeline reference: [cli-reference.md](cli-reference.md).

Try any recipe against the bundled fixture:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
```

## Weekly triage

Rank files to refactor this sprint. Narrow the Git window and cap table rows so the report fits a stand-up or backlog grooming session.

```bash
hotspot-scanner scan . --since "3 months ago" --top 10
```

Focus on application source (tests are excluded by default):

```bash
hotspot-scanner scan . --since "3 months ago" --top 15 --include "src/**"
```

Audit test-suite health (include co-located tests and `__tests__/`):

```bash
hotspot-scanner scan . --since "3 months ago" --top 15 --include-tests
```

For a quieter CI or cron job (progress lines suppressed; warnings and errors still on stderr). When stderr is not a TTY (typical in CI), progress uses ASCII `#`/`-` fill bars on permanent newline-delimited lines — use `--quiet` to suppress them entirely:

```bash
hotspot-scanner scan . --since "3 months ago" --top 10 --quiet
```

By default, stderr warnings use **`--warnings summary`**: repeated rename / same-code lines collapse to one line per category (with count). JSON `meta.warnings` stays the full structured list either way.

When debugging rename confidence (ambiguous paths, unlinked delete+add pairs), opt into per-path detail:

```bash
hotspot-scanner scan . --since "3 months ago" --warnings=full
```

`--verbose` traces git spawn argv only — it does not expand warnings. Use `--warnings=full` for that. `--warnings` is CLI-only (not a config key).

**Tip:** Defaults are `12 months ago` and `--top 20`. Override with CLI flags or set `since` / `top` in `.hotspot-scanner.json` (CLI wins over config).

## PR markdown report

Generate a GitHub-flavored report you can attach to a pull request or paste into a review comment.

```bash
hotspot-scanner scan . --format markdown --output report.md
```

Slice to the top hotspots for a shorter attachment:

```bash
hotspot-scanner scan . --format markdown --output report.md --top 10
```

From a clone of this repo (fixture example):

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --format markdown --output /tmp/small-ts-report.md
```

Commit or upload `report.md` in your PR; the file includes hotspot tables with raw and normalized columns.

## Monorepo config

Share scan defaults across packages with **`.hotspot-scanner.json`**. Discovery walks **upward** from the scan target until it finds a file or hits the filesystem root; the nearest file wins.

### Scan from a package directory

When you `cd` into a package (no local `.git`) and run `hotspot-scanner scan .`, the tool remounts to the workspace git root and auto-includes that package prefix (e.g. `packages/api/**`). Pass `--include` to override scoping. Config discovery still starts from your cwd. An info `MONOREPO_PATH_REMOUNT` warning confirms the remount. No workspace manifest parsing (`pnpm-workspace.yaml`, nx, etc.) — path-only heuristic.

```bash
cd packages/api
hotspot-scanner scan .
# ranks packages/api/** only; emits MONOREPO_PATH_REMOUNT on stderr
```

To scan the whole monorepo from a package cwd, run from the git root or pass explicit `--include` globs.

**Workspace config** at the monorepo root:

```json
{
  "since": "6 months ago",
  "include": ["packages/**/src/**"],
  "top": 15
}
```

Scan a single package (parent config applies unless the package has its own file):

```bash
hotspot-scanner scan packages/api
```

**Package-local override** — `packages/api/.hotspot-scanner.json`:

```json
{
  "since": "3 months ago",
  "include": ["src/**"]
}
```

One-off scoping without editing config:

```bash
hotspot-scanner scan packages/web --include "src/**" --exclude "**/*.stories.tsx"
```

**CI with a fixed config** (skips parent walk):

```bash
hotspot-scanner scan . --config /ci/hotspot-scanner.json --since "3 months ago" --top 10
```

Validate config in CI without running a scan:

```bash
hotspot-scanner config validate /ci/hotspot-scanner.json
# or from repo root: hotspot-scanner config validate .
```

`format`, `output`, and `--warnings` are CLI-only and cannot be set in the config file.

## Excluding paths (no `.hotspotignore`)

**`.hotspotignore` is not supported.** There is no gitignore-style ignore file — use config `exclude` and/or CLI `--exclude` (repeatable globs, additive on built-in artifact and test excludes).

**One-off excludes** on the CLI:

```bash
hotspot-scanner scan . --exclude "**/*.stories.tsx" --exclude "legacy/**"
```

**Shared excludes** in `.hotspot-scanner.json`:

```json
{
  "since": "6 months ago",
  "include": ["src/**"],
  "exclude": ["**/*.stories.tsx", "legacy/**", "generated/**"]
}
```

Built-in artifact excludes (`node_modules`, `dist`, `.next`, and similar) always apply and cannot be disabled. Use `--include-tests` only to lift default test-file excludes — it does not bypass artifact or user excludes. See [README → Configuration](../README.md#configuration) for discovery and precedence (CLI > config > defaults).

## Exporting scan JSON for external tooling

Save full `ScanResult` JSON for scripts, dashboards, or archival — not for in-product compare (removed M71):

```bash
hotspot-scanner scan . --format json --output scan.json
```

Validate saved JSON programmatically with `parseScanResult` from `@vitals/hotspot-scanner`. **Do not use `--only`** when exporting JSON intended for downstream tools — filtered JSON omits required keys.

```bash
# Partial export for triage — may omit sections
hotspot-scanner scan . --only hotspots --format json --output hotspots-only.json
```

## Hotspot drill-down: scan → explain → trend

Use this workflow when a ranked hotspot needs more than a score — first understand *why* it ranks high, then see *how* indentation complexity evolved over Git history.

**1. Scan** — surface candidates:

```bash
hotspot-scanner scan . --since "12 months ago" --top 10
```

**2. Explain** — score breakdown on stderr (full report on stdout first):

```bash
hotspot-scanner scan . --explain src/api/handler.ts
```

On a match, stderr ends with a copy-paste next step:

```
next: hotspot-scanner trend src/api/handler.ts
```

**3. Trend** — historical indentation + NCLOC series with an automatic growth-pattern label:

```bash
hotspot-scanner trend src/api/handler.ts --since "10 years ago"
```

Table output includes `Pattern: <kind> — <summary>` above the sparklines. JSON (`--format json`) carries the same classification under `meta.growthPattern` (contract `version: "3.0"`). CSV stays metric-only — no pattern column.

Fixture walk-through from this repo:

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --explain src/high.ts
pnpm exec hotspot-scanner trend tests/fixtures/repos/trend-indent/src/trend.ts --since "10 years ago"
```

**Tips:**

- `--explain` uses full ranking arrays (ignores `--top`). Miss without `--fail-on-explain-miss` still exits `0`.
- `trend` does not load `.hotspot-scanner.json`; pass `--since` / `--max-revisions` on the CLI.
- Sparklines are indicative — see [Tornhill growth curves](#tornhill-growth-curves-trend-pattern) and formatter cliffs below.

## Scan → assess (batch deteriorating hotspots)

Use this when you want **which top hotspots look deteriorating** without running N manual `trend` commands. `assess` runs the full scan, filters by `hotspotScore`, caps candidates, then runs **sequential** per-file trends and classifies each with the same M75 growth-pattern rules as `trend`.

**Default triage** — dual-signal floor (`hotspotScore ≥ 0.7`) and up to 20 candidates:

```bash
hotspot-scanner assess .
```

**Tighter floor and fewer candidates** for a stand-up or sprint review:

```bash
hotspot-scanner assess . --min-hotspot-score 0.75 --top 10
```

**Narrow scope** (scan-backed `--since` / `--include` / `--exclude` follow scan semantics and config merge):

```bash
hotspot-scanner assess . --since "6 months ago" --include "src/**" --min-hotspot-score 0.7 --top 15
```

**Markdown or JSON** for PRs or automation (`kind: "hotspot-assess"`, `version: "1.0"` — separate from scan `3.0`):

```bash
hotspot-scanner assess . --format markdown --output assess.md --min-hotspot-score 0.7 --top 10
hotspot-scanner assess . --format json --output assess.json --min-hotspot-score 0.7 --top 10
```

Table and markdown reports show **summary pattern counts** for all candidates and a **detail section only for deteriorating** files. JSON includes compact candidate rows with `growthPattern` — no full revision `points` dump.

Fixture walk-through from this repo:

```bash
pnpm exec hotspot-scanner assess tests/fixtures/repos/small-ts --min-hotspot-score 0.5 --top 5
```

**Tips:**

- `--min-hotspot-score` is **CLI-only** (not a `.hotspot-scanner.json` key). Default `0.7`; must be in `[0, 1]`.
- `--top` caps candidates **after** the score filter on **all** formats (unlike scan JSON, which exports full arrays).
- Trends run **one file at a time** — expect scan time plus N× per-file trend cost. Use `--quiet` / `--no-progress` in CI; per-file progress shows `assess: [i/N] path` on stderr when enabled.
- Per-file trend failures are recorded on the candidate row and the batch **continues**; exit `0` unless usage/cancel errors.
- **Formatter cliffs:** mass re-indent or Prettier can false-label **deteriorating** — treat Pattern as indicative, not CI truth. See [Tornhill growth curves](#tornhill-growth-curves-trend-pattern).

## Tornhill growth curves (trend Pattern)

Why NCLOC + indentation as proxies (and how they differ for `scan` vs `trend`): [methodology.md](methodology.md).

Every successful `trend` run classifies the sampled series into one of four **growth patterns** (Adam Tornhill framing). Labels appear as `Pattern: <kind> — <summary>` in table output and in JSON `meta.growthPattern`.

| Kind | Meaning | Typical signal |
| ---- | ------- | -------------- |
| **deteriorating** | Indentation complexity is rising faster than file size | `indentMean` first→last rise ≥ 10%; summary compares mean vs `ncloc` growth |
| **refactored** | Complexity peaked mid-history then dropped | Peak `indentMean` not at last revision; drop from peak to end ≥ 18% |
| **stable** | Complexity stayed in a narrow band | Relative `indentMean` range within ~8% across the series |
| **inconclusive** | Too little history or no clear curve | Fewer than 5 sampled points, or mixed movement that does not match the rules above |

**Formatter cliffs:** A one-shot Prettier run or mass re-indent can spike `indentMean` and produce a false **deteriorating** or **refactored** label. Treat Pattern as a hint alongside sparklines and blame — not a gate. There is no special detector for format-only commits in M75/M77 (`assess` inherits the same classifier).

**Metrics reminder:** `indentMean` / `indentSd` / `indentMax` / `indentTotal` are whitespace-indentation proxies (not AST cyclomatic complexity). `ncloc` is file size at each revision.
