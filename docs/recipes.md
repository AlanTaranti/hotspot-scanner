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
