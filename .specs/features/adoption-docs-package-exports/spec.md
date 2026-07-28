# Milestone 45 — Adoption Docs & Package Exports Map Specification

**Feature slug:** `adoption-docs-package-exports`  
**Milestone:** ROADMAP M45  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [README.md](../../../README.md), [package.json](../../../package.json)  
**Depth:** Medium (docs + `package.json` metadata; thin `design.md`)  
**Sister:** [readme-adoption-dx](../readme-adoption-dx/spec.md) (M37)  
**IDs:** HOTSPOT-620–639 | **Items:** 29, 30, 31, 32

## Problem Statement

Post-M37 adoption DX got evaluators past the GitHub first screen, but day-2 workflows still live as one-liners in README (“Use this when…”). There is no short cookbook for weekly triage, PR markdown reports, monorepo config, or baseline/compare. README sample tables have drifted: Quick start shows the current rich fixture table, while **Output formats → Table** still shows an older simplified sample (wrong columns, scores, and scan timestamp). Warning codes are buried in Advanced; package consumers have `main`/`types` but no `"exports"` map for the public `runScan` entry — publish remains deferred, but Node resolution prep should land now.

## Goals

- [ ] Ship `docs/recipes.md` with four short cookbooks (weekly triage, PR markdown, monorepo config, baseline/compare)
- [ ] Eliminate README sample-table drift: all CLI table samples match a fresh `small-ts` fixture run
- [ ] Publish a short warning-codes cheatsheet under `docs/` with README linkage
- [ ] Add `package.json` `"exports"` for the public package entry (`./dist/index.js` + types) — **no npm publish**
- [ ] Link recipes/cheatsheet from README without a full M37 restructure

## Out of Scope

| Feature                                                       | Reason                                             |
| ------------------------------------------------------------- | -------------------------------------------------- |
| npm publish / npx / `pnpm dlx`                                | Deferred (STATE); M45 is prep only for `"exports"` |
| Changing scanner pipeline, rankings, or warning `code` values | Docs + package metadata only                       |
| M37 README rewrite beyond sample sync + links                 | Sister Done; do not re-open structure              |
| M44 coupling `package.json` `exports`/`imports` resolution    | Separate milestone (static enrich)                 |
| New CLI flags / subcommands                                   | M38–M42                                            |
| Expanding public API surface beyond current `src/index.ts`    | YAGNI — map what already exports                   |
| Adding `docs/` to npm `files` for publish                     | Optional later; GitHub readers get docs via clone  |

---

## User Stories

### P1: Recipes cookbook ⭐ MVP

**User Story**: As a tech lead adopting the CLI, I want short copy-paste cookbooks for common workflows so that I can run weekly triage, PR reports, monorepo scoping, and baseline compare without re-deriving flags from the full README.

**Why P1**: Item 29 — day-2 adoption; README “Use this when…” is too thin.

**Acceptance Criteria**:

1. WHEN the repo is checked THEN `docs/recipes.md` SHALL exist with four sections: weekly triage, PR markdown report, monorepo config, baseline/compare
2. WHEN each recipe is read THEN it SHALL include runnable `hotspot-scanner` / `pnpm exec hotspot-scanner` command examples (and config JSON snippets where relevant for monorepo)
3. WHEN recipes reference fixture validation THEN they MAY cite `tests/fixtures/repos/small-ts` as a safe local try-path without inventing unpublished install stories
4. WHEN README “Use this when…” (or TOC) is updated THEN it SHALL link to `docs/recipes.md` (no requirement to delete the short table)

**Independent Test**: Open `docs/recipes.md`; confirm four headings + commands; `rg 'docs/recipes.md' README.md`.

**Requirements**: HOTSPOT-620, HOTSPOT-621, HOTSPOT-622, HOTSPOT-623, HOTSPOT-624

---

### P1: Sync README sample tables with `small-ts` ⭐ MVP

**User Story**: As a GitHub reader, I want every CLI table sample in the README to match real fixture output so that I am not confused by conflicting columns or scores.

