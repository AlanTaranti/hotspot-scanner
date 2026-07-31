# Milestone 82 — GitHub Release Action Context

**Feature slug:** `github-release-action`  
**Milestone:** ROADMAP M82  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-1760–1779 (1775–1779 reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Sister:** M83 [`npm-publish-oidc`](../npm-publish-oidc/context.md) (depends on this milestone Done)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (unchanged — no pipeline logic)

---

## Intent

Give maintainers an intentional, repeatable way to cut a package version: one manual GitHub Actions workflow that bumps semver, tags `vX.Y.Z`, runs the project gate, and creates a GitHub Release. No npm publish in this milestone (that is M83).

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                                  |
| --------- | ---------------------------------------------------------------------- |
| Milestone | **M82**                                                                |
| Slug      | `github-release-action`                                                |
| Depth     | **Medium** (workflow + CONTRIBUTING; no `src/` / `bin/` / product CLI) |
| IDs       | **HOTSPOT-1760–1779** (next free band after M81 HOTSPOT-1730–1759)     |
| Priority  | **High** (release hygiene before public npm)                           |

**Status:** **Confirmed** — do not re-open

---

## Decision: Single workflow + bump input (LOCKED)

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| File             | `.github/workflows/release.yml`                                       |
| Trigger          | `workflow_dispatch` only                                              |
| Input            | `bump`: choice `major` \| `minor` \| `patch` (required)               |
| Not used         | Separate major/minor/patch YAMLs; push-to-`main` release; tag-push-only release without bump |

**Status:** **Confirmed** — do not re-open

---

## Decision: Version / tag / Release behavior (LOCKED)

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Bump tool          | `pnpm version <bump>` (updates `package.json`; lockfile only if the tool touches it)           |
| Tag format         | `v` + `package.json` `version` (e.g. `v1.2.3`)                                                 |
| Git                | Commit version bump on default branch + annotated or lightweight tag + push                    |
| Gate in job        | `pnpm verify` after checkout of the bumped tree (same bar as CI)                               |
| GitHub Release     | Create Release for the tag; notes via `gh release create … --generate-notes` (or equivalent) |
| Release assets     | **None** (no `dist/` tarball upload)                                                           |
| JSON contracts     | **Never** bump scan/trend/assess `version` fields from this Action                             |

**Status:** **Confirmed** — do not re-open

---

## Decision: Permissions and actor (LOCKED)

| Field        | Value                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------- |
| Permissions  | `contents: write` (commit, tag, GitHub Release)                                               |
| Token        | Default `GITHUB_TOKEN`                                                                        |
| Commit actor | `github-actions[bot]` (or documented equivalent)                                              |
| Protection   | Design documents branch-protection interaction; Execute may need bypass rule for the bot     |
| npm / OIDC   | **Out of scope** — no `id-token`, no `NPM_TOKEN`, no publish step                             |

**Status:** **Confirmed** — do not re-open

---

## Decision: Docs surface (LOCKED)

| Doc              | Change                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| CONTRIBUTING.md  | Short “Releasing” section: who may run, how to dispatch, bump choices |
| README.md        | No install-path change in M82 (still clone + build)                   |
| STATE Deferred   | npm remains deferred until M83 Planned/Done                           |

**Status:** **Confirmed** — do not re-open

---

## Explicit non-goals

- semantic-release / changesets / Conventional Commit auto-bump from PR titles
- Three workflows (one per bump level)
- npm publish / Trusted Publishing / `npx` docs
- Attaching build artifacts to the GitHub Release
- Changing CI (`ci.yml`) beyond coexistence
