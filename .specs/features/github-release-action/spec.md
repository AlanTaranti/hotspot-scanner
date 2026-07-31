# Milestone 82 — GitHub Release Action Specification

**Feature slug:** `github-release-action`  
**Milestone:** ROADMAP M82  
**Depth:** Medium  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1760–1779 (1775–1779 reserved)  
**Sister:** M83 [`npm-publish-oidc`](../npm-publish-oidc/spec.md) (after this Done)

## Problem Statement

Maintainers have CI on push/PR ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)) but no intentional release path. Version cuts today would be ad hoc (manual tag/UI) without a repeatable gate, bump, and GitHub Release. npm publish remains deferred (M83); this milestone only ships GitHub-side release automation.

## Goals

- [ ] One `workflow_dispatch` workflow `.github/workflows/release.yml` with input `bump` ∈ {`major`,`minor`,`patch`}
- [ ] Job bumps `package.json` version, commits, tags `vX.Y.Z`, pushes to the default branch
- [ ] Job runs `pnpm verify` on the bumped tree
- [ ] Job creates a GitHub Release for that tag (generated notes; no asset uploads)
- [ ] CONTRIBUTING documents how maintainers cut a release
- [ ] No npm publish / OIDC / contract JSON version bumps
- [ ] `pnpm verify` green after Execute

## Out of Scope

| Feature                                              | Reason                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| npm publish / Trusted Publishing / `NPM_TOKEN`       | M83                                         |
| `npx` / `pnpm dlx` as official install               | After M83 Done                              |
| semantic-release / changesets                        | YAGNI                                       |
| Three separate bump workflows                        | Single YAML + input                         |
| Tag-push-only or push-to-`main` auto-release         | Intentional dispatch only                   |
| Upload `dist/` or tarball assets to GitHub Release   | CLI consumers use clone (then npm in M83)   |
| JSON contract `version` bumps (`3.0` / assess `1.0`) | Semver package ≠ schema contract            |
| Changes to scan/trend/assess product behavior        | Release tooling only                        |
| Replacing or removing `ci.yml`                       | Coexists                                    |

---

## User Stories

### P1: Manual release workflow ⭐ MVP

**User Story**: As a maintainer, I want a single GitHub Action I can run by hand with major/minor/patch so that version cuts are intentional and consistent.

**Why P1**: Removes ad-hoc tagging without forcing continuous release on every merge.

**Acceptance Criteria**:

1. WHEN the repo workflows are listed THEN `.github/workflows/release.yml` SHALL exist
2. WHEN the workflow is inspected THEN its only release trigger SHALL be `workflow_dispatch`
3. WHEN `workflow_dispatch` inputs are inspected THEN a required `bump` choice SHALL offer exactly `major`, `minor`, and `patch`
4. WHEN the workflow runs THEN it SHALL NOT publish to npm and SHALL NOT request `id-token` write

**Independent Test**: Open `release.yml`; confirm trigger, inputs, and absence of publish/OIDC steps.

**Requirements:** HOTSPOT-1760, HOTSPOT-1761, HOTSPOT-1762, HOTSPOT-1763

---

### P1: Bump, commit, and tag ⭐ MVP

**User Story**: As a maintainer, I want the Action to bump the package version and create a matching git tag so that `package.json` and the Release tag stay aligned.

**Why P1**: Core of intentional semver cuts.

**Acceptance Criteria**:

1. WHEN the job runs with a chosen `bump` THEN it SHALL update `package.json` `"version"` via `pnpm version <bump>` (or equivalent that yields the same field change)
2. WHEN the new version is `X.Y.Z` THEN the job SHALL create and push tag `vX.Y.Z`
3. WHEN the bump commit is created THEN it SHALL be pushed to the repository default branch with a clear conventional-style message that includes the new version
4. WHEN the Action runs THEN it SHALL NOT modify scan/trend/assess JSON contract `version` strings or schema `$id` hosts

