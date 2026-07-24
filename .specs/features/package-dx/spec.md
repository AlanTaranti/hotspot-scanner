# Milestone 24 — Package DX Specification

**Feature slug:** `package-dx`  
**Milestone:** ROADMAP M24  
**Depth:** Medium  
**Context:** [context.md](./context.md) (locked decisions — do not reopen)  
**Design:** [design.md](./design.md)

## Problem Statement

Contributor and publish-prep DX is incomplete: `package.json` has only `build`/`test` scripts and lacks `engines`, `files`, and `repository`; there is no ESLint or Prettier; CONTRIBUTING documents only the project gate. M20 deferred shipping `schemas/` via package `files` until this milestone. Maintainers need typecheck/lint/format tooling and publish metadata without changing the project gate or publishing to a registry.

## Goals

- [ ] Add `typecheck`, `lint`, `format`, and `format:check` scripts with concrete contracts
- [ ] Add publish-prep metadata: `engines.node >= 22`, `repository`, explicit `files` including `schemas/`
- [ ] Document typecheck/lint/format in CONTRIBUTING alongside the existing gate; keep “no CI in v1”
- [ ] Sync STACK.md / CONVENTIONS.md for ESLint/Prettier and note schemas ship via `files`
- [ ] Leave AGENTS.md quality gate as `pnpm build && pnpm test`

## Out of Scope

| Feature                                                           | Reason                                 |
| ----------------------------------------------------------------- | -------------------------------------- |
| Actual `npm publish` / release workflow                           | Prep-only (Scope B)                    |
| `publishConfig`                                                   | YAGNI until a real publish path exists |
| Registry vs Git-install distribution                              | Remains Deferred in STATE              |
| GitHub Actions or any CI pipeline                                 | Keep “no CI in v1”                     |
| `dev` script                                                      | YAGNI                                  |
| Changing AGENTS.md / quality-gates rule to require lint or format | Gate stays `pnpm build && pnpm test`   |
| Application behavior under `src/` / `bin/`                        | Package/tooling/docs only              |
| New LICENSE file                                                  | Already exists at repo root            |

---

## User Stories

### P1: typecheck script ⭐ MVP

**User Story**: As a contributor, I want `pnpm typecheck` so that I can verify TypeScript for `src/` and `bin/` without a full emit when iterating.

**Why P1**: Core DX script; mirrors dual-tsconfig build layout.

**Acceptance Criteria**:

1. WHEN `package.json` scripts are read THEN `typecheck` SHALL be defined as `tsc --noEmit && tsc --noEmit -p tsconfig.bin.json`
2. WHEN `pnpm typecheck` is run on a clean tree THEN it SHALL exit 0
3. WHEN type errors exist in `src/` or `bin/` THEN `pnpm typecheck` SHALL exit non-zero

**Independent Test**: Run `pnpm typecheck` after install; exit 0 on mainline.

**Requirements**: HOTSPOT-194

---

### P1: ESLint flat config + lint script ⭐ MVP

**User Story**: As a contributor, I want `pnpm lint` backed by ESLint flat config so that style and common TS issues are caught locally.

**Why P1**: Locked lint choice; missing entirely today.

**Acceptance Criteria**:

1. WHEN the repo root is inspected THEN an ESLint **flat** config file SHALL exist (`eslint.config.mjs` preferred, or `eslint.config.js` if consistently ESM)
2. WHEN `package.json` scripts are read THEN `lint` SHALL be `eslint .`
3. WHEN required ESLint-related packages are needed THEN they SHALL be added as **devDependencies** (e.g. `eslint`, `typescript-eslint`, and later prettier compatibility as designed)
4. WHEN `pnpm lint` is run on a clean tree after config lands THEN it SHALL exit 0 (fix or baseline any pre-existing violations in-scope for the config — do not leave a red lint script)

**Independent Test**: `pnpm lint` exits 0.

**Requirements**: HOTSPOT-195

---

### P1: Prettier + format scripts ⭐ MVP

