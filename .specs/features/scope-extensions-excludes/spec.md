# Milestone 48 — Scope Extensions & Artifact Excludes Specification

**Feature slug:** `scope-extensions-excludes`  
**Milestone:** ROADMAP M48  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/scope-extensions-excludes/context.md`](./context.md) — extensions + artifact excludes locked  
**Sisters:** [path-scoping](../path-scoping/spec.md) (M7), [path-config-dx](../path-config-dx/spec.md) (M30), [exclude-tests-by-default](../exclude-tests-by-default/spec.md) (M46)  
**Depth:** Small  
**Requirement IDs:** HOTSPOT-690 … HOTSPOT-709 (gaps OK)

## Problem Statement

Modern Node packages often ship dual-format sources (`.mjs` / `.cjs`) that today’s `ELIGIBLE_EXTENSIONS` (`.ts`/`.tsx`/`.js`/`.jsx`) skip, so churn and complexity for those entrypoints never enter rankings. Separately, M30 deferred common toolchain artifact dirs (`.turbo`, `.cache`, `.nuxt`, …) as YAGNI; those still inflate discovery walk / prune misses on Turbo/Nuxt/Vercel monorepos. M48 closes both gaps without touching M46 test-exclude policy.

## Goals

- [x] Add `.mjs` and `.cjs` to eligible source extensions end-to-end (discovery, complexity, git∩eligible intersection, enrich peer extensions)
- [x] Expand default **artifact** excludes with the locked M30 YAGNI-cut directory set
- [x] Leave M46 test patterns and `--include-tests` semantics unchanged
- [x] Document defaults in ARCHITECTURE / README; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                             | Reason                    |
| ------------------------------------------------------------------- | ------------------------- |
| `.mts` / `.cts`                                                     | YAGNI; not in ROADMAP     |
| Changing `DEFAULT_TEST_EXCLUDE_PATTERNS` / adding `*.test.mjs` etc. | **M46 owns** test globs   |
| `--no-default-excludes`                                             | M7 locked — forbidden     |
| New CLI flags or config keys                                        | Not required              |
| New fixture repo under `tests/fixtures/repos/`                      | Unit tests suffice        |
| Doctor scope inventory                                              | **M52**                   |
| Scoring / McCabe / coupling formula changes                         | Filter / eligibility only |
| JSON Schema / `version` bump                                        | Shape unchanged           |
| Replanning M46 / M47 / M50–M52                                      | Mission lock              |

---

## User Stories

### P1: Eligible `.mjs` / `.cjs` ⭐ MVP

**User Story**: As a developer scanning a dual-package Node repo, I want `.mjs` and `.cjs` sources discovered and scored like `.js` so ESM/CJS entrypoints appear in hotspot and coupling rankings when they churn.

**Why P1**: ROADMAP M48 primary accuracy item; single constant drives discovery + function-mode allowlist today.

**Acceptance Criteria**:

1. WHEN `ELIGIBLE_EXTENSIONS` is read THEN it SHALL equal `[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]` (order locked in [context.md](./context.md))
2. WHEN `discoverSourceFiles` runs (ls-files or walk fallback) THEN in-scope paths ending in `.mjs` or `.cjs` SHALL be included and paths with other extensions SHALL remain excluded as today
3. WHEN function-mode builds `pathAllowlist` via `buildFunctionModePathAllowlist(..., ELIGIBLE_EXTENSIONS)` THEN scoped git keys ending in `.mjs`/`.cjs` SHALL be eligible for AST + patch pathspecs
4. WHEN static enrich resolves peer / relative candidates THEN `.mjs` and `.cjs` SHALL be treated as source extensions consistently with `ELIGIBLE_EXTENSIONS` (no divergent hard-coded four-extension list)
5. WHEN a file is `.mts` or `.cts` THEN it SHALL **not** become eligible in M48

**Independent Test**: Unit tests on `ELIGIBLE_EXTENSIONS` + discover filter with temp/fixture paths `src/a.mjs`, `src/b.cjs`, `src/c.mts` (mts omitted); allowlist builder case with `.mjs` key; enrich extension list assertion or import of shared constant.

**Requirements**: HOTSPOT-690, HOTSPOT-691, HOTSPOT-692, HOTSPOT-693, HOTSPOT-694

---

### P1: Expanded artifact default excludes ⭐ MVP

**User Story**: As a developer scanning a Turbo/Nuxt/Vercel monorepo, I want common toolchain cache and output directories excluded by default so rankings stay focused on application source.

**Why P1**: ROADMAP M48 second item; promotes M30 YAGNI cuts into always-on artifact defaults.

**Acceptance Criteria**:

1. WHEN default artifact excludes are built THEN they SHALL include `**/.turbo/**`, `**/.vercel/**`, `**/.cache/**`, `**/.nuxt/**`, `**/.output/**`, `**/.parcel-cache/**`, and `**/tmp/**` in addition to existing M7/M30 artifact patterns
2. WHEN evaluating paths such as `apps/web/.turbo/cache/…`, `packages/app/.nuxt/dist/…`, or `tools/tmp/scratch.ts` under the default scope THEN `isPathInScope` SHALL return `false`
3. WHEN discovery walks the tree THEN directories matching those patterns SHALL be pruned via `shouldPruneDirectory` consistently with existing exclude prune semantics
4. WHEN M7/M30 artifact patterns and (post-M46) `DEFAULT_TEST_EXCLUDE_PATTERNS` are present THEN they SHALL remain unchanged by this milestone’s artifact append
5. WHEN the user passes `--exclude` or config `exclude` THEN those patterns SHALL remain additive on top of all defaults
6. WHEN `--include-tests` is used (post-M46) THEN the new artifact patterns SHALL **still** apply (not lifted)

**Independent Test**: Unit tests on artifact default export / `isPathInScope` / `shouldPruneDirectory` with nested representative paths; assert test-pattern constants untouched if exported.

**Requirements**: HOTSPOT-695, HOTSPOT-696, HOTSPOT-697, HOTSPOT-698

---

### P1: Documentation ⭐ MVP

**User Story**: As a maintainer, I want ARCHITECTURE and README to list the updated eligible extensions and artifact excludes so adopters know the defaults without reading source.

**Why P1**: Living docs rule; sister features always sync defaults.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE path-scoping / eligibility prose is read THEN it SHALL list `.mjs`/`.cjs` and the new artifact directory names (or patterns)
2. WHEN README path-scoping summary is read THEN it SHALL mention the expanded defaults at a glance
3. WHEN CONCERNS (or ARCHITECTURE) notes residual `*.test.mjs` / `*.spec.cjs` eligibility THEN it SHALL state that M46 test globs were not extended in M48

**Independent Test**: Doc review checklist in task Done when; no runtime test.

**Requirements**: HOTSPOT-699, HOTSPOT-700

---

## Edge Cases

- WHEN a legitimate source folder is named `tmp` (or `out`-class over-exclude) THEN default scope SHALL still exclude `**/tmp/**` — same acceptance class as M30 `**/out/**`; users may not rely on that folder name for in-scope source
- WHEN `.mjs` / `.cjs` files live under excluded artifact dirs THEN exclude SHALL win (not discovered)
- WHEN git records churn for `.mjs` but PathScope excludes the path THEN filtered git stats SHALL omit it (existing filter semantics)
- WHEN `foo.test.mjs` exists after extensions expand THEN M48 SHALL NOT auto-exclude it via test defaults (M46 ownership); document residual

---

## Requirement Traceability

| Requirement ID  | Story                                         | Phase | Status |
| --------------- | --------------------------------------------- | ----- | ------ |
| HOTSPOT-690     | P1: Eligible extensions — constant            | Done  | Tasks  |
| HOTSPOT-691     | P1: Eligible extensions — discovery           | Done  | Tasks  |
| HOTSPOT-692     | P1: Eligible extensions — function-mode ∩     | Done  | Tasks  |
| HOTSPOT-693     | P1: Eligible extensions — enrich SoT          | Done  | Tasks  |
| HOTSPOT-694     | P1: Eligible extensions — no `.mts`/`.cts`    | Done  | Tasks  |
| HOTSPOT-695     | P1: Artifact excludes — pattern set           | Done  | Tasks  |
| HOTSPOT-696     | P1: Artifact excludes — isPathInScope         | Done  | Tasks  |
| HOTSPOT-697     | P1: Artifact excludes — prune                 | Done  | Tasks  |
| HOTSPOT-698     | P1: Artifact excludes — no test-pattern churn | Done  | Tasks  |
| HOTSPOT-699     | P1: Docs — ARCHITECTURE/README                | Done  | Tasks  |
| HOTSPOT-700     | P1: Docs — residual test.mjs note             | Done  | Tasks  |
| HOTSPOT-701–709 | Reserved                                      | —     | —      |

**Coverage:** 11 mapped, 0 unmapped; 701–709 reserved.

---

## Success Criteria

- [x] `.mjs` / `.cjs` appear in discovery and function-mode allowlists when in scope
- [x] Locked artifact dirs are out of scope by default (including under `--include-tests`)
- [x] M46 test constants / CLI opt-in unchanged
- [x] `pnpm build && pnpm test` green
