# Milestone 81 — Contributor DX (CI + toolchain + rename finish) Specification

**Feature slug:** `contributor-dx-ci`  
**Milestone:** ROADMAP M81  
**Depth:** Large  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1730–1759 (1755–1759 reserved)

## Problem Statement

Maintainers lack pinned toolchain files, CI, and a gate that includes lint/format. M79 left `@vitals/hotspot-scanner` and `vitals.dev` schema URL citations on live surfaces. Compiled CLI smoke hard-fails the whole suite when `dist/` is missing, which blocks local unit iteration without a prior build.

## Goals

- [x] `.nvmrc` (`22`), `packageManager` (`pnpm@11.9.0`), and `.editorconfig` exist
- [x] Schema `$id` / `$schema` URLs use the GitHub raw host; no contract `version` bumps
- [x] Live package-string leftovers of `@vitals/hotspot-scanner` cleared per context sweep rules
- [x] Required gate is `pnpm verify` ≡ `pnpm build && pnpm test && pnpm lint && pnpm format:check`
- [x] Compiled CLI smoke skips (not fails) when `dist/` is missing; runs when present
- [x] Minimal GHA workflow runs the expanded gate on push/PR to default branch
- [x] `pnpm verify` green after Execute

## Out of Scope

| Feature                                       | Reason                                |
| --------------------------------------------- | ------------------------------------- |
| Watch scripts (`test:watch`, `build:watch`)   | Not requested                         |
| Lefthook / simple-git-hooks / husky           | Explicitly deferred                   |
| npm publish / npx / `pnpm dlx`                | STATE Deferred                        |
| SARIF / fail-on-score / fail-on-deteriorating | STATE Deferred (product metric gates) |
| VS Code tasks / launch configs                | Not required for CI                   |
| Coverage threshold changes                    | Unchanged                             |
| Rename `vitals-*` skill folders               | STATE lock                            |
| Rename CLI bin / `.hotspot-scanner.json`      | ADR / existing locks                  |

---

## User Stories

### P1: Toolchain pin ⭐ MVP

**User Story**: As a contributor, I want Node 22 and pnpm pinned in-repo so that local and CI environments match.

**Why P1**: Prevents “works on my machine” drift before CI lands.

**Acceptance Criteria**:

1. WHEN the repo root is inspected THEN `.nvmrc` SHALL contain `22`
2. WHEN `package.json` is read THEN `"packageManager"` SHALL be `pnpm@11.9.0`
3. WHEN `.editorconfig` is read THEN it SHALL set `charset = utf-8`, `end_of_line = lf`, and indent width **2** spaces (consistent with Prettier defaults)

**Independent Test**: Open the three files; confirm pins.

**Requirements:** HOTSPOT-1730, HOTSPOT-1731, HOTSPOT-1732

---

### P1: Soft compiled-CLI smoke ⭐ MVP

**User Story**: As a developer iterating on unit tests, I want `pnpm test` to succeed without a prior build when I am not exercising compiled CLI smoke, while Done/CI still build first so smoke always runs.

**Why P1**: Removes false-red friction without weakening the gate.

**Acceptance Criteria**:

1. WHEN `dist/bin/hotspot-scanner.js` is missing THEN the compiled CLI smoke suite SHALL be **skipped** (Vitest `describe.skipIf` / `it.skipIf` or equivalent) with a clear skip reason — not a thrown error that fails the suite
2. WHEN that file exists THEN smoke tests SHALL run and SHALL pass for `scan` / `trend` / `assess` / `doctor` `--help` coverage already present
3. WHEN CONTRIBUTING and TESTING document iteration THEN they SHALL state: unit iteration without build is OK; Done/CI still run build before test via `pnpm verify`

**Independent Test**: Delete/rename `dist/` temporarily → `pnpm test` exits 0 with skips; after `pnpm build`, smoke cases execute.

**Requirements:** HOTSPOT-1733, HOTSPOT-1734, HOTSPOT-1735

---

### P1: Schema URL host migration ⭐ MVP

**User Story**: As a consumer of emitted `$schema` / config `$schema`, I want URLs that resolve on the real GitHub repo so identity matches `AlanTaranti/hotspot-scanner`.

**Why P1**: Completes ownership identity after M79/M80 without bumping contract versions.

**Acceptance Criteria**:

