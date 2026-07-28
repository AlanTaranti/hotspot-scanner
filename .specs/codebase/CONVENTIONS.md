# CONVENTIONS — @vitals/hotspot-scanner

## Language and modules

- **ESM only** — `"type": "module"` in `package.json`
- Import internal modules with `.js` extension in TypeScript source (Node ESM resolution)
- Cross-package imports use `#` aliases (`#scan`, `#types`, `#report`, …) from `package.json` `imports`
- Production `bin/*.ts` must use `#` aliases only — never `../src/` (compiled bin resolves under `dist/bin/`; see CONCERNS.md)
- `src/types/` — type definitions only; no runtime logic (excluded from coverage thresholds)

## Naming

- Package: `@vitals/hotspot-scanner`
- CLI binary: `hotspot-scanner` (unscoped, per ADR-2026-021)
- Requirement IDs: `HOTSPOT-*`
- Source files: kebab-case (`analyze-file.ts`, `run-assess.ts`)
- Factories: `create*` (`createGitMiner`, `createHotspotScorer`, `createReporter`); orchestration entrypoints: `run*` (`runScan`, `runAssess`, `runComplexityTrend`, `runDoctor`)

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

## Lint and format

| Script         | Command              | Notes                                                                             |
| -------------- | -------------------- | --------------------------------------------------------------------------------- |
| `lint`         | `eslint .`           | Flat config: `eslint.config.mjs`; ignores `dist/`, `coverage/`, `tests/fixtures/` |
| `format`       | `prettier --write .` | Mutates tree                                                                      |
| `format:check` | `prettier --check .` | CI-style check                                                                    |

Project **Done gate** remains `pnpm build && pnpm test` only (see AGENTS.md). Lint/format are recommended locally (CONTRIBUTING).

## CLI conventions

- Domain logic stays out of `bin/` — flag parsing and wiring only; invoke domain entrypoints (`runScan`, `runComplexityTrend`, `runAssess`, `runDoctor`, config/doctor helpers)
- Config: only `.hotspot-scanner.json`; precedence CLI > config > defaults
- Default `--since`: 12 months (show window in output)
- ANSI color: bin resolves `color: boolean` before pure `src/report/` formatters — see ARCHITECTURE.md § ANSI color ownership

## Commits

- Conventional Commits when user requests a commit
- Agents propose message; do not commit unless asked
