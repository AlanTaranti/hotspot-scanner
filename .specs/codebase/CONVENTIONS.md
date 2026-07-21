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

| Artifact | Compiler | Output |
|----------|----------|--------|
| `src/**` | `tsc` (`tsconfig.json`, `rootDir: src`, `outDir: dist`) | `dist/` |
| `bin/hotspot-scanner.ts` | `tsc -p tsconfig.bin.json` (separate project) | `dist/bin/` |

- **Do not** add `bin/` to root `tsconfig.json` `include` — use `tsconfig.bin.json`
- `pnpm build` runs `tsc && tsc -p tsconfig.bin.json`

## CLI conventions

- Domain logic stays out of `bin/` — only flag parsing and `runScan()` invocation
- Default `--since`: 12 months (proposed; show window in output)

## Commits

- Conventional Commits when user requests a commit
- Agents propose message; do not commit unless asked
