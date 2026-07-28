# STACK — @taranti/hotspot-scanner

Package `@taranti/hotspot-scanner`, CLI bin `hotspot-scanner`, license MIT.

## Runtime

| Component       | Version / choice                                               |
| --------------- | -------------------------------------------------------------- |
| Node.js         | 22+ (`.nvmrc` `22`, `engines.node` `>=22`, `@tsconfig/node22`) |
| TypeScript      | 6.x (ESM, `"type": "module"`)                                  |
| Package manager | pnpm (`package.json` `"packageManager": "pnpm@11.9.0"`)        |
| Editor defaults | `.editorconfig` (utf-8, lf, 2-space indent)                    |

## Dependencies

| Library     | Role                                            |
| ----------- | ----------------------------------------------- |
| `commander` | CLI argument parsing (`bin/hotspot-scanner.ts`) |
| `picomatch` | Glob matching for path scoping (`src/paths/`)   |

NCLOC size analysis uses plain file reads in `src/complexity/` (no AST runtime dependency). Optional parallel batches via Node `worker_threads` (built-in).

Git log invocation uses `child_process.spawn` in `src/git/` (no `simple-git`).

## Dev dependencies

| Library                                     | Role                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `@tsconfig/node22`                          | Shared TypeScript base config for Node 22                    |
| `vitest`                                    | Unit and integration tests                                   |
| `@vitest/coverage-v8`                       | Coverage reporting                                           |
| `@types/node`                               | Node type definitions                                        |
| `@types/picomatch`                          | Type definitions for `picomatch`                             |
| `eslint`, `typescript-eslint`, `@eslint/js` | Lint (`pnpm lint`)                                           |
| `prettier`, `eslint-config-prettier`        | Format (`pnpm format`, `pnpm format:check`)                  |
| `globals`                                   | ESLint Node globals for flat config                          |
| `ajv`                                       | JSON Schema contract tests only (not runtime CLI validation) |

## Package publish

- `package.json` `files` includes `dist/`, `schemas/`, `LICENSE`, `README.md`, `SECURITY.md`
- `engines.node` is `>=22`; `repository` points at the git remote URL
- `exports` schema subpaths: `./schemas/scan-result.json`, `./schemas/hotspot-scanner-config.json`, `./schemas/complexity-trend.json`, `./schemas/hotspot-assess.json`

## Build

- `pnpm build` → invalidate stale `tsconfig.tsbuildinfo` if `dist/` missing, then `tsc -b tsconfig.bin.json` (lib `src/**` → `dist/`, then `bin/` → `dist/bin/` via project references)
- `pnpm clean` → removes `dist/` and `tsconfig.tsbuildinfo` (deleting only `dist/` leaves a stale incremental cache and breaks the next build with TS6305)
- `pnpm typecheck` mirrors dual-tsconfig layout with `--noEmit`
- `pnpm verify` → `pnpm build && pnpm test && pnpm lint && pnpm format:check` (required Done/CI gate)

## CI

- GitHub Actions workflow `.github/workflows/ci.yml` on push/PR to `main`: Node from `.nvmrc`, pnpm via `packageManager`, `pnpm install --frozen-lockfile`, then `pnpm verify`

## Not in stack

- skott, graphology, Louvain — vitals-arch only; not used here
- ts-morph / AST McCabe — NCLOC is plain file read + state machine
- Network services, databases, dashboards
