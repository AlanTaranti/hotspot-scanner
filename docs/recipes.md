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

Focus on application source and skip tests:

```bash
hotspot-scanner scan . --since "3 months ago" --top 15 --include "src/**" --exclude "**/*.test.ts"
```

For a quieter CI or cron job (progress lines suppressed; warnings and errors still on stderr):

```bash
hotspot-scanner scan . --since "3 months ago" --top 10 --quiet
```

**Tip:** Defaults are `12 months ago` and `--top 20`. Override with CLI flags or set `since` / `top` in `.hotspot-scanner.json` (CLI wins over config).

## PR markdown report

Generate a GitHub-flavored report you can attach to a pull request or paste into a review comment.

```bash
hotspot-scanner scan . --format markdown --output report.md
```

Slice to the top hotspots and coupling pairs for a shorter attachment:

```bash
hotspot-scanner scan . --format markdown --output report.md --top 10
```

From a clone of this repo (fixture example):

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --format markdown --output /tmp/small-ts-report.md
```

Commit or upload `report.md` in your PR; the file includes hotspot and coupling tables with raw and normalized columns.

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
  "exclude": ["**/*.test.ts", "**/*.spec.ts"],
  "top": 15,
  "minCochange": 3
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
  "include": ["src/**"],
  "exclude": ["**/__tests__/**"]
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

`format`, `output`, and `baseline` are CLI-only and cannot be set in the config file.

## Baseline / compare

Save a JSON snapshot, then diff a later scan to see new, removed, and rank-changed hotspots and coupling pairs.

**1. Capture baseline**

```bash
hotspot-scanner scan . --format json --output baseline.json
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

**CSV compare bundle** (writes `compare.meta.json` plus six data CSVs):

```bash
hotspot-scanner scan . --baseline baseline.json --format csv --output compare.csv
```

Use the same `--since` and `--granularity` for baseline and current scans when you care about rank deltas; mismatched windows may emit a `COMPARE_SINCE_MISMATCH` warning. Re-save the baseline after scanner upgrades that change the JSON shape.
