# Milestone 79 — Package Scope Rename Context

**Feature slug:** `package-scope-rename`  
**Milestone:** ROADMAP M79  
**Depth:** Large (many files, zero pipeline logic)  
**Requirement IDs:** HOTSPOT-1700–1719 (1711–1719 reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (identity headers only; no pipeline change)

---

## Intent

Align npm package identity with author/repo ownership (`taranti`): rename `@vitals/hotspot-scanner` → `@taranti/hotspot-scanner` across code, living docs, Done feature prose, and Cursor surfaces — without renaming the CLI bin, config filename, or `vitals-*` skill folders, and without publishing to npm.

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Milestone | **M79**                                                            |
| Slug      | `package-scope-rename`                                             |
| Depth     | **Large**                                                          |
| IDs       | **HOTSPOT-1700–1719** (next free band after M78 HOTSPOT-1680–1699) |
| Priority  | **High** (ownership consistency)                                   |

**Status:** **Confirmed** — do not re-open

---

## Decision: Package identity (LOCKED)

| Field | Value                                                          |
| ----- | -------------------------------------------------------------- |
| From  | `@vitals/hotspot-scanner`                                      |
| To    | `@taranti/hotspot-scanner`                                     |
| Scope | Exact string replace of the package name everywhere it appears |

**Status:** **Confirmed** — do not re-open

---

## Decision: Bin / config / skills (LOCKED)

| Field                      | Value                                 | Source                    |
| -------------------------- | ------------------------------------- | ------------------------- |
| CLI bin                    | **Unchanged** `hotspot-scanner`       | ADR-2026-021              |
| Config file                | **Unchanged** `.hotspot-scanner.json` | Existing STATE lock       |
| Skill / agent folder names | **Unchanged** `vitals-*`              | STATE Decision 2026-07-21 |
| `#` import aliases         | **Unchanged**                         | Not package identity      |

**Status:** **Confirmed** — do not re-open

---

## Decision: Publish (LOCKED)

| Field                         | Value                                     |
| ----------------------------- | ----------------------------------------- |
| npm publish / `publishConfig` | **Out of scope** — remains STATE Deferred |
| Scope of this milestone       | Identity string + docs/prose only         |

**Status:** **Confirmed** — do not re-open

---

## Decision: Sweep scope (LOCKED)

| Include                                                    | Exclude                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| `package.json` `"name"`, `PACKAGE_NAME`, unit test         | Pipeline logic, schemas JSON body, scan/trend/assess contracts |
| Adoption docs (README, CONTRIBUTING, recipes)              | Renaming skill directories under `.cursor/skills/`             |
| Living docs identity headers / package citations           | Changing bin name or config filename                           |
| Done feature specs that cite the exact package string      | Inventing publish/install stories                              |
| `.cursor/` agents, skills **prose**, `session-context.mjs` | Changing `#` subpath import map keys                           |

**Verification:** `rg '@vitals/hotspot-scanner'` SHALL return **zero** matches after Execute.

**Status:** **Confirmed** — do not re-open

---

## Decision: API / contracts (LOCKED)

| Field                                | Value                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Scan / trend / assess JSON `version` | **Unchanged**                                                              |
| `schemas/` content                   | **No package-name fields** today — do not add                              |
| `getPackageVersion()`                | Reads `version` only — no change required beyond incidental string absence |

**Status:** **Confirmed** — do not re-open

---

## Agent notes (Execute)

1. Prefer exact-string replace `@vitals/hotspot-scanner` → `@taranti/hotspot-scanner` — do not rewrite surrounding prose unless package vs bin clarity requires it.
2. After replace, assert bin examples still say `hotspot-scanner` / `pnpm exec hotspot-scanner` where adoption docs distinguish package name from CLI.
3. Do **not** rename directories `vitals-spec-driven`, `vitals-execute`, `vitals-common`, `vitals-pipeline-domain`, `vitals-cli-validation`.
4. ROADMAP/STATE **title** lines that still say `@vitals/…` are Execute work (T3); planner already synced Current table + M79 stub + lasting Decision.
5. Fixtures under `tests/fixtures/` do not embed the package string today — touch only if sweep finds a hit.
