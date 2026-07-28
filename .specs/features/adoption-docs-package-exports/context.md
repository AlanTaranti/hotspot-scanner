# Milestone 45 — Adoption Docs & Package Exports — Context

**Feature:** `adoption-docs-package-exports`  
**Captured:** 2026-07-24 (planning)  
**Source:** User locked scope for ROADMAP M45 / items 29–32

## Locked decisions

| Topic              | Decision                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depth              | **Medium** — docs + `package.json` metadata; thin `design.md`; formal `tasks.md`                                                                      |
| Recipes            | Create **`docs/recipes.md`** with four cookbooks: weekly triage, PR markdown report, monorepo config, baseline/compare                                |
| Sample sync        | Sync **all** README CLI table samples to one real capture from `tests/fixtures/repos/small-ts`; eliminate Quick start vs Output formats → Table drift |
| Warning cheatsheet | Dedicated short page **`docs/warning-codes.md`** (not only a recipes subsection); README Advanced links to it                                         |
| Package exports    | Add `"exports"` for public entry only (`runScan` / types via `./dist/index.js` + `./dist/index.d.ts`); keep `main`/`types`/`bin`                      |
| Publish            | **No** npm publish / npx / registry install story                                                                                                     |
| Pipeline           | **No** scanner/ranking/warning-code value changes                                                                                                     |
| M37                | **No** full README rewrite — sample sync + links to recipes/cheatsheet only                                                                           |

## Agent discretion (Execute)

| Topic                         | Guidance                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Recipe length                 | Short (roughly half-page each); prefer commands + minimal prose                                           |
| README Advanced warning table | Keep slim table **or** replace with pointer + link — must not contradict cheatsheet                       |
| PNG asset                     | Re-capture `docs/assets/cli-table-small-ts.png` only if visual no longer matches regenerated table        |
| `"exports"` conditions        | Prefer modern ESM: `".": { "types": "...", "import": "..." }`; optional `"./package.json"` self-export OK |
| Internal `#imports`           | Do **not** re-export package `"imports"` subpaths as public `"exports"`                                   |
| `files` array                 | Leave as-is unless Execute finds a hard reason; docs are for GitHub/clone readers                         |

## Sister / related

- M37 [readme-adoption-dx](../readme-adoption-dx/) — Done; adoption top + sample asset
- M44 [coupling-package-exports](../coupling-package-exports/) — **different** concern (static enrich of dependency `exports`/`imports`)
- Deferred: npm publish / npx (STATE.md)