**Why P1**: Item 30 — known drift between Quick start and mid-doc Table samples.

**Acceptance Criteria**:

1. WHEN Quick start “Example output” and Output formats → Table samples are compared THEN they SHALL show the same column set and the same ranked rows/scores from one capture of `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts` (timestamps may be labeled as fixture/example; truncate rows only if both samples use the same truncation rule)
2. WHEN the mid-doc Table sample is read THEN it SHALL NOT use the obsolete simplified columns (`Complexity` / `Churn` only without raw Cpx/Churn/Funcs/Authors) that currently disagree with Quick start
3. WHEN `docs/assets/cli-table-small-ts.png` is still referenced THEN Execute SHALL refresh the asset if the regenerated table no longer matches the screenshot (or document “asset matches current sample” after re-capture)
4. WHEN samples are labeled THEN they SHALL remain clearly fixture/`small-ts` examples (M37 voice)

**Independent Test**: Diff the two fenced table samples for column headers + top hotspot/coupling rows; run fixture scan and compare.

**Requirements**: HOTSPOT-625, HOTSPOT-626, HOTSPOT-627, HOTSPOT-628

---

### P1: Warning-codes cheatsheet ⭐ MVP

**User Story**: As an operator filtering `meta.warnings`, I want a short cheatsheet of stable warning `code`s so that I can look them up without scrolling Advanced prose.

**Why P1**: Item 31.

**Acceptance Criteria**:

