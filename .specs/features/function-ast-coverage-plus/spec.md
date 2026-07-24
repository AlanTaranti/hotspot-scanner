# Milestone 29 — Function AST Coverage+ Specification

**Feature slug:** `function-ast-coverage-plus`  
**Milestone:** ROADMAP M29  
**Design SoT:** [CONCERNS.md](../../codebase/CONCERNS.md) (RT-005), [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) § Function AST collection  
**Sisters:** [function-ast-coverage](../function-ast-coverage/) (M22), [function-granularity](../function-granularity/) (M11 naming)  
**Context:** [`.specs/features/function-ast-coverage-plus/context.md`](./context.md)  
**Depth:** Large (design + tasks required — multi-construct collection + overload policy + fixture lock)

## Problem Statement

After M22, `analyze-file.ts` still under-counts idiomatic TS/JS callables: **ClassExpression** members are skipped entirely, **object-literal getters/setters** are ignored, and **assignment RHS** arrows/function expressions (`handler = function named(){}`, `obj.fn = () => {}`) never enter the function list. Separately, body-less **function overload signatures** inflate `functionCount` and file sums with complexity-1 stubs. M29 closes these real gaps without changing McCabe decision nodes (RT-005). Constructors remain M11 — not in scope as “new.”

## Goals

- [ ] Collect ClassExpression members with the same policy as ClassDeclaration
- [ ] Collect object-literal get/set accessors
- [ ] Collect AssignmentExpression RHS ArrowFunction / FunctionExpression with locked naming
- [ ] Skip body-less non-abstract overload/ambient function & method stubs
- [ ] McCabe fixtures per new construct family; no `mccabe.ts` decision-node drift
- [ ] Naming table documented (ARCHITECTURE + context); `pnpm build && pnpm test` green

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Changing McCabe decision nodes | Explicit non-goal / RT-005 |
| Constructors as a “new” construct | Already M11 |
| Re-implementing M22 constructs | Already shipped |
| IIFEs / call-argument callbacks / bare unassigned arrows | YAGNI |
| Changing VariableDeclaration naming (`const fn = function named()` → keep `fn`) | Consistency with M11 |
| Per-function git churn / scoring formula changes | Unrelated milestones |
| Namespace/module collector changes | Already collected via recursion |

---

## User Stories

### P1: Collect ClassExpression members ⭐ MVP

**User Story**: As a developer using `--granularity function`, I want methods (and related members) on `const C = class { … }` ranked so that class-expression code is not invisible.

**Acceptance Criteria**:

1. WHEN a VariableDeclaration (or other initializer site already walked) initializes a `ClassExpression` THEN its members SHALL be collected with the same kinds as `ClassDeclaration` (methods, constructors, get/set, field callables)
2. WHEN naming is resolved THEN ClassExpression members SHALL use the same `functionName` rules as ClassDeclaration members
3. WHEN McCabe is computed THEN existing `complexityForFunction` SHALL be used unchanged

**Independent Test**: Inline source + fixture `class-expressions.ts` + unit assertions.

**Requirements**: HOTSPOT-281, HOTSPOT-285, HOTSPOT-287

---

### P1: Collect object-literal getters and setters ⭐ MVP

**User Story**: As a developer, I want object-literal accessors included the same way class accessors are (M22).

**Acceptance Criteria**:

1. WHEN an ObjectLiteralExpression contains `get foo()` / `set foo()` with bodies THEN they SHALL appear with bare name `foo` (disambiguate by `line`)
2. WHEN only class accessors existed before THEN object-literal methods already collected in M22 SHALL remain collected

**Independent Test**: Fixture `object-literal-accessors.ts` + unit test.

**Requirements**: HOTSPOT-282, HOTSPOT-285, HOTSPOT-286

---

### P1: Collect assignment RHS callables (named FunctionExpression + arrows) ⭐ MVP

**User Story**: As a developer, I want `handler = function named(){}` and `obj.fn = () => {}` to appear in function rankings so assignment-style handlers are visible.

**Acceptance Criteria**:

1. WHEN an ExpressionStatement (or nested expression) assigns `=` an ArrowFunction or FunctionExpression to an Identifier THEN the callable SHALL be collected and named after the Identifier
2. WHEN the LHS is a PropertyAccessExpression THEN `functionName` SHALL be the rightmost property name
3. WHEN the LHS is ElementAccessExpression THEN `functionName` SHALL be `<anonymous>:L{line}`
4. WHEN the FunctionExpression has an inner name THEN that inner name SHALL NOT override the LHS binding/property name (align with `const fn = function named()`)

**Independent Test**: Fixture `assignment-callables.ts` + unit test.

**Requirements**: HOTSPOT-283, HOTSPOT-285, HOTSPOT-286

---

### P1: Skip overload signature stubs ⭐ MVP