1. WHEN each file under `schemas/*.json` is read THEN `$id` SHALL use `https://raw.githubusercontent.com/AlanTaranti/hotspot-scanner/main/schemas/<file>.json`
2. WHEN `src/report/schema-urls.ts` and `src/config/exemplar.ts` are read THEN emitted URL constants SHALL use that same host/path pattern
3. WHEN contract / exemplar / doctor / config / bin tests assert `$schema` or `$id` THEN they SHALL expect the new URLs
4. WHEN living docs or other docs cite the old `https://vitals.dev/hotspot-scanner/schemas/…` host THEN they SHALL be updated to the new base
5. WHEN scan / trend / assess / config JSON contract `version` fields are checked THEN they SHALL remain unchanged (`3.0` / `3.0` / `1.0` / config as today)

**Independent Test**: Grep old host → zero; run contract + exemplar-related Vitest files.

**Requirements:** HOTSPOT-1736, HOTSPOT-1737, HOTSPOT-1738, HOTSPOT-1739, HOTSPOT-1740, HOTSPOT-1741

---

### P1: Finish `@vitals` → `@taranti` live package sweep ⭐ MVP

**User Story**: As an agent or contributor reading live docs and Cursor prose, I want current package identity to be `@taranti/hotspot-scanner` everywhere it is asserted as current.

**Why P1**: M79 left leftovers on living docs and Cursor surfaces.

**Acceptance Criteria**:

1. WHEN `.specs/codebase/*` titles/headers and package citations assert current identity THEN they SHALL use `@taranti/hotspot-scanner`
2. WHEN `.specs/project/{PROJECT,STATE}.md` titles/headers and AGENTS/CONTRIBUTING/README (if any leftovers) assert current identity THEN they SHALL use `@taranti/hotspot-scanner`
3. WHEN Cursor agents/skills prose and `session-context.mjs` cite the current package THEN they SHALL use `@taranti/hotspot-scanner` (skill **folders** stay `vitals-*`)
4. WHEN Done feature specs assert the **current** package name as `@vitals/hotspot-scanner` THEN they SHALL be updated; explicit rename-from / historical-before narrative MAY keep `@vitals/…` as the old name
5. WHEN live-path `rg '@vitals/hotspot-scanner'` is run per [context.md](./context.md) THEN it SHALL return zero matches on those live paths

**Independent Test**: Scoped `rg` on live paths; spot-check M79 from→to narrative still readable.

**Requirements:** HOTSPOT-1742, HOTSPOT-1743, HOTSPOT-1744, HOTSPOT-1745

---

### P1: Expanded Done gate + hook freshness ⭐ MVP

**User Story**: As a maintainer, I want lint and format check on the single required gate (and recognized by commit-gate hooks) so local Done and CI share one bar.

**Why P1**: User-locked expansion; replaces “lint/format optional” in CONTRIBUTING.

**Acceptance Criteria**:

1. WHEN `package.json` scripts are read THEN `verify` SHALL run `pnpm build && pnpm test && pnpm lint && pnpm format:check` (or equivalent chaining those four in order)
2. WHEN `quality-gates.mdc`, CONTRIBUTING, TESTING.md, and AGENTS/vitals-project gate pointers are read THEN the required gate SHALL be `pnpm verify` (and/or the expanded chain) — still **one** gate, no tiers
3. WHEN `record-gate-pass.mjs` / `hooks.json` matcher / gate reminder strings / hooks README / smoke cases are updated THEN a successful `pnpm verify` (or the full expanded chain) SHALL record gate freshness; split path SHALL require build + test + lint + format:check timestamps (or combined `gatePassedAt`)
4. WHEN living-sot lint rules ban inventing gate tiers THEN they SHALL remain satisfied (single required gate, longer command)
5. WHEN `contributing-sot.mdc` Allowed gate citation is outdated THEN it SHALL be updated to the new gate / `pnpm verify`

**Independent Test**: Run `pnpm verify`; exercise hooks smoke for record/allow after verify.

**Requirements:** HOTSPOT-1746, HOTSPOT-1747, HOTSPOT-1748, HOTSPOT-1749, HOTSPOT-1750

---

### P1: Minimal GitHub Actions CI ⭐ MVP

**User Story**: As a maintainer, I want push/PR CI on the default branch to run the expanded gate on Node 22 with a frozen lockfile.

**Why P1**: Locked minimal CI; supersedes M24 “no CI in v1” for this concern.

**Acceptance Criteria**:

1. WHEN `.github/workflows/` is inspected THEN at least one workflow SHALL run on `push` and `pull_request` to the default branch
2. WHEN the job runs THEN it SHALL use Node **22**, enable pnpm (Corepack or official setup-node/pnpm), and run `pnpm install --frozen-lockfile` then `pnpm verify`
3. WHEN the workflow is inspected THEN it SHALL NOT add fail-on-score, SARIF upload, or other product metric gates

