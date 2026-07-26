# STACK — @vitals/hotspot-scanner

## Runtime

| Component       | Version / choice              |
| --------------- | ----------------------------- |
| Node.js         | 22+ (`@tsconfig/node22`)      |
| TypeScript      | 6.x (ESM, `"type": "module"`) |
| Package manager | pnpm                          |

## Dependencies

| Library     | Role                                            |
| ----------- | ----------------------------------------------- |
| `commander` | CLI argument parsing (`bin/hotspot-scanner.ts`) |
| `picomatch` | Glob matching for path scoping (`src/paths/`)   |

NCLOC size analysis uses plain file reads in `src/complexity/` (no AST runtime dependency). Optional parallel batches via Node `worker_threads` (built-in).

Git log invocation uses `child_process.spawn` in `src/git/` (no `simple-git`).

## Dev dependencies

| Library                                     | Role                                        |
| ------------------------------------------- | ------------------------------------------- |
| `vitest`                                    | Unit and integration tests                  |
| `@vitest/coverage-v8`                       | Coverage reporting                          |
| `@types/node`                               | Node type definitions                       |
| `eslint`, `typescript-eslint`, `@eslint/js` | Lint (`pnpm lint`)                          |
| `prettier`, `eslint-config-prettier`        | Format (`pnpm format`, `pnpm format:check`) |
| `globals`                                   | ESLint Node globals for flat config         |
| `ajv`                                       | JSON Schema contract tests (M20)            |

## Package publish prep (M24 + M55)

- `package.json` `files` includes `dist/`, `schemas/`, `LICENSE`, `README.md`, `SECURITY.md`
- `engines.node` is `>=22`; `repository` points at the git remote URL

## Build

- `tsc` compiles `src/**` → `dist/`
- `bin/hotspot-scanner.ts` compiled via `tsc -p tsconfig.bin.json` → `dist/bin/`
- `pnpm typecheck` mirrors dual-tsconfig layout with `--noEmit`

## Not in stack

- skott, graphology, Louvain — vitals-arch only; not used here
- Network services, databases, dashboards
