# Milestone 48 — Scope Extensions & Artifact Excludes Context

**Feature slug:** `scope-extensions-excludes`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M48 stub + planner lock (parent session)  
**Depth:** Small  
**Sisters:** [path-scoping](../path-scoping/) (M7), [path-config-dx](../path-config-dx/) (M30), [exclude-tests-by-default](../exclude-tests-by-default/) (M46)

---

## Decision: Eligible extensions add `.mjs` / `.cjs` (LOCKED)

**Question:** Which source extensions join `ELIGIBLE_EXTENSIONS`?

**Choice:** Append **`.mjs`** and **`.cjs`** only.

| Extension | Rationale |
| --------- | --------- |
| `.mjs` | ESM-explicit Node / package `exports` entrypoints common in dual-package repos |
| `.cjs` | CJS-explicit entrypoints / legacy Node modules co-churned with TS |

**Resulting set (order locked):**

```ts
[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
```

**Applies to:** discovery (`discoverSourceFiles` / `git ls-files` filter), complexity analysis, function-mode git∩eligible allowlist (`buildFunctionModePathAllowlist` via imported `ELIGIBLE_EXTENSIONS`), and static enrich peer extension candidates (single source of truth — reuse `ELIGIBLE_EXTENSIONS`, do not maintain a divergent `SOURCE_EXTENSIONS` list).

**Forbidden in M48:**

| Extension | Why |
| --------- | --- |
| `.mts` / `.cts` | Not in ROADMAP; M46 explicitly deferred; YAGNI |
| `.d.ts` / declaration-only | Not source complexity targets |
| Extensionless / `.json` | Out of product scope |

**Status:** **Confirmed — planner locked (ROADMAP)**

---

## Decision: Artifact exclude expansion = full M30 YAGNI-cut set (LOCKED)

**Question:** Which directories from M30 context YAGNI cuts join default **artifact** excludes?

**Choice — include all seven** (ROADMAP names `.turbo` / `.cache` plus “related YAGNI-cut dirs”):

| Directory | Pattern form | Rationale |
| --------- | ------------ | --------- |
| `.turbo` | `**/.turbo/**` | Turborepo cache / outputs under packages |
| `.vercel` | `**/.vercel/**` | Vercel project / build metadata |
| `.cache` | `**/.cache/**` | Generic tool caches (eslint, parcel-adjacent, etc.) |
| `.nuxt` | `**/.nuxt/**` | Nuxt build / generated |
| `.output` | `**/.output/**` | Nuxt / Nitro output |
| `.parcel-cache` | `**/.parcel-cache/**` | Parcel cache |
| `tmp` | `**/tmp/**` | Scratch / temp dirs (same over-exclude class as M30 `out`) |

**Pattern form:** All new entries use `**/<name>/**` (M30 nested monorepo convention). Existing M7 patterns (`node_modules/**`, `.git/**`, `dist/**`, `coverage/**`, `build/**`) and M30 patterns stay unchanged.

**Target constant:** After M46 Execute, append to `DEFAULT_ARTIFACT_EXCLUDE_PATTERNS` (not test patterns). If Execute runs before M46 rename lands, append to the artifact half of defaults — **never** edit `DEFAULT_TEST_EXCLUDE_PATTERNS`.

**Still always-on:** Defaults remain non-disableable (M7 lock — no `--no-default-excludes`). User `--exclude` / config `exclude` stay **additive**.

**Status:** **Confirmed — planner locked**

---

## Decision: M46 test globs untouched (LOCKED)

**Question:** Should M48 add `*.test.mjs` / `*.test.cjs` (and siblings) to test defaults?

**Choice:** **No.** M46 owns `DEFAULT_TEST_EXCLUDE_PATTERNS`. M48 must not change test patterns.

**Accepted edge:** After `.mjs`/`.cjs` become eligible, co-located `foo.test.mjs` / `bar.spec.cjs` may enter scope until a future follow-up (or user `--exclude`). Document in ARCHITECTURE/CONCERNS as known residual — do not silently expand M46’s locked set here.

**Status:** **Confirmed — mission lock**

---

## Decision: No new fixture repo / no CLI flags (LOCKED)

| Item | Choice |
| ---- | ------ |
| New `tests/fixtures/repos/` slug | **No** — unit tests on discover + scope (+ enrich extension list) suffice |
| New CLI flags | **No** |
| Config keys | **No** |
| JSON Schema / `version` bump | **No** — population may grow; contract shape unchanged |
| Doctor inventory sync | **Out of scope** — M52 `doctor-scope-parity` |

**Status:** **Confirmed**

---

## Decision: Prefer Execute after M46 (SOFT)

M48 edits the **artifact** exclude list. Suggested ROADMAP order already places M48 after M46. Prefer M46 Complete before M48 Execute so the artifact/test split exists; if order slips, implementer must still only grow artifact defaults and leave test patterns alone.

**Status:** **Confirmed — soft dependency**

---

## Related closed decisions (do not reopen)

| Source | Decision |
| ------ | -------- |
| M7 | Default excludes always on; exclude additive; include narrows |
| M30 | Nested `**/…/**` for new artifact dirs; YAGNI cuts listed in path-config-dx context |
| M46 | Test pattern set + `--include-tests` opt-in; owns test globs |
| M35 | Function-mode allowlist = scoped churn ∩ `ELIGIBLE_EXTENSIONS` |
| AGENTS.md | Gate `pnpm build && pnpm test` |

---

## Ambiguity log

_None — product scope locked by ROADMAP + sister contexts._
