# STACK — @vitals/hotspot-scanner

## Runtime

| Component | Version / choice |
|-----------|------------------|
| Node.js | 22+ (`@tsconfig/node22`) |
| TypeScript | 6.x (ESM, `"type": "module"`) |
| Package manager | pnpm |

## Dependencies (planned)

| Library | Role |
|---------|------|
| `ts-morph` | AST access for complexity analysis |
| `commander` | CLI argument parsing (TBD) |
| `simple-git` or `child_process` | Git log invocation |

## Dev dependencies

| Library | Role |
|---------|------|
| `vitest` | Unit and integration tests |
| `@vitest/coverage-v8` | Coverage reporting |
| `@types/node` | Node type definitions |

## Build

- `tsc` compiles `src/**` → `dist/`
- `bin/hotspot-scanner.ts` compiled via `tsc -p tsconfig.bin.json` → `dist/bin/`

## Not in stack

- skott, graphology, Louvain — vitals-arch only; not used here
- Network services, databases, dashboards
