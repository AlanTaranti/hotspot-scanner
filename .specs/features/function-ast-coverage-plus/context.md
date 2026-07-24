# Milestone 29 — Function AST Coverage+ Context

**Feature slug:** `function-ast-coverage-plus`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M29; extend M22 without McCabe decision-node drift (RT-005)  
**Verified against:** `src/complexity/analyze-file.ts` (live probe, 2026-07-23)

---

## Decision: Locked construct set (M29)

**Choice:** Extend collection / collection policy for **exactly** these four items. Do **not** treat constructors as new (M11). Do **not** re-ship M22 getters/setters/class-field-arrows/object methods.

| # | Construct | Current behavior (verified) | M29 action |
| - | --------- | --------------------------- | ---------- |
| 1 | **ClassExpression members** (`const C = class { … }`) | **Not collected** (VariableStatement early-return + `collectCallableInitializer` ignores `ClassExpression`) | Collect members with the **same** policy as `ClassDeclaration` (methods, constructors, get/set, field callables) |
| 2 | **Object-literal get/set** (`{ get foo(){}, set foo(v){} }`) | Only `MethodDeclaration` / callable `PropertyAssignment` collected; accessors **missed** | Collect `GetAccessorDeclaration` / `SetAccessorDeclaration` inside `ObjectLiteralExpression` |
| 3 | **AssignmentExpression RHS callables** (`handler = function named(){}`, `obj.fn = () => {}`) | **Not collected** (only `VariableDeclaration` / property initializers) | Collect ArrowFunction / FunctionExpression on `=` RHS when LHS is Identifier or PropertyAccessExpression (ElementAccess → anonymous policy) |
| 4 | **Overload signature noise** (body-less `function` / method stubs) | Top-level `function` overloads emit **one entry per signature** (complexity 1 stubs + implementation); class `getMembers()` often surfaces implementation only | **Skip** body-less, non-abstract `FunctionDeclaration` / `MethodDeclaration` (overload / ambient stubs). Keep implementations and M22 abstract accessors |

**Explicitly NOT new constructs (already covered or out of scope):**

| Candidate | Status |
| --------- | ------ |
| `constructor()` | Already M11 — do not list as new |
| `get`/`set` on **classes**, class field arrows, object-literal **methods** | Already M22 |
| `const fn = function named() {}` (VariableDeclaration) | Already collected; name = binding (`fn`), not inner name |
| `namespace` / `module` bodies | **Already collected** via recursive `forEachChild` — regression fixture only (P2), not a collection change |
| IIFEs / call-argument callbacks / bare unassigned arrows | Out of scope (YAGNI) |

**Status:** **Confirmed**

---

## Decision: Naming table extensions (additive to M11 + M22)

**Choice:** Extend naming only for new constructs. Do **not** change existing M11/M22 rows.

| Construct | `functionName` |
| --------- | -------------- |
| ClassExpression method / get / set / field arrow | Same rules as ClassDeclaration (method/accessor/property name; ctor → `constructor`) |
| Object-literal `get foo()` / `set foo()` | Bare `foo` (same as class accessors; distinguish by `line`) |
| `handler = function named() { }` | LHS Identifier name → `handler` (inner FunctionExpression name ignored — consistent with `const fn = function named()`) |
| `obj.fn = () => {}` / `exports.foo = function(){}` | PropertyAccess **rightmost name** → `fn` / `foo` |
| `obj[expr] = () => {}` (ElementAccess) | `<anonymous>:L{line}` |
| Assignment RHS anonymous function/arrow with non-nameable LHS | `<anonymous>:L{line}` |

`line` = `getStartLineNumber()` of the **function node** (arrow / function expression / method / accessor), not the statement.

**Status:** **Confirmed**

---

## Decision: McCabe definition unchanged (RT-005)

**Choice:** Reuse `complexityForFunction(node)` as-is. **Do not** edit decision-node kinds in `mccabe.ts`. M29 only changes **which** nodes are collected (and which body-less stubs are skipped).

**Status:** **Confirmed**

---

## Decision: File-level sum impact

**Choice:** File `cyclomaticComplexity` remains the **sum** of collected function complexities. Adding ClassExpression / object accessors / assignment RHS **increases** file totals where those constructs exist. Skipping overload stubs **decreases** totals for files that previously counted signature stubs — update fixtures deliberately and document in tests.

**Status:** **Confirmed**

---

## Decision: Namespace / module

**Choice:** No collector change. Optional P2 fixture locks that `namespace N { function f(){} }` and `module M { … }` remain visible (already green in probe).

**Status:** **Confirmed**
