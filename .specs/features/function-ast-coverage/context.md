# Milestone 22 — Function AST Coverage Context

**Feature slug:** `function-ast-coverage`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M22; align with M11 naming in function-granularity/context.md

---

## Decision: Constructs to add

**Choice:** Extend `collectFunctionsInScope` in `src/complexity/analyze-file.ts` to also collect:

| Construct | ts-morph kind (indicative) | `functionName` rule |
| --------- | -------------------------- | ------------------- |
| Getter | `GetAccessorDeclaration` | accessor name (e.g. `foo` for `get foo()`) |
| Setter | `SetAccessorDeclaration` | accessor name (e.g. `foo` for `set foo()`) |
| Class field arrow | `PropertyDeclaration` with arrow/function initializer | property name |
| Object-literal method | `MethodDeclaration` inside `ObjectLiteralExpression` (and shorthand methods) | method name; anonymous → `<anonymous>:L{line}` |

**Status:** **Confirmed**

---

## Decision: Naming alignment with M11

**Choice:** Extend M11 table — do **not** change existing rows for `function`/`method`/`constructor`/`const arrow`/`anonymous`.

Additional rows:

| Construct | `functionName` |
| --------- | -------------- |
| `get foo()` | `foo` |
| `set foo()` | `foo` |
| `class C { foo = () => {} }` | `foo` |
| `const o = { bar() {} }` | `bar` |
| `const o = { baz: () => {} }` | `baz` |
| Object property anonymous function expr without name | `<anonymous>:L{line}` |

**Note:** Getter and setter sharing the name `foo` are distinct nodes (different lines); both may appear. No prefix `get `/`set ` unless needed for disambiguation — **prefer bare name** to match method naming; tests may use `line` to distinguish.

**Status:** **Confirmed**

---

## Decision: McCabe definition unchanged

**Choice:** Reuse `complexityForFunction(node)` as-is. **Do not** change decision-node definition (RT-005 / CONCERNS.md). New constructs only change **which** nodes are collected.

**Status:** **Confirmed**

---

## Decision: File-level sum impact

**Choice:** File `cyclomaticComplexity` remains **sum** of collected function complexities. Adding constructs **increases** file totals for files that contain them — expected behavior; update fixtures that asserted old counts.

**Status:** **Confirmed**
