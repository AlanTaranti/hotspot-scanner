# Milestone 81 — Contributor DX (CI + toolchain + rename finish) Context

**Feature slug:** `contributor-dx-ci`  
**Milestone:** ROADMAP M81  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-1730–1759 (1755–1759 reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (schema `$schema` host only; no pipeline logic)

---

## Intent

Ship maintainer DX: pin Node/pnpm + EditorConfig, finish the post-M79 package-string and schema-URL identity cleanup, expand the single required quality gate to include lint + format check, soften local `pnpm test` when `dist/` is missing, and add minimal GitHub Actions CI that runs that gate. Not product metric gates, not publish.

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Milestone | **M81** (single milestone — no M82 split)                          |
| Slug      | `contributor-dx-ci`                                                |
| Depth     | **Large**                                                          |
| IDs       | **HOTSPOT-1730–1759** (next free band after M80 HOTSPOT-1720–1729) |
| Priority  | **High** (contributor/CI readiness)                                |

**Why one milestone:** Path Conflict Check allows a clean serialized/parallel task graph under one slug; CI, gate, rename, and smoke share CONTRIBUTING/TESTING/hooks ownership that would duplicate if split.

**Status:** **Confirmed** — do not re-open

---

## Decision: Expanded gate + named script (LOCKED)

| Field           | Value                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Required gate   | `pnpm build && pnpm test && pnpm lint && pnpm format:check`            |
| Named DX script | `pnpm verify` → runs the four steps **in that order**                  |
| Documented gate | Prefer citing `pnpm verify` (equivalent to the expanded chain)         |
| `typecheck`     | Remains recommended optional (not on the gate — `build` already emits) |
| Gate tiers      | Still **one** required gate (no Quick/Full/Build tiers)                |

**Status:** **Confirmed** — do not re-open

---

## Decision: Schema URL host (LOCKED)

| Field   | Value                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| From    | `https://vitals.dev/hotspot-scanner/schemas/<file>.json`                                 |
| To      | `https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/<file>.json` |
| Scope   | `$id` in `schemas/*.json`, emitted `$schema` constants, exemplar, tests, docs citing URL |
| Version | **No** JSON contract `version` bumps (scan `3.0`, trend `3.0`, assess `1.0`)             |

**Status:** **Confirmed** — do not re-open

---

## Decision: Package-string leftover sweep (LOCKED)

| Include                                                              | Exclude / keep                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Live surfaces asserting current package (`@taranti/hotspot-scanner`) | `vitals-*` skill **folder** names                                             |
| Cursor agents/skills **prose**, `session-context.mjs`                | CLI bin `hotspot-scanner`, `.hotspot-scanner.json`                            |
| Done feature prose that claims current package is `@vitals/...`      | Explicit rename-from / historical-before narrative (e.g. M79 from→to wording) |

**Verification:** `rg '@vitals/hotspot-scanner'` returns **zero** on live paths (`.specs/codebase/`, `.specs/project/{PROJECT,STATE}.md` titles/headers, `AGENTS.md`, CONTRIBUTING/README, `.cursor/agents|skills|hooks` prose). Historical from→to in M79 feature artifacts / ROADMAP M79 archive may retain the old string only as the **source** of a rename.

**Status:** **Confirmed** — do not re-open

---

## Decision: Soft compiled-CLI smoke (LOCKED)

| When `dist/bin/hotspot-scanner.js` is missing | Vitest **skips** the compiled smoke suite (clear message) — does **not** fail the suite |
| When `dist/` exists after `pnpm build` | Smoke tests **must** run and pass |
| Done / CI order | Always `build` then `test` (via `pnpm verify`) so smoke always executes |

**Status:** **Confirmed** — do not re-open

---

## Decision: CI (LOCKED)

| Field   | Value                                                           |
| ------- | --------------------------------------------------------------- |
| Trigger | Push + pull_request to default branch                           |
| Node    | **22** (match `.nvmrc` / `engines`)                             |
| Install | `pnpm install --frozen-lockfile`                                |
| Gate    | `pnpm verify` (or explicit expanded chain)                      |
| Out     | No fail-on-score, no SARIF, no product metric gates, no publish |

**Status:** **Confirmed** — do not re-open

---

## Decision: Toolchain pin (LOCKED)

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Node pin file | `.nvmrc` with `22`                                                                            |
| pnpm pin      | `package.json` `"packageManager": "pnpm@11.9.0"` (env at planning: `pnpm --version` → 11.9.0) |
| EditorConfig  | `.editorconfig` — utf-8, lf, indent 2 spaces (Prettier default)                               |
| Git hooks     | No lefthook/husky in this milestone                                                           |

**Status:** **Confirmed** — do not re-open

---

## Decision: Out of scope (LOCKED)

Watch scripts, lefthook/simple-git-hooks, npm publish/npx, SARIF / fail-on-deteriorating / fail-on-score, VS Code tasks/launch (unless CI needs none), coverage threshold changes, renaming `vitals-*` skill folders.

**Status:** **Confirmed** — do not re-open

---

## Supersedes

- M24 [package-dx](../package-dx/spec.md) “no CI in v1” — this milestone **adds** minimal CI; does not reopen M24 Done narrative wholesale.
- STATE Deferred “CI recipes / fail-on stable deltas / SARIF” — **minimal CI** absorbed here; **fail-on / SARIF remain Deferred**.
