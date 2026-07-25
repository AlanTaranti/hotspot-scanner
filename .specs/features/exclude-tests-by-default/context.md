# Milestone 46 — Exclude Tests by Default Context

**Feature slug:** `exclude-tests-by-default`  
**Captured:** 2026-07-24  
**Trigger:** User-locked product decision after dogfooding (test files ranking as top hotspots); prior Cursor plan informational only  
**Depth:** Large  
**Sisters:** [path-scoping](../path-scoping/spec.md) (M7), [path-config-dx](../path-config-dx/spec.md) (M30), [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39 dry-run)

---

## Decision: Default excludes tests (LOCKED — intentional breaking)

**Question:** Should test files be in hotspot/complexity/git scope by default?

**Choice:** **No** — built-in test exclude patterns are always-on by default (same always-on category as M7/M30 artifact defaults).

**Breaking change:** Default rankings, coupling pairs, and eligible-file counts change for repos that previously included `*.test.*` / `*.spec.*` / `__tests__/**`. JSON Schema / `version: "1.0"` shape **unchanged**.

**Status:** **Confirmed — user locked**

---

## Decision: Opt-in `--include-tests` only (LOCKED)

**Question:** How do users audit test-suite hotspots?

**Choice:** CLI boolean **`--include-tests`** (same category as `--quiet` / `--dry-run` — **CLI-only**, no config key).

| Flag / API | Effect |
| ---------- | ------ |
| Default / omitted | Artifact defaults + **test defaults** + user/config `--exclude` |
| `--include-tests` / `ScanOptions.includeTests: true` | Artifact defaults only + user/config `--exclude` (test built-ins lifted) |

**Not cleared by `--include-tests`:** User/config `--exclude` remains **additive** and still applies.

**Forbidden:**

| Option | Why |
| ------ | --- |
| `--no-default-excludes` | M7 lock — reject again |
| Config key `includeTests` | YAGNI — CLI/API only |
| Config key that removes artifact defaults | Forbidden |

**Status:** **Confirmed — user locked**

---

## Decision: Test pattern set (LOCKED — candidate; refine only if picomatch prune needs it)

**Choice — locked candidate set** (eligible extensions remain `.ts`/`.tsx`/`.js`/`.jsx` only — **no** `.mts`/`.cts`):

| Pattern | Intent |
| ------- | ------ |
| `**/*.test.ts` | Vitest/Jest co-located tests |
| `**/*.test.tsx` | React co-located tests |
| `**/*.test.js` | JS co-located tests |
| `**/*.test.jsx` | JSX co-located tests |
| `**/*.spec.ts` | Spec suffix (Jest/Cypress-style) |
| `**/*.spec.tsx` | Spec suffix TSX |
| `**/*.spec.js` | Spec suffix JS |
| `**/*.spec.jsx` | Spec suffix JSX |
| `**/__tests__/**` | Jest/Vitest `__tests__` directories (files + prune) |

**Design refinement allowed:** Adjust only if unit tests show `shouldPruneDirectory("__tests__")` needs an extra pattern form (e.g. explicit `**/__tests__` sibling) — do **not** expand suffixes or add unrelated globs without reopening with user.

**Still always-on (artifact):** M7 + M30 `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` — never lifted by `--include-tests`.

**Status:** **Confirmed — user locked (pattern list)**

---

## Decision: Implementation shape (LOCKED direction)

**Choice:**

1. Split `DEFAULT_EXCLUDE_PATTERNS` in `src/paths/scope.ts` into:
   - `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` (current M7/M30 list)
   - `DEFAULT_TEST_EXCLUDE_PATTERNS` (locked set above)
   - `DEFAULT_EXCLUDE_PATTERNS` = artifact + test (backward-compatible export name for “full defaults”)
2. `createPathScope({ includeTests?: boolean })` — when `true`, compile excludes from **artifact + user** only; when false/omitted, **artifact + test + user**.
3. Wire `includeTests` on `ScanOptions` through `runScan`, `previewScanScope`, and CLI `scan` / `baseline save` / `compare` via `bin/scan-actions.ts`.

**Status:** **Confirmed — user suggested; planner adopts**

---

## Decision: Dry-run visibility (LOCKED)

**Question:** Should `--dry-run` show whether tests are excluded?

**Choice:** Yes — preview text SHALL surface test inclusion state (e.g. `test files: excluded` vs `test files: included`) so operators see the effective policy without mining. Eligible count already reflects PathScope.

**Status:** **Confirmed — planner locked (aligns with M39 preview purpose)**

---

## Decision: Out of scope / YAGNI (LOCKED)

| Item | Reason |
| ---- | ------ |
| New fixture repo | Unit tests on `scope.test.ts` (+ CLI/preview) suffice |
| Config `includeTests` | CLI/API only |
| `--no-default-excludes` | M7 forbidden |
| `.mts` / `.cts` test suffixes | Eligible extensions unchanged |
| Changing JSON Schema / ranking formulas | Scope/filter only |

**Status:** **Confirmed**

---

## Ambiguity log

_None — all product decisions user-locked before planning._
