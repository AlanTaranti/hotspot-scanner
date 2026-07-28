# Milestone 67 — Scope Extensions Plus Context

**Feature slug:** `scope-extensions-plus`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M67 + planner lock (parent session) — close M46/M48 residual test-glob gap and add `.mts`/`.cts` eligibility  
**Depth:** Medium  
**IDs:** HOTSPOT-1200–1229 (1216–1229 reserved)  
**Sisters:** [exclude-tests-by-default](../exclude-tests-by-default/) (M46), [scope-extensions-excludes](../scope-extensions-excludes/) (M48)

---

## Feature Boundary

Close two related PathScope / eligibility gaps left after M46 + M48:

1. **Residual test globs** — after M48 made `.mjs`/`.cjs` eligible, co-located `*.test.mjs` / `*.spec.cjs` (and siblings) were **not** in `DEFAULT_TEST_EXCLUDE_PATTERNS` (M46 ownership at the time). Documented in CONCERNS / STATE / README Limitations.
2. **TypeScript module extensions** — M48 deferred `.mts`/`.cts`; this milestone adds them to `ELIGIBLE_EXTENSIONS` end-to-end (discovery → NCLOC → scoring ∩ git churn).

**In scope:** `DEFAULT_TEST_EXCLUDE_PATTERNS` append; `ELIGIBLE_EXTENSIONS` append; sync duplicate eligible-extension Set in rename warnings; living docs (ARCHITECTURE, README, CONCERNS residual clear).

**Out of scope:** `.hotspotignore`; workspace yaml parsers; changing `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` beyond leaving them untouched; new CLI flags / config keys; JSON Schema / `version` bump; scoring formula changes; new fixture repos under `tests/fixtures/repos/`.

---

## Decision: Residual ESM/CJS test globs (LOCKED)

**Question:** Which M46/M48 residual patterns join `DEFAULT_TEST_EXCLUDE_PATTERNS`?

**Choice — at minimum the full ESM/CJS parity quartet** (mission floor + symmetry):

| Pattern         | Intent               |
| --------------- | -------------------- |
| `**/*.test.mjs` | Co-located ESM tests |
| `**/*.test.cjs` | Co-located CJS tests |
| `**/*.spec.mjs` | Spec-suffix ESM      |
| `**/*.spec.cjs` | Spec-suffix CJS      |

**Status:** **Confirmed — mission lock**

---

## Decision: Test globs for `.mts` / `.cts` (LOCKED — prevent new residual)

**Question:** When `.mts`/`.cts` become eligible, should matching test/spec globs be added in the same milestone?

**Choice:** **Yes** — append the TypeScript-module quartet so M67 does not recreate the M48 residual:

| Pattern         | Intent                  |
| --------------- | ----------------------- |
| `**/*.test.mts` | Co-located TS ESM tests |
| `**/*.test.cts` | Co-located TS CJS tests |
| `**/*.spec.mts` | Spec-suffix TS ESM      |
| `**/*.spec.cts` | Spec-suffix TS CJS      |

**Rationale:** Same product class as the mjs/cjs residual documented in CONCERNS; closing eligibility without test globs would leave an identical gap for dual-package TypeScript sources.

**Unchanged:** Existing eight `.ts`/`.tsx`/`.js`/`.jsx` test/spec patterns + `**/__tests__/**`. Artifact defaults untouched. `--include-tests` continues to lift **all** `DEFAULT_TEST_EXCLUDE_PATTERNS` (including new entries).

**Resulting `DEFAULT_TEST_EXCLUDE_PATTERNS` order (locked):** keep current eight + `__tests__`, then append the eight new patterns grouped as test-then-spec for mjs/cjs then mts/cts:

```ts
[
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/__tests__/**",
  "**/*.test.mjs",
  "**/*.test.cjs",
  "**/*.spec.mjs",
  "**/*.spec.cjs",
  "**/*.test.mts",
  "**/*.test.cts",
  "**/*.spec.mts",
  "**/*.spec.cts",
];
```

**Status:** **Confirmed — planner locked**

---

## Decision: Eligible extensions add `.mts` / `.cts` (LOCKED)

**Question:** Which extensions join `ELIGIBLE_EXTENSIONS`?

**Choice:** Append **`.mts`** and **`.cts`** only (sister of M48 `.mjs`/`.cjs`).

**Resulting set (order locked):**

```ts
[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
```

**Applies to:**

| Surface          | How                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery        | `discoverSourceFiles` / `hasEligibleExtension` via constant                                                                                                     |
| NCLOC            | Analyzer walks discovered eligible paths — no separate extension list                                                                                           |
| Scoring ∩ git    | Hotspots keyed from complexity results ∩ PathScope-filtered git stats                                                                                           |
| Rename heuristic | Local `ELIGIBLE_EXTENSIONS` Set in `src/git/rename-warnings.ts` **must** stay in sync (prefer import of shared constant if cheap; else update Set in same task) |

**Forbidden:**

| Item                       | Why                           |
| -------------------------- | ----------------------------- |
| `.d.ts` / declaration-only | Not source complexity targets |
| Extensionless / `.json`    | Out of product scope          |
| New artifact exclude dirs  | Mission out of scope          |
| `.hotspotignore`           | Mission out of scope          |

**Status:** **Confirmed — mission lock**

---

## Decision: No new fixture repo / no CLI / no schema (LOCKED)

| Item                             | Choice                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| New `tests/fixtures/repos/` slug | **No** — unit tests on `scope.test.ts` + `discover.test.ts` (+ rename-warnings if touched) suffice |
| New CLI flags                    | **No** — `--include-tests` already lifts test defaults                                             |
| Config keys                      | **No**                                                                                             |
| JSON Schema / `version` bump     | **No** — population may grow; contract shape unchanged                                             |
| Artifact exclude edits           | **No**                                                                                             |

**Status:** **Confirmed**

---

## Decision: Docs clear residual concern (LOCKED)

WHEN Execute completes, living docs SHALL:

1. List `.mts`/`.cts` in eligible extensions (ARCHITECTURE + README Limitations).
2. List expanded built-in test globs (README path-scoping / Limitations — remove “may appear in rankings” residual language for mjs/cjs).
3. Clear or rewrite CONCERNS § Path scoping residual row (gap closed by M67).

ROADMAP/STATE updates belong to Execute Done — **this planning session does not edit ROADMAP.md or STATE.md** (mission lock).

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Source    | Decision                                                                                  |
| --------- | ----------------------------------------------------------------------------------------- |
| M7        | Default excludes always on; exclude additive; include narrows; no `--no-default-excludes` |
| M46       | Test vs artifact split; `--include-tests` CLI-only lifts test patterns                    |
| M48       | `.mjs`/`.cjs` eligible; artifact YAGNI dirs; deferred `.mts`/`.cts` and test.mjs residual |
| AGENTS.md | Gate `pnpm build && pnpm test`                                                            |

---

## Ambiguity log

_None — product scope locked by mission + sister contexts._