1. WHEN the repo is checked THEN `docs/warning-codes.md` SHALL exist as a short page listing stable codes currently documented in README Advanced (at minimum: `EMPTY_SINCE_WINDOW`, `RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, `COMPARE_SINCE_MISMATCH`, `MEGA_COMMIT_SKIPPED`) with one-line interpretation each
2. WHEN the cheatsheet is read THEN it SHALL note that `severity` does not change exit code on successful scan (align with README)
3. WHEN README Advanced “Warning codes” is updated THEN it SHALL link to `docs/warning-codes.md` as the lookup page (README may keep a short table or become a pointer + link — no contradictory codes)
4. WHEN codes are listed THEN values SHALL match existing product codes — **no new codes invented**

**Independent Test**: Open cheatsheet; `rg 'docs/warning-codes.md' README.md`; compare codes to README / `src/` emitters.

**Requirements**: HOTSPOT-629, HOTSPOT-630, HOTSPOT-631, HOTSPOT-632

---

### P1: `package.json` `"exports"` map (publish prep) ⭐ MVP

**User Story**: As a future package consumer (and as Node resolution), I want an `"exports"` map pointing at the public entry so that `import { runScan } from '@taranti/hotspot-scanner'` resolves types and ESM correctly when publish eventually happens.

**Why P1**: Item 32 — metadata prep; no publish.

**Acceptance Criteria**:

1. WHEN `package.json` is read THEN it SHALL include an `"exports"` map whose `"."` entry resolves to `./dist/index.js` with `"types"` → `./dist/index.d.ts` (and `"import"` or equivalent ESM condition matching `"type": "module"`)
2. WHEN `"main"` / `"types"` / `"bin"` are checked THEN they SHALL remain consistent with today’s public entry and CLI bin (do not remove them)
3. WHEN `"exports"` is added THEN it SHALL **not** publish the package, invent registry install docs, or expand the public API beyond what `src/index.ts` already exports (`runScan`, compare helpers, types, `PACKAGE_NAME`)
4. WHEN `pnpm build` completes THEN `dist/index.js` and `dist/index.d.ts` SHALL remain the targets referenced by `"exports"`

**Independent Test**: Inspect `package.json` `"exports"`; `pnpm build`; confirm paths exist; gate green.

**Requirements**: HOTSPOT-633, HOTSPOT-634, HOTSPOT-635, HOTSPOT-636

---

### P2: README / TOC discovery links

**User Story**: As a README reader, I want TOC or section links to recipes and warning codes so that secondary docs are discoverable.

**Why P2**: Completes adoption path without forcing a full README rewrite.

**Acceptance Criteria**:

1. WHEN TOC or “Use this when…” / Advanced warnings sections are read THEN links to `docs/recipes.md` and `docs/warning-codes.md` SHALL be present
2. WHEN Programmatic API section mentions the package entry THEN it MAY note that `"exports"` maps to `dist/index.js` (one sentence; no npm install story)

**Independent Test**: `rg 'docs/recipes.md|docs/warning-codes.md' README.md`.

**Requirements**: HOTSPOT-637, HOTSPOT-638

---

## Edge Cases

- WHEN fixture scan output changes after an unrelated scoring change THEN samples SHALL be re-captured in the same Execute pass as the sync (do not leave mid-doc stale)
- WHEN a warning code exists only in tests (`GIT_WARNING` / `CX_WARNING` stubs) THEN the cheatsheet SHALL omit it unless it is a real product emitter
- WHEN `"exports"` accidentally blocks `bin` resolution THEN Execute SHALL keep `"bin"` field and verify `pnpm exec hotspot-scanner --help` still works after build
- WHEN recipes mention monorepo config THEN they SHALL align with existing `.hotspot-scanner.json` + parent-walk / `--include` / `--exclude` docs (no new config keys)

---

## Requirement Traceability

| Requirement ID | Story                                           | Phase | Status  |
| -------------- | ----------------------------------------------- | ----- | ------- |
| HOTSPOT-620    | P1: Recipes — file exists                       | Tasks | Pending |
| HOTSPOT-621    | P1: Recipes — weekly triage                     | Tasks | Pending |
| HOTSPOT-622    | P1: Recipes — PR markdown                       | Tasks | Pending |
| HOTSPOT-623    | P1: Recipes — monorepo config                   | Tasks | Pending |
| HOTSPOT-624    | P1: Recipes — baseline/compare                  | Tasks | Pending |
| HOTSPOT-625    | P1: Sample sync — single capture SoT            | Tasks | Pending |
| HOTSPOT-626    | P1: Sample sync — Quick start matches capture   | Tasks | Pending |
| HOTSPOT-627    | P1: Sample sync — mid-doc Table matches capture | Tasks | Pending |
| HOTSPOT-628    | P1: Sample sync — asset refresh if needed       | Tasks | Pending |
| HOTSPOT-629    | P1: Cheatsheet — `docs/warning-codes.md`        | Tasks | Pending |
| HOTSPOT-630    | P1: Cheatsheet — severity vs exit code note     | Tasks | Pending |
| HOTSPOT-631    | P1: Cheatsheet — README link / no contradiction | Tasks | Pending |
| HOTSPOT-632    | P1: Cheatsheet — stable codes only              | Tasks | Pending |
| HOTSPOT-633    | P1: exports — `"."` → dist/index                | Tasks | Pending |
| HOTSPOT-634    | P1: exports — main/types/bin kept               | Tasks | Pending |
| HOTSPOT-635    | P1: exports — no publish / no API expand        | Tasks | Pending |
| HOTSPOT-636    | P1: exports — build targets exist               | Tasks | Pending |
| HOTSPOT-637    | P2: README links to recipes                     | Tasks | Pending |
| HOTSPOT-638    | P2: README links / API note for exports         | Tasks | Pending |
| HOTSPOT-639    | Cross-cutting — ROADMAP/STATE + full gate       | Tasks | Pending |

**Coverage:** 20 total (HOTSPOT-620–639), mapped in tasks.md.

---

## Success Criteria

- [ ] `docs/recipes.md` and `docs/warning-codes.md` exist and are linked from README
- [ ] Quick start and Output formats → Table samples agree with a real `small-ts` run
- [ ] `package.json` has `"exports"` for `.` → `./dist/index.js` + types; no publish
- [ ] `pnpm build && pnpm test` passes; CLI still runs via `pnpm exec hotspot-scanner`
