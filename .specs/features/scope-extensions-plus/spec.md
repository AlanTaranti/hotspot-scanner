# Milestone 67 — Scope Extensions Plus Specification

**Feature slug:** `scope-extensions-plus`  
**Milestone:** ROADMAP M67  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/scope-extensions-plus/context.md`](./context.md) — residual test globs + `.mts`/`.cts` locked  
**Sisters:** [exclude-tests-by-default](../exclude-tests-by-default/spec.md) (M46), [scope-extensions-excludes](../scope-extensions-excludes/spec.md) (M48)  
**Depth:** Medium  
**IDs:** HOTSPOT-1200–1229 (1216–1229 reserved)

## Problem Statement

After M48, `.mjs`/`.cjs` sources enter rankings, but M46’s built-in test excludes still cover only `.ts`/`.tsx`/`.js`/`.jsx` — so `foo.test.mjs` / `bar.spec.cjs` can pollute hotspot lists (documented residual in CONCERNS/STATE/README). Separately, dual-package TypeScript (`.mts`/`.cts`) remains ineligible despite being the TypeScript analogue of the M48 ESM/CJS extension work. M67 closes both gaps without new ignore-file machinery or artifact-exclude churn.

## Goals

- [ ] Extend `DEFAULT_TEST_EXCLUDE_PATTERNS` with ESM/CJS and TS-module test/spec globs (locked set in [context.md](./context.md))
- [ ] Add `.mts` and `.cts` to `ELIGIBLE_EXTENSIONS` for discovery, NCLOC, and scoring ∩ PathScope-filtered git churn
- [ ] Keep `--include-tests` / artifact-exclude semantics unchanged aside from the expanded test list
- [ ] Sync living docs and clear the CONCERNS residual row; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| `.hotspotignore` | Mission lock — deferred ignore-file work |
| Workspace yaml parsers | Mission lock |
| Changing artifact exclude dirs | Mission lock — test globs / eligible ext only |
| New CLI flags or config keys | `--include-tests` already sufficient |
| New fixture repo under `tests/fixtures/repos/` | Unit tests suffice |
| Scoring / NCLOC formula changes | Eligibility / filter only |
| JSON Schema / `version` bump | Shape unchanged |
| Editing ROADMAP/STATE in planning session | Mission lock — Execute Done owns sync |

---

## User Stories

### P1: Residual + TS-module test excludes ⭐ MVP

**User Story**: As a developer scanning a dual-package Node/TS repo, I want co-located `*.test.mjs` / `*.spec.cjs` (and `.mts`/`.cts` test siblings) excluded by default so rankings stay focused on application source after those extensions are eligible.

**Why P1**: Closes the documented M46/M48 residual and prevents a new residual when `.mts`/`.cts` land.

**Acceptance Criteria**:

1. WHEN `DEFAULT_TEST_EXCLUDE_PATTERNS` is read THEN it SHALL equal the locked array in [context.md](./context.md) (existing eight + `__tests__` + eight new globs)
2. WHEN evaluating paths such as `src/foo.test.mjs`, `src/bar.spec.cjs`, `src/a.test.mts`, or `src/b.spec.cts` under the default scope THEN `isPathInScope` SHALL return `false`
3. WHEN `createPathScope({ includeTests: true })` is used THEN those new test paths SHALL be in scope (unless user/config `--exclude` still matches)
4. WHEN `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` is read THEN it SHALL be unchanged by this milestone
5. WHEN user/config `--exclude` is provided THEN it SHALL remain additive on top of defaults

**Independent Test**: Unit tests on exported constants + `isPathInScope` / `includeTests` cases in `scope.test.ts`.

**Requirements:** HOTSPOT-1200, HOTSPOT-1201, HOTSPOT-1202, HOTSPOT-1203, HOTSPOT-1204

---

### P1: Eligible `.mts` / `.cts` ⭐ MVP

**User Story**: As a developer with TypeScript ESM/CJS dual sources, I want `.mts` and `.cts` files discovered, NCLOC-measured, and ranked like `.ts`/`.mjs` so module entrypoints appear when they churn.

**Why P1**: Sister of M48; mission primary eligibility item.

**Acceptance Criteria**:

1. WHEN `ELIGIBLE_EXTENSIONS` is read THEN it SHALL equal `[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]` (order locked in [context.md](./context.md))
2. WHEN `discoverSourceFiles` runs (ls-files or walk fallback) THEN in-scope paths ending in `.mts` or `.cts` SHALL be included
3. WHEN complexity analysis runs over discovered paths THEN in-scope `.mts`/`.cts` sources SHALL receive NCLOC results (same analyzer path as other eligible files)
4. WHEN hotspot scoring runs THEN `.mts`/`.cts` complexity rows SHALL join PathScope-filtered git churn the same way as other eligible extensions (no special-case exclusion)
5. WHEN rename heuristics check eligible extensions THEN `.mts`/`.cts` SHALL be treated as eligible consistently with `ELIGIBLE_EXTENSIONS` (no divergent stale Set)

**Independent Test**: Update `discover.test.ts` expectations (include `.mts`/`.cts`); rename-warnings unit case for eligible stem+ext; optional complexity smoke only if existing tests hard-code the six-extension list.

**Requirements:** HOTSPOT-1205, HOTSPOT-1206, HOTSPOT-1207, HOTSPOT-1208, HOTSPOT-1209

---

### P1: Documentation ⭐ MVP

**User Story**: As a maintainer or adopter, I want ARCHITECTURE / README / CONCERNS to reflect the closed residual and new eligible extensions so docs match behavior.

**Why P1**: Living docs rule; CONCERNS currently names this exact gap.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE path-scoping prose is read THEN it SHALL list `.mts`/`.cts` among eligible extensions and note expanded built-in test globs (or point to the constant)
2. WHEN README Limitations / path-scoping summary is read THEN it SHALL no longer claim that `*.test.mjs` / `*.spec.cjs` may appear under default test excludes; eligible list SHALL include `.mts`/`.cts`
3. WHEN CONCERNS § Path scoping residual row for `*.test.mjs` / `*.spec.cjs` is read THEN it SHALL be removed or rewritten as mitigated by M67

**Independent Test**: Doc review checklist in task Done when; no runtime test.

**Requirements:** HOTSPOT-1210, HOTSPOT-1211, HOTSPOT-1212

---

## Edge Cases

- WHEN a path matches both a new test glob and a user `--include` THEN exclude SHALL win (existing PathScope semantics)
- WHEN `.mts`/`.cts` files live under excluded artifact dirs THEN exclude SHALL win (not discovered)
- WHEN `--include-tests` is set THEN new test globs are lifted but artifact excludes still apply
- WHEN git records churn for a `.mts` file that PathScope excludes THEN filtered git stats SHALL omit it; scoring still only emits rows present in complexity results
- WHEN `foo.test.ts` (already covered) is evaluated THEN behavior SHALL remain excluded by default (regression)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1200 | P1: Test excludes — ESM/CJS quartet | Tasks | Pending |
| HOTSPOT-1201 | P1: Test excludes — mts/cts quartet | Tasks | Pending |
| HOTSPOT-1202 | P1: Test excludes — isPathInScope default | Tasks | Pending |
| HOTSPOT-1203 | P1: Test excludes — includeTests lifts | Tasks | Pending |
| HOTSPOT-1204 | P1: Test excludes — artifacts untouched | Tasks | Pending |
| HOTSPOT-1205 | P1: Eligible — constant | Tasks | Pending |
| HOTSPOT-1206 | P1: Eligible — discovery | Tasks | Pending |
| HOTSPOT-1207 | P1: Eligible — NCLOC via discover | Tasks | Pending |
| HOTSPOT-1208 | P1: Eligible — scoring ∩ git | Tasks | Pending |
| HOTSPOT-1209 | P1: Eligible — rename-warnings sync | Tasks | Pending |
| HOTSPOT-1210 | P1: Docs — ARCHITECTURE | Tasks | Pending |
| HOTSPOT-1211 | P1: Docs — README | Tasks | Pending |
| HOTSPOT-1212 | P1: Docs — CONCERNS residual clear | Tasks | Pending |
| HOTSPOT-1213–1215 | Stretch / Execute ROADMAP-STATE note if needed | — | Reserved |
| HOTSPOT-1216–1229 | Reserved | — | — |

**Coverage:** 13 mapped, 0 unmapped; 1213–1229 reserved.

---

## Success Criteria

- [ ] Default scope excludes locked mjs/cjs/mts/cts test/spec paths; `--include-tests` restores them
- [ ] `.mts` / `.cts` appear in discovery and can form hotspot rows when in scope
- [ ] Artifact defaults and JSON contract unchanged
- [ ] CONCERNS residual for test.mjs/spec.cjs closed in docs
- [ ] `pnpm build && pnpm test` green
