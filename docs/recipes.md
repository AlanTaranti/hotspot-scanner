# Recipes

Short copy-paste cookbooks for common **hotspot-scanner** workflows. Commands assume you have built the CLI from a clone (`pnpm install && pnpm build`); use `pnpm exec hotspot-scanner` from the repo root, or `hotspot-scanner` when the bin is on your `PATH`.

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

For a quieter CI or cron job (progress lines suppressed; warnings and errors still on stderr):

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

`format`, `output`, `baseline`, and `--warnings` are CLI-only and cannot be set in the config file.

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

## Baseline / compare

Save a JSON snapshot, then diff a later scan to see new, removed, and rank-changed **file hotspots**.

**Store baselines as CI artifacts** — do not commit large JSON snapshots to the repo. Upload the baseline from a scheduled or main-branch job and download it in PR compare jobs:

```yaml
# .github/workflows/hotspot.yml (illustrative)
jobs:
  baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install && pnpm build
      - run: pnpm exec hotspot-scanner baseline save . --output hotspot-baseline.json
      - uses: actions/upload-artifact@v4
        with:
          name: hotspot-baseline
          path: hotspot-baseline.json

  compare:
    needs: baseline
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: hotspot-baseline
      - run: pnpm install && pnpm build
      - run: pnpm exec hotspot-scanner compare . --baseline hotspot-baseline.json
```

**1. Capture baseline** (full, unfiltered `ScanResult` JSON)

```bash
hotspot-scanner scan . --format json --output baseline.json
# or: hotspot-scanner baseline save . --output baseline.json
```

**Do not use `--only` for baselines.** Section-filtered JSON omits required keys and fails baseline validation. Save from an unfiltered scan only — see [README → Section filter (`--only`)](../README.md#output-formats).

```bash
# Partial export for triage — NOT a valid baseline
hotspot-scanner scan . --only hotspots --format json --output hotspots-only.json
```

**2. Compare current tree**

Table delta on stdout:

```bash
hotspot-scanner scan . --baseline baseline.json
```

Markdown compare report for PRs or dashboards:

```bash
hotspot-scanner scan . --baseline baseline.json --format markdown --output compare.md
```

Full machine-readable delta (no `--top` slicing):

```bash
hotspot-scanner scan . --baseline baseline.json --format json --output compare.json
```

**CSV compare bundle** (writes `compare.meta.json` plus hotspot delta CSVs):

```bash
hotspot-scanner scan . --baseline baseline.json --format csv --output compare.csv
```

Use the same `--since` for baseline and current scans when you care about rank deltas; mismatched windows emit a `COMPARE_SINCE_MISMATCH` warning. Re-save the baseline after scanner upgrades that change the JSON shape (M57: `version: "3.0"` — baselines at `2.0`/`1.0`, with `coupling`, `cyclomaticComplexity`, or `functions` are rejected).

### Compare interpretation (delta triage, explain, strict)

Compare table and markdown include **delta-aware triage hints** by default (new dual-signal, rank worsened ≥5). Suppress with `--no-triage-hints`. JSON and CSV omit triage.

Explain a specific delta on stderr (stdout / `--output` unchanged):

```bash
hotspot-scanner compare . --baseline baseline.json --explain src/hot.ts
hotspot-scanner scan . --baseline baseline.json --explain src/hot.ts
```

Fail CI when baseline and current `--since` differ (report still written):

```bash
hotspot-scanner compare . --baseline baseline.json --strict
```

In GitHub Actions, add `--strict` to the compare step when you want mismatched windows to fail the job:

```yaml
      - run: pnpm exec hotspot-scanner compare . --baseline hotspot-baseline.json --strict
```

**Note:** Baselines captured before M46 (tests included) compared against a default scan (tests excluded) may show many "removed" test hotspots — expected; re-save the baseline or pass `--include-tests` on both legs for apples-to-apples test coverage.