**User Story**: As a contributor, I want `pnpm format` and `pnpm format:check` so that I can apply or verify Prettier formatting without guessing flags.

**Why P1**: Format is locked IN scope with write + check scripts.

**Acceptance Criteria**:

1. WHEN Prettier config is added THEN `.prettierrc` (or equivalent) and `.prettierignore` SHALL exist with sensible ignores (`node_modules/`, `dist/`, `coverage/`, lockfiles as needed)
2. WHEN `package.json` scripts are read THEN `format` SHALL be `prettier --write .` and `format:check` SHALL be `prettier --check .`
3. WHEN prettier is needed THEN it SHALL be a **devDependency**; ESLint SHALL not fight Prettier (use `eslint-config-prettier` or equivalent)
4. WHEN `pnpm format:check` is run on a clean tree after initial format THEN it SHALL exit 0

**Independent Test**: `pnpm format:check` exits 0; `pnpm format` is available.

**Requirements**: HOTSPOT-196

---

### P1: engines.node ⭐ MVP

**User Story**: As a package consumer, I want `engines.node` declared so that Node version expectations match the project’s Node 22+ stance.

**Why P1**: Publish prep; already documented in CONTRIBUTING prerequisites.

**Acceptance Criteria**:

1. WHEN `package.json` is read THEN `engines.node` SHALL be `">=22"`

**Independent Test**: `node -e "console.log(require('./package.json').engines.node)"` → `>=22` (or equivalent JSON read for ESM).

**Requirements**: HOTSPOT-197

---

### P1: repository metadata ⭐ MVP

**User Story**: As a package consumer, I want a `repository` field so that npm metadata points at the source git URL.

**Why P1**: Publish prep.

**Acceptance Criteria**:

1. WHEN `package.json` is read THEN `repository.type` SHALL be `"git"` and `repository.url` SHALL be a concrete `git+https://...` URL (default locked in [context.md](./context.md): `git+https://github.com/taranti/hotspot-scanner.git`, replaceable with real origin if present at Execute)
2. WHEN `repository` is set THEN it SHALL NOT be omitted or left as a placeholder/TBD string

**Independent Test**: Inspect `package.json` `repository` object.

**Requirements**: HOTSPOT-198

---

### P1: files allowlist including schemas/ ⭐ MVP

**User Story**: As an npm consumer (when the package is eventually published), I want `schemas/` included in the package `files` allowlist so that JSON Schema contracts ship with the package (closes M20 deferred thread).

**Why P1**: Scope B locked; closes json-contract publish note.

**Acceptance Criteria**:

1. WHEN `package.json` `files` is read THEN it SHALL be an explicit array including at least: `dist`, `schemas`, `LICENSE`, `README.md` (directory entries without trailing slash are fine)
2. WHEN `schemas/` is listed THEN both `schemas/scan-result.json` and `schemas/compare-result.json` SHALL be covered by that allowlist entry
3. WHEN `files` is set THEN it SHALL NOT omit `schemas` (repo-only schemas are no longer the publish story)

**Independent Test**: Inspect `package.json` `files`; confirm `schemas` present.

**Requirements**: HOTSPOT-199

---

### P1: CONTRIBUTING documents DX scripts ⭐ MVP

**User Story**: As a new contributor, I want CONTRIBUTING to document `typecheck` / `lint` / `format` / `format:check` alongside the required gate so that I know which commands to run locally without believing lint is mandatory for Done.

**Why P1**: ROADMAP bullet; reduces confusion with AGENTS.md gate.

**Acceptance Criteria**:

1. WHEN CONTRIBUTING “Quality gate” (or adjacent section) is read THEN the required bar SHALL remain `pnpm build && pnpm test`
2. WHEN CONTRIBUTING is read THEN it SHALL document recommended local steps: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (and mention `pnpm format` for applying fixes)
3. WHEN CONTRIBUTING mentions CI THEN it SHALL keep the stance that there is **no CI in v1**
4. WHEN CONTRIBUTING is updated THEN it SHALL NOT claim lint/format are part of the AGENTS.md / project Done gate

