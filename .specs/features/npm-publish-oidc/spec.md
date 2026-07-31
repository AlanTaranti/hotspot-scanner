# Milestone 83 — npm Publish via OIDC Specification

**Feature slug:** `npm-publish-oidc`  
**Milestone:** ROADMAP M83  
**Depth:** Medium  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1780–1799 (1795–1799 reserved)  
**Depends on:** M82 [`github-release-action`](../github-release-action/spec.md) Done

## Problem Statement

M82 creates version tags and GitHub Releases but does not publish to npm. STATE still defers the registry install path. Maintainers need Trusted Publishing (OIDC) from the existing `release.yml` so `@taranti/hotspot-scanner` can ship without long-lived npm tokens, and README must document registry install once publish works.

## Goals

- [ ] `release.yml` gains `id-token: write` and a post-Release publish step (no `NPM_TOKEN` for steady state)
- [ ] Publish targets public `@taranti/hotspot-scanner` on registry.npmjs.org with provenance-capable Trusted Publishing
- [ ] CONTRIBUTING documents Trusted Publisher setup + first-publish prerequisite
- [ ] README documents official registry install (clone path retained for contributors)
- [ ] STATE Deferred npm path closed/narrowed on Done; lasting Decision for OIDC-only publish
- [ ] `pnpm verify` green after Execute (workflow/docs); live publish verified by maintainer checklist after Trusted Publisher is configured

## Out of Scope

| Feature                                         | Reason                                |
| ----------------------------------------------- | ------------------------------------- |
| Renaming or splitting `release.yml`             | Trusted Publisher filename lock       |
| Steady-state `NPM_TOKEN` auth                   | OIDC only                             |
| Private npm / GitHub Packages as primary        | Public registry                       |
| Changing bump/Release behavior from M82         | Extend only                           |
| JSON contract `version` bumps                   | Unrelated to package semver           |
| semantic-release / changesets                   | YAGNI                                 |
| Product CLI behavior changes                    | Publish tooling only                  |

---

## User Stories

### P1: OIDC permissions and publish step ⭐ MVP

**User Story**: As a maintainer, I want the release workflow to publish to npm with OIDC after a successful GitHub Release so that each intentional bump also ships the package.

**Why P1**: Closes the registry path without a second manual publish ritual.

**Acceptance Criteria**:

1. WHEN `release.yml` permissions are read THEN they SHALL include `contents: write` and `id-token: write`
2. WHEN the job succeeds through GitHub Release THEN a subsequent step SHALL run publish for `@taranti/hotspot-scanner` to `https://registry.npmjs.org`
3. WHEN the publish step is configured THEN it SHALL NOT require `NPM_TOKEN` / `NODE_AUTH_TOKEN` secrets for the Trusted Publishing path
4. WHEN Node/npm tooling is set up THEN the job SHALL ensure npm CLI ≥ 11.5.1 (or document equivalent pnpm publish path that supports Trusted Publishing)
5. WHEN `setup-node` (or equivalent) runs THEN registry URL SHALL be `https://registry.npmjs.org`

**Independent Test**: Diff `release.yml` vs M82; confirm permission + publish step order and absence of token secrets.

**Requirements:** HOTSPOT-1780, HOTSPOT-1781, HOTSPOT-1782, HOTSPOT-1783, HOTSPOT-1784

---

### P1: Trusted Publisher prerequisite docs ⭐ MVP

**User Story**: As a maintainer, I want CONTRIBUTING to explain the one-time npm Trusted Publisher setup and first-publish chicken-egg so that OIDC works before the Action can publish.

**Why P1**: Without package existence + Trusted Publisher binding, CI publish fails opaquely.

**Acceptance Criteria**:

1. WHEN CONTRIBUTING Releasing is read THEN it SHALL list Trusted Publisher fields: GitHub `AlanTaranti`, repo `hotspot-scanner`, workflow filename `release.yml`
2. WHEN that section is read THEN it SHALL state that the package must exist on npmjs before Trusted Publisher can be configured (one-time maintainer prerequisite)
3. WHEN that section is read THEN it SHALL state steady-state auth is OIDC (no long-lived token)

**Independent Test**: Grep CONTRIBUTING for Trusted Publisher / OIDC / `release.yml`.

**Requirements:** HOTSPOT-1785, HOTSPOT-1786, HOTSPOT-1787

---

### P1: README registry install ⭐ MVP

**User Story**: As a user, I want README install instructions that include the published package so that I am not forced to clone to try the CLI.

**Why P1**: Adoption path after first successful publish.

**Acceptance Criteria**:

1. WHEN README install/prerequisites are read THEN they SHALL document installing `@taranti/hotspot-scanner` from npm (global or `pnpm dlx`/`npx` only if verified accurate for the bin)
2. WHEN README is read THEN contributor clone + `pnpm build` SHALL remain documented
3. WHEN README claims registry install THEN it SHALL name package `@taranti/hotspot-scanner` and CLI bin `hotspot-scanner`

**Independent Test**: Read README install section; confirm package + bin + clone retained.

**Requirements:** HOTSPOT-1788, HOTSPOT-1789, HOTSPOT-1790

---

### P1: STATE Deferred closure ⭐ MVP

**User Story**: As a planner/maintainer, I want STATE to stop listing open-ended “npm publish deferred” once M83 is Done so that project memory matches reality.

**Why P1**: Living decision hygiene.

**Acceptance Criteria**:

1. WHEN M83 Execute completes THEN STATE Deferred SHALL remove or narrow the open “npm publish / npx / pnpm dlx install path” item to match shipped reality
2. WHEN M83 completes THEN STATE Decisions SHALL record that package publish is via Trusted Publishing OIDC on `release.yml` (no steady-state `NPM_TOKEN`)

**Independent Test**: Diff STATE Deferred/Decisions after Done (Execute Phase F).

**Requirements:** HOTSPOT-1791, HOTSPOT-1792

---

## Requirement Traceability

| Requirement ID | Story                                   | Tasks | Status  |
| -------------- | --------------------------------------- | ----- | ------- |
| HOTSPOT-1780   | P1: `id-token: write`                   | T1    | Planned |
| HOTSPOT-1781   | P1: Publish after GitHub Release        | T1    | Planned |
| HOTSPOT-1782   | P1: No steady-state `NPM_TOKEN`         | T1    | Planned |
| HOTSPOT-1783   | P1: npm CLI ≥ 11.5.1                    | T1    | Planned |
| HOTSPOT-1784   | P1: registry.npmjs.org                  | T1    | Planned |
| HOTSPOT-1785   | P1: Trusted Publisher fields in docs    | T2    | Planned |
| HOTSPOT-1786   | P1: First-publish chicken-egg docs      | T2    | Planned |
| HOTSPOT-1787   | P1: OIDC steady-state docs              | T2    | Planned |
| HOTSPOT-1788   | P1: README registry install             | T3    | Planned |
| HOTSPOT-1789   | P1: README clone retained               | T3    | Planned |
| HOTSPOT-1790   | P1: Package + bin naming                | T3    | Planned |
| HOTSPOT-1791   | P1: STATE Deferred cleanup              | T4    | Planned |
| HOTSPOT-1792   | P1: STATE Decision OIDC                 | T4    | Planned |
| HOTSPOT-1793–1794 | (unused in stories; available)       | —     | —       |
| HOTSPOT-1795–1799 | Reserved                             | —     | —       |

---

## Success Criteria

- Intentional bump → GitHub Release → npm publish on OIDC
- Docs cover Trusted Publisher + first publish
- README offers registry install
- STATE no longer treats npm publish as open Deferred