**Independent Test**: Workflow YAML review; optional `act` not required — CI green on first PR after Execute.

**Requirements:** HOTSPOT-1751, HOTSPOT-1752, HOTSPOT-1753

---

### P1: End-to-end verify ⭐ MVP

**User Story**: As a maintainer, I want a final green `pnpm verify` and leftover checks so the milestone is Done-complete.

**Why P1**: Closes the feature under the new gate.

**Acceptance Criteria**:

1. WHEN Execute finishes THEN `pnpm verify` SHALL exit 0
2. WHEN live-path package-string and old schema-host greps run THEN they SHALL match the zero-leftover rules in context

**Independent Test**: Final gate task.

**Requirements:** HOTSPOT-1754

---

## Edge Cases

- WHEN only unit tests are run without `dist/` THEN smoke SHALL skip and other tests SHALL still run/fail on their own merits
- WHEN `pnpm test` is run alone after a stale/partial `dist/` THEN smoke SHALL run against whatever is present (may fail if stale — operators rebuild)
- WHEN hooks see `pnpm lint` or `pnpm format:check` alone THEN they SHALL record component timestamps but SHALL NOT set full `gatePassedAt` unless all required components (or `verify`) succeeded
- WHEN historical M79 from→to prose retains `@vitals/hotspot-scanner` as the **old** name THEN live-path zero-leftover checks SHALL still pass
- WHEN schema URL host changes THEN consumers relying on `vitals.dev` SHALL break resolution — accepted (additive host change; no version bump)

---

## Requirement Traceability

| Requirement ID    | Story                          | Phase | Status   |
| ----------------- | ------------------------------ | ----- | -------- |
| HOTSPOT-1730      | P1: Toolchain — `.nvmrc`       | Tasks | Done     |
| HOTSPOT-1731      | P1: Toolchain — packageManager | Tasks | Done     |
| HOTSPOT-1732      | P1: Toolchain — EditorConfig   | Tasks | Done     |
| HOTSPOT-1733      | P1: Smoke skip if no dist      | Tasks | Done     |
| HOTSPOT-1734      | P1: Smoke run when dist exists | Tasks | Done     |
| HOTSPOT-1735      | P1: Smoke docs (iteration)     | Tasks | Done     |
| HOTSPOT-1736      | P1: Schema `$id` files         | Tasks | Done     |
| HOTSPOT-1737      | P1: schema-urls.ts             | Tasks | Done     |
| HOTSPOT-1738      | P1: exemplar `$schema`         | Tasks | Done     |
| HOTSPOT-1739      | P1: Schema URL tests           | Tasks | Done     |
| HOTSPOT-1740      | P1: No version bump            | Tasks | Done     |
| HOTSPOT-1741      | P1: Docs citing old schema URL | Tasks | Done     |
| HOTSPOT-1742      | P1: Living docs package sweep  | Tasks | Done     |
| HOTSPOT-1743      | P1: Feature prose package      | Tasks | Done     |
| HOTSPOT-1744      | P1: Cursor package prose       | Tasks | Done     |
| HOTSPOT-1745      | P1: Live-path zero leftovers   | Tasks | Done     |
| HOTSPOT-1746      | P1: `verify` script            | Tasks | Done     |
| HOTSPOT-1747      | P1: quality-gates SoT          | Tasks | Done     |
| HOTSPOT-1748      | P1: CONTRIBUTING/TESTING gate  | Tasks | Done     |
| HOTSPOT-1749      | P1: Hooks gate freshness       | Tasks | Done     |
| HOTSPOT-1750      | P1: Single gate (no tiers)     | Tasks | Done     |
| HOTSPOT-1751      | P1: GHA workflow triggers      | Tasks | Done     |
| HOTSPOT-1752      | P1: GHA Node22 + verify        | Tasks | Done     |
| HOTSPOT-1753      | P1: No metric/SARIF CI         | Tasks | Done     |
| HOTSPOT-1754      | P1: Final `pnpm verify`        | Tasks | Done     |
| HOTSPOT-1755–1759 | —                              | —     | Reserved |

**Coverage:** 25 numbered + 5 reserved; all P1 mapped in tasks.md.

---

## Success Criteria

- [x] Contributors can run `pnpm verify` as the single Done bar; CI runs the same
- [x] Local `pnpm test` without `dist/` does not hard-fail on compiled smoke
- [x] Live docs/Cursor cite `@taranti/hotspot-scanner`; schema URLs use GitHub raw host
- [x] No contract `version` bumps; no SARIF/fail-on/publish in this milestone
