# CONVENTIONS — @vitals/hotspot-scanner

## Language and modules

- **ESM only** — `"type": "module"` in `package.json`
- Import internal modules with `.js` extension in TypeScript source (Node ESM resolution)
- `src/types/` — type definitions only; no runtime logic (excluded from coverage thresholds)

## Naming

- Package: `@vitals/hotspot-scanner`
- CLI binary: `hotspot-scanner` (unscoped, per ADR-2026-021)
- Requirement IDs: `HOTSPOT-*`

## Tests

- Co-locate `*.test.ts` with the module under test
- Fixtures live in `tests/fixtures/` (not inside `src/`)

## Build conventions

| Artifact                 | Compiler                                                | Output      |
| ------------------------ | ------------------------------------------------------- | ----------- |
| `src/**`                 | `tsc` (`tsconfig.json`, `rootDir: src`, `outDir: dist`) | `dist/`     |
| `bin/hotspot-scanner.ts` | `tsc -p tsconfig.bin.json` (separate project)           | `dist/bin/` |

- **Do not** add `bin/` to root `tsconfig.json` `include` — use `tsconfig.bin.json`
- `pnpm build` runs `tsc && tsc -p tsconfig.bin.json`
- `pnpm typecheck` runs `tsc --noEmit && tsc --noEmit -p tsconfig.bin.json`

## Lint and format (M24)

| Script         | Command              | Notes                                                                             |
| -------------- | -------------------- | --------------------------------------------------------------------------------- |
| `lint`         | `eslint .`           | Flat config: `eslint.config.mjs`; ignores `dist/`, `coverage/`, `tests/fixtures/` |
| `format`       | `prettier --write .` | Mutates tree                                                                      |
| `format:check` | `prettier --check .` | CI-style check                                                                    |

Project **Done gate** remains `pnpm build && pnpm test` only (see AGENTS.md). Lint/format are recommended locally (CONTRIBUTING).

## Package metadata (M24)

- `engines.node`: `>=22`
- `files`: includes `dist`, `schemas`, `LICENSE`, `README.md` (schemas ship for M20 JSON contract consumers)

## CLI conventions

- Domain logic stays out of `bin/` — only flag parsing and `runScan()` invocation
- Default `--since`: 12 months (STATE decision; show window in output)
- ANSI color: resolved in `bin/hotspot-scanner.ts` (`resolveTableColor` scan table, `resolveDoctorColor` doctor text, `resolveTrendColor` trend table, `resolveAssessColor` assess table) → `color: boolean` passed into `src/report/` formatters; TTY stdout + empty/unset `NO_COLOR` + subcommand `--no-color` gates (+ no `--output` for table surfaces); doctor colors status prefixes only; trend colors Pattern kind only; assess bolds title/section and colors pattern kinds + scores

## Commits

- Conventional Commits when user requests a commit
- Agents propose message; do not commit unless asked