**Independent Test**: Dry-read the bump/tag steps; after Execute, a dispatch on a test fork or protected dry-run path shows version+tag alignment (maintainer checklist in tasks).

**Requirements:** HOTSPOT-1764, HOTSPOT-1765, HOTSPOT-1766, HOTSPOT-1767

---

### P1: Verify then GitHub Release ⭐ MVP

**User Story**: As a maintainer, I want the release job to run the project gate and then create a GitHub Release so that tagged versions are gate-green and visible on the Releases page.

**Why P1**: Gate before cut; Release is the public marker (npm comes later).

**Acceptance Criteria**:

1. WHEN the bumped tree is ready THEN the job SHALL run `pnpm verify` (install with frozen lockfile + toolchain pins consistent with CI)
2. WHEN `pnpm verify` fails THEN the job SHALL fail and SHALL NOT create a GitHub Release for that run
3. WHEN `pnpm verify` succeeds THEN the job SHALL create a GitHub Release for tag `vX.Y.Z` with generated notes (`--generate-notes` or action equivalent)
4. WHEN the Release is created THEN it SHALL NOT attach `dist/` or other build artifacts as Release assets

**Independent Test**: Read job order (verify before release create); confirm no `upload-artifact` / asset paths for release binaries.

**Requirements:** HOTSPOT-1768, HOTSPOT-1769, HOTSPOT-1770, HOTSPOT-1771

---

### P1: Contributor docs ⭐ MVP

**User Story**: As a maintainer, I want CONTRIBUTING to explain how to cut a release so that the workflow is discoverable without reading the YAML.

**Why P1**: Human path for a manual Action.

**Acceptance Criteria**:

1. WHEN CONTRIBUTING is read THEN a Releasing (or equivalently titled) section SHALL describe `workflow_dispatch` on `release.yml` and the `bump` choices
2. WHEN that section is read THEN it SHALL state that npm publish is **not** part of this workflow yet (M83 / Deferred until then)
3. WHEN that section is read THEN it SHALL note that package semver bumps do not change JSON report contract versions

**Independent Test**: Grep CONTRIBUTING for release / `release.yml` / bump guidance.

**Requirements:** HOTSPOT-1772, HOTSPOT-1773, HOTSPOT-1774

---

## Requirement Traceability

| Requirement ID | Story                              | Tasks | Status  |
| -------------- | ---------------------------------- | ----- | ------- |
| HOTSPOT-1760   | P1: Workflow file exists           | T1    | Planned |
| HOTSPOT-1761   | P1: `workflow_dispatch` only       | T1    | Planned |
| HOTSPOT-1762   | P1: `bump` major/minor/patch       | T1    | Planned |
| HOTSPOT-1763   | P1: No npm / no `id-token`         | T1    | Planned |
| HOTSPOT-1764   | P1: `pnpm version` bump            | T1    | Planned |
| HOTSPOT-1765   | P1: Tag `vX.Y.Z`                   | T1    | Planned |
| HOTSPOT-1766   | P1: Push bump commit               | T1    | Planned |
| HOTSPOT-1767   | P1: No contract version bump       | T1    | Planned |
| HOTSPOT-1768   | P1: `pnpm verify` in job           | T1    | Planned |
| HOTSPOT-1769   | P1: Fail stops Release             | T1    | Planned |
| HOTSPOT-1770   | P1: GitHub Release + notes         | T1    | Planned |
| HOTSPOT-1771   | P1: No Release assets              | T1    | Planned |
| HOTSPOT-1772   | P1: CONTRIBUTING Releasing         | T2    | Planned |
| HOTSPOT-1773   | P1: Docs — no npm yet              | T2    | Planned |
| HOTSPOT-1774   | P1: Docs — semver ≠ contract       | T2    | Planned |
| HOTSPOT-1775–1779 | Reserved                        | —     | —       |

---

## Success Criteria

- Maintainer can cut major/minor/patch from Actions UI
- Tag, `package.json` version, and GitHub Release stay aligned
- Gate runs before Release; no npm in this milestone
- CONTRIBUTING documents the path
