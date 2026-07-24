# Milestone 22 — Function AST Coverage Specification

**Feature slug:** `function-ast-coverage`  
**Milestone:** ROADMAP M22  
**Design SoT:** [CONCERNS.md](../../codebase/CONCERNS.md), [function-granularity/context.md](../function-granularity/context.md)  
**Context:** [`.specs/features/function-ast-coverage/context.md`](./context.md)  
**Depth:** Medium/Large (design required — AST collection + fixture lock)

## Problem Statement

`analyze-file.ts` today collects function declarations, methods, constructors, and variable-initialized arrows/expressions, but **misses** getters/setters, class field arrows, and object-literal methods. Function granularity (M11) and file sums under-count real callable complexity in idiomatic TS/JS.

## Goals

- [ ] Extend collection for getters, setters, class field arrows, object-literal methods
- [ ] McCabe fixtures per new construct with manually verified values
- [ ] **Do not** change existing decision-node definition
- [ ] Align naming with M11 conventions (+ extensions in context.md)
- [ ] `pnpm build && pnpm test` green

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Changing McCabe decision nodes | Explicit non-goal / fragile |
| Per-function git churn | M23 |
| Decorator-only / ambient declare bodies | YAGNI unless trivial |
| tsconfig path changes | Unrelated |

---

## User Stories

### P1: Collect getters and setters ⭐ MVP

**User Story**: As a developer using `--granularity function`, I want class getters/setters ranked so that accessor complexity is visible.

**Acceptance Criteria**:

1. WHEN a class has `get foo()` / `set foo()` with bodies THEN they SHALL appear in `functions` with names per context.md
2. WHEN McCabe is computed THEN existing `complexityForFunction` SHALL be used unchanged
3. WHEN a fixture documents expected complexity THEN tests SHALL lock that value

**Independent Test**: Fixture file + analyze-file unit test.

**Requirements**: HOTSPOT-174, HOTSPOT-178

---

### P1: Collect class field arrows ⭐ MVP

**User Story**: As a developer, I want class property arrow methods included in complexity.

**Acceptance Criteria**:

1. WHEN `class C { foo = () => { ... } }` or `foo = function() {}` THEN `foo` SHALL be collected
2. WHEN the initializer is not a function THEN it SHALL NOT be collected as a function node

**Independent Test**: Fixture + unit test.

**Requirements**: HOTSPOT-175, HOTSPOT-178

---

### P1: Collect object-literal methods ⭐ MVP

**User Story**: As a developer, I want object literal methods and function-valued properties included.

**Acceptance Criteria**:

1. WHEN `const o = { bar() { ... } }` THEN `bar` SHALL be collected
2. WHEN `const o = { baz: () => { ... } }` THEN `baz` SHALL be collected
3. WHEN nested object literals contain methods THEN they SHALL be collected (same recursive policy as nested functions today)

**Independent Test**: Fixture + unit test.

**Requirements**: HOTSPOT-176, HOTSPOT-178

---

### P1: Regression — existing constructs unchanged ⭐ MVP

**User Story**: As a maintainer, I want prior McCabe fixtures to remain valid so that RT-005 stays locked.

**Acceptance Criteria**:

1. WHEN existing complexity fixtures run THEN decision-node counts for previously covered constructs SHALL not change **except** where a fixture file also contains newly collected constructs (then file totals may rise — update those fixtures deliberately)
2. WHEN `mccabe.ts` decision nodes are reviewed THEN no definition change SHALL ship in M22

**Independent Test**: Existing `tests/fixtures/complexity/` suite green; diff `mccabe.ts` empty of semantic changes.

**Requirements**: HOTSPOT-177

---

### P1: Docs + function-mode integration ⭐ MVP

**User Story**: As a docs reader, I want naming table extended and ARCHITECTURE/CONCERNS note that collection coverage expanded.

**Acceptance Criteria**:

1. WHEN function naming is documented THEN getters/setters/field arrows/object methods SHALL appear
2. WHEN function-mode integration runs on a fixture containing new constructs THEN they SHALL appear in output (if fixture updated)

**Independent Test**: Doc + optional integration assert.

**Requirements**: HOTSPOT-179, HOTSPOT-180

---

## Edge Cases

- WHEN getter and setter share name `foo` THEN both entries SHALL exist (distinguish by `line`)
- WHEN abstract getter without body THEN skip or complexity 1 per existing empty-body policy — match current method-without-body behavior
- WHEN object spread / `__proto__` exotic keys THEN best-effort; fixtures use normal identifiers

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-174 | P1: Getters/setters | Tasks T1 | Pending |
| HOTSPOT-175 | P1: Class field arrows | Tasks T1 | Pending |
| HOTSPOT-176 | P1: Object-literal methods | Tasks T1 | Pending |
| HOTSPOT-177 | P1: McCabe regression | Tasks T1, T2 | Pending |
| HOTSPOT-178 | P1: Fixtures per construct | Tasks T2 | Pending |
| HOTSPOT-179 | P1: Naming docs | Tasks T3 | Pending |
| HOTSPOT-180 | P1: Docs / gate | Tasks T3 | Pending |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] New constructs collected with locked McCabe fixtures
- [ ] `mccabe.ts` decision definition unchanged
- [ ] Naming matches context.md / M11 extension
- [ ] Full gate green