**Independent Test**: Manual review / grep of CONTRIBUTING.md.

**Requirements**: HOTSPOT-200

---

### P1: Living docs — STACK / CONVENTIONS + schemas shipping ⭐ MVP

**User Story**: As an agent or maintainer, I want STACK and CONVENTIONS to record ESLint/Prettier and that schemas ship via package `files` so that living docs match tooling reality.

**Why P1**: context-first / living docs rule.

**Acceptance Criteria**:

1. WHEN STACK.md “Dev dependencies” (or equivalent) is read THEN ESLint and Prettier SHALL be listed with roles
2. WHEN CONVENTIONS.md is read THEN lint/format expectations SHALL be summarized (scripts + flat config / Prettier; gate still build+test)
3. WHEN docs mention schemas packaging THEN they SHALL note that `schemas/` is included in package `files` (publish prep)

**Independent Test**: Doc grep for ESLint, Prettier, and `files`/`schemas` packaging note.

**Requirements**: HOTSPOT-201

---

### P1: Project gate unchanged ⭐ MVP

**User Story**: As a maintainer, I want AGENTS.md and the quality-gates rule to keep requiring only `pnpm build && pnpm test` so that M24 does not silently raise the Done bar.

**Why P1**: Explicit locked non-goal; prevents scope creep.

**Acceptance Criteria**:

1. WHEN AGENTS.md quality gate section is checked after M24 THEN it SHALL still state `pnpm build && pnpm test` without requiring lint/format
2. WHEN `.cursor/rules/quality-gates.mdc` is checked THEN it SHALL remain aligned (build + test only)
3. WHEN verification runs THEN `pnpm build && pnpm test` SHALL pass in addition to the new DX scripts

**Independent Test**: Grep AGENTS.md / quality-gates.mdc; run project gate.

**Requirements**: HOTSPOT-202

---

## Edge Cases

- WHEN ESLint initially reports violations on existing sources THEN implementer SHALL fix or configure narrowly so `pnpm lint` is green — do not leave a known-failing script
- WHEN Prettier would reformat large trees THEN initial `pnpm format` in Execute is allowed; keep diffs focused on tooling unless format churn is required for `format:check` green
- WHEN `files` allowlist is wrong THEN `dist/` CLI/bin outputs and `schemas/` MUST still be included — do not publish-prep with schemas omitted
- WHEN no git remote exists THEN use the locked default `repository.url` from context.md

---

## Requirement Traceability

| Requirement ID | Story                                  | Phase | Status  |
| -------------- | -------------------------------------- | ----- | ------- |
| HOTSPOT-194    | P1: typecheck script                   | Tasks | Pending |
| HOTSPOT-195    | P1: ESLint + lint                      | Tasks | Pending |
| HOTSPOT-196    | P1: Prettier + format scripts          | Tasks | Pending |
| HOTSPOT-197    | P1: engines.node                       | Tasks | Pending |
| HOTSPOT-198    | P1: repository metadata                | Tasks | Pending |
| HOTSPOT-199    | P1: files including schemas/           | Tasks | Pending |
| HOTSPOT-200    | P1: CONTRIBUTING DX docs               | Tasks | Pending |
| HOTSPOT-201    | P1: STACK / CONVENTIONS + schemas ship | Tasks | Pending |
| HOTSPOT-202    | P1: Project gate unchanged             | Tasks | Pending |

**ID format:** `HOTSPOT-*` (M24 range **194–202**; M23 ended at HOTSPOT-193)

**Coverage:** 9 total, 9 mapped to tasks (see tasks.md), 0 unmapped

---

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check` exit 0
- [ ] `package.json` has `engines`, `repository`, and `files` including `schemas`
- [ ] CONTRIBUTING documents DX scripts; still says no CI in v1; gate remains build+test
- [ ] STACK / CONVENTIONS updated; AGENTS.md gate unchanged
- [ ] `pnpm build && pnpm test` still passes
