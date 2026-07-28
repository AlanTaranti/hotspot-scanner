# Milestone 80 — GitHub Repo Identity Specification

**Feature slug:** `github-repo-identity`  
**Milestone:** ROADMAP M80  
**Depth:** Medium (docs/metadata only)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [context.md](./context.md) (all decisions **Confirmed**)  
**IDs:** HOTSPOT-1720–1729 (1726–1729 reserved)

## Problem Statement

Live product surfaces still advertise `github.com/taranti/hotspot-scanner`, which does not exist (404). Clones, the README badge, Issues, Security Advisories, and `package.json` `repository.url` mislead adopters. The real remote is `AlanTaranti/hotspot-scanner`. npm scope stays on the M79 track (`@taranti`) and intentionally differs from the GitHub owner.

## Goals

- [ ] Live surfaces (README, CONTRIBUTING, SECURITY, `package.json`) cite only `AlanTaranti/hotspot-scanner`
- [ ] `package.json` has correct `repository.url`, plus `homepage` and `bugs.url`
- [ ] README badge label and href no longer 404
- [ ] Historical Done feature specs and CI workflows untouched
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Rewrite Done historical specs citing old URL | Archive prose; live surfaces only |
| CI / `.github/workflows` | STATE Deferred (CI recipes) |
| npm scope rename / publish | M79 + Deferred |
| Change CLI bin / config / `vitals-*` folders | Unrelated |
| Tracked remotes file | Contributor note only |

---

## User Stories

### P1: package.json GitHub metadata ⭐ MVP

**User Story**: As a package consumer or tooling reading `package.json`, I want `repository`, `homepage`, and `bugs` to point at `AlanTaranti/hotspot-scanner` so npm/Git metadata matches the real remote.

**Why P1**: Canonical machine-readable GitHub identity.

**Acceptance Criteria**:

1. WHEN `package.json` `repository.url` is read THEN it SHALL be `git+https://github.com/AlanTaranti/hotspot-scanner.git`
2. WHEN `package.json` is read THEN `homepage` SHALL be `https://github.com/AlanTaranti/hotspot-scanner`
3. WHEN `package.json` is read THEN `bugs.url` SHALL be `https://github.com/AlanTaranti/hotspot-scanner/issues`
4. WHEN the four live surfaces are grepped for `github.com/taranti/hotspot-scanner` THEN `package.json` SHALL not match

**Independent Test**: Read `package.json` fields; `rg` on the four files for old host path.

**Requirements:** HOTSPOT-1720, HOTSPOT-1721

---

### P1: Adoption docs GitHub URLs ⭐ MVP

**User Story**: As an evaluator cloning or filing issues, I want README (badge + clone), CONTRIBUTING (clone + Issues), and SECURITY (advisories) to use `AlanTaranti/hotspot-scanner` so links work.

**Why P1**: First-screen and day-2 GitHub links must not 404.

**Acceptance Criteria**:

1. WHEN the README GitHub badge is rendered THEN label and href SHALL use `AlanTaranti/hotspot-scanner` (encoded label `AlanTaranti%2Fhotspot-scanner`)
2. WHEN README / CONTRIBUTING clone snippets are read THEN they SHALL use `https://github.com/AlanTaranti/hotspot-scanner.git`
3. WHEN CONTRIBUTING Issues link is followed THEN it SHALL target `https://github.com/AlanTaranti/hotspot-scanner/issues`
4. WHEN SECURITY Advisories link and bare URL are read THEN they SHALL target `https://github.com/AlanTaranti/hotspot-scanner/security/advisories/new`

**Independent Test**: Spot-check the four docs; `rg` old vs new on live surfaces.

**Requirements:** HOTSPOT-1722, HOTSPOT-1723, HOTSPOT-1724

---

### P1: Verify live surfaces + project gate ⭐ MVP

**User Story**: As a maintainer, I want an empty old-URL check on live surfaces, confirmed AlanTaranti hits, and a green project gate so the identity fix is complete and safe.

**Why P1**: Definition of Done for metadata/docs work.

**Acceptance Criteria**:

1. WHEN `rg 'github.com/taranti/hotspot-scanner' README.md CONTRIBUTING.md SECURITY.md package.json` runs THEN it SHALL return zero matches
2. WHEN `rg 'github.com/AlanTaranti/hotspot-scanner' README.md CONTRIBUTING.md SECURITY.md package.json` runs THEN it SHALL hit all intended places (badge href, clones, Issues, advisories, repository/homepage/bugs)
3. WHEN `pnpm build && pnpm test` runs THEN it SHALL exit 0
4. WHEN the contributor checks local git THEN `origin` SHOULD point at `AlanTaranti/hotspot-scanner` (note only — not a tracked file)

**Independent Test**: Acceptance `rg` commands + project gate.

**Requirements:** HOTSPOT-1725

---

## Edge Cases

- WHEN Done feature specs under `.specs/features/**` still cite `taranti/hotspot-scanner` THEN Execute SHALL leave them unchanged
- WHEN STACK.md has no wrong URL string THEN Execute SHALL not invent a repository URL line there
- WHEN M79 runs before/after M80 THEN npm `@taranti` and GitHub `AlanTaranti` SHALL both remain valid and intentionally distinct
- WHEN no `.github/workflows` directory exists THEN Execute SHALL not create one

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-1720 | P1: `repository.url` | Tasks | Pending |
| HOTSPOT-1721 | P1: `homepage` + `bugs` | Tasks | Pending |
| HOTSPOT-1722 | P1: README badge + clone | Tasks | Pending |
| HOTSPOT-1723 | P1: CONTRIBUTING clone + Issues | Tasks | Pending |
| HOTSPOT-1724 | P1: SECURITY advisories | Tasks | Pending |
| HOTSPOT-1725 | P1: Live-surface verify + gate | Tasks | Pending |
| HOTSPOT-1726–1729 | — | — | Reserved |

**Coverage:** 6 requirements mapped to tasks (T1–T4); 1726–1729 reserved unused.

---

## Success Criteria

- [ ] No `github.com/taranti/hotspot-scanner` on the four live surfaces
- [ ] AlanTaranti URLs present in badge, clones, Issues, advisories, and package metadata
- [ ] `homepage` and `bugs` present on `package.json`
- [ ] Historical specs / CI / npm rename untouched
- [ ] `pnpm build && pnpm test` green