**User Story**: As a maintainer, I want overload/ambient body-less stubs excluded so rankings and file sums reflect implementations only.

**Acceptance Criteria**:

1. WHEN multiple `function foo(…);` signatures precede an implementing `function foo(…){…}` THEN only the implementation (and nested callables inside it) SHALL appear — signature stubs SHALL NOT
2. WHEN a body-less `MethodDeclaration` is non-abstract THEN it SHALL NOT be collected (defensive; class `getMembers()` may already omit some stubs)
3. WHEN an abstract accessor/method without body exists THEN M22 empty-body policy SHALL remain (still collected, complexity 1) — abstract is not treated as an overload stub
4. WHEN fixtures previously assumed stub counts THEN they SHALL be updated deliberately with comments

**Independent Test**: Fixture `overloads.ts` + unit test comparing before/after expected counts.

**Requirements**: HOTSPOT-284, HOTSPOT-286, HOTSPOT-287

---

### P1: McCabe fixtures + regression lock ⭐ MVP

**User Story**: As a maintainer, I want manually verified complexities per new construct and proof that decision nodes did not drift.

**Acceptance Criteria**:

1. WHEN each new construct family has a fixture THEN tests SHALL lock per-function complexity and file sum
2. WHEN `mccabe.ts` is reviewed for this milestone THEN no semantic decision-node change SHALL ship
3. WHEN prior complexity fixtures run THEN they SHALL stay green (adjust only where M29 collection/skip policy intentionally changes counts)

**Independent Test**: `tests/fixtures/complexity/*` + `src/complexity/` Vitest suite.

**Requirements**: HOTSPOT-286, HOTSPOT-287

---

### P1: Docs — naming / collection table ⭐ MVP

**User Story**: As a docs reader, I want ARCHITECTURE / CONCERNS to list M29 constructs and reaffirm RT-005.

**Acceptance Criteria**:

1. WHEN Function AST collection is documented THEN ClassExpression, object-literal accessors, assignment RHS callables, and overload-skip policy SHALL appear
2. WHEN CONCERNS mentions collection scope THEN it SHALL note M29 extension without encouraging McCabe edits

**Independent Test**: Doc review in Execute; full gate green.

**Requirements**: HOTSPOT-288, HOTSPOT-289

---

### P2: Namespace / module regression fixture

**User Story**: As a maintainer, I want a locked fixture proving `namespace` / `module` functions remain collected (already true today).

**Acceptance Criteria**:

1. WHEN a fixture uses `namespace` and/or `module` with inner functions/methods THEN they SHALL appear with expected names and complexities
2. WHEN no collector bug is found THEN no production code change is required for this story

**Independent Test**: Fixture `namespace-module.ts` + unit assert.

**Requirements**: HOTSPOT-290

---

## Edge Cases

- WHEN ClassExpression appears as `export default class { m(){} }` — that is ClassDeclaration (already covered); ClassExpression is the `= class` / expression form
- WHEN getter and setter share name `foo` on an object literal THEN both entries SHALL exist (distinguish by `line`)
- WHEN assignment uses `||=` / `&&=` / `??=` THEN M29 SHALL NOT collect (only `=` — YAGNI)
- WHEN assignment RHS is not a callable THEN it SHALL NOT be collected
- WHEN nested callables exist inside a newly collected body THEN recursive collection SHALL match existing body policy
- WHEN overload stubs are skipped THEN file `functionCount` / sum SHALL drop vs pre-M29 for those files — intentional

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-281 | P1: ClassExpression members | Tasks T1 | Pending |
| HOTSPOT-282 | P1: Object-literal accessors | Tasks T1 | Pending |
| HOTSPOT-283 | P1: Assignment RHS callables | Tasks T1 | Pending |
| HOTSPOT-284 | P1: Overload stub skip | Tasks T1 | Pending |
| HOTSPOT-285 | P1: Naming extensions | Tasks T1, T3 | Pending |
| HOTSPOT-286 | P1: Fixtures per construct | Tasks T2 | Pending |
| HOTSPOT-287 | P1: McCabe / collection regression | Tasks T1, T2 | Pending |
| HOTSPOT-288 | P1: ARCHITECTURE/CONCERNS docs | Tasks T3 | Pending |
| HOTSPOT-289 | P1: Full gate | Tasks T3 | Pending |
| HOTSPOT-290 | P2: Namespace/module fixture | Tasks T2 | Pending |

**Coverage:** 10 total (HOTSPOT-281–290), 10 mapped to tasks, 0 unmapped. Unused range HOTSPOT-291–295 reserved / unused (gaps OK).

---

## Success Criteria

- [ ] Locked construct set from context.md implemented
- [ ] Naming matches context.md; M11/M22 rows unchanged
- [ ] `mccabe.ts` decision definition unchanged
- [ ] Fixtures lock McCabe per new family; overload stubs excluded
- [ ] Full gate `pnpm build && pnpm test` green
