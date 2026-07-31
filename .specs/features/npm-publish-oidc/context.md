# Milestone 83 — npm Publish via OIDC Context

**Feature slug:** `npm-publish-oidc`  
**Milestone:** ROADMAP M83  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-1780–1799 (1795–1799 reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Depends on:** M82 [`github-release-action`](../github-release-action/context.md) **Done** (`.github/workflows/release.yml` exists)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (unchanged — no pipeline logic)

---

## Intent

After M82 can cut GitHub Releases, publish `@taranti/hotspot-scanner` to the public npm registry from the **same** `release.yml` using Trusted Publishing (OIDC)—no long-lived `NPM_TOKEN`. Update README install path so registry install becomes official alongside clone.

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field     | Value                                                              |
| --------- | ------------------------------------------------------------------ |
| Milestone | **M83**                                                            |
| Slug      | `npm-publish-oidc`                                                 |
| Depth     | **Medium**                                                         |
| IDs       | **HOTSPOT-1780–1799** (after M82 HOTSPOT-1760–1779)                |
| Priority  | **High** (closes STATE Deferred publish path)                      |

**Status:** **Confirmed** — do not re-open

---

## Decision: Extend `release.yml` (LOCKED)

| Field     | Value                                                                 |
| --------- | --------------------------------------------------------------------- |
| File      | **Same** `.github/workflows/release.yml` (do not rename; Trusted Publisher binds filename) |
| Order     | After successful GitHub Release → `pnpm publish` (or `npm publish` with pnpm) |
| Trigger   | Unchanged: `workflow_dispatch` + `bump`                               |
| Secrets   | **No** `NPM_TOKEN` / `NODE_AUTH_TOKEN` for steady-state publish       |

**Status:** **Confirmed** — do not re-open

---

## Decision: OIDC Trusted Publishing (LOCKED)

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Workflow permission| `id-token: write` **in addition to** `contents: write`                |
| Registry           | `https://registry.npmjs.org`                                          |
| Package            | `@taranti/hotspot-scanner` (`publishConfig.access: public` already)   |
| npm Trusted Publisher config (manual) | GitHub user/org `AlanTaranti`, repo `hotspot-scanner`, workflow filename `release.yml` |
| npm CLI            | ≥ 11.5.1 on the job (upgrade step if runner npm is older)             |
| Provenance         | Rely on Trusted Publishing defaults (add `--provenance` only if required for green publish) |

**Status:** **Confirmed** — do not re-open

---

## Decision: First-publish prerequisite (LOCKED)

| Field        | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Chicken-egg  | npm Trusted Publisher requires the package to **exist** on npmjs     |
| Who          | Maintainer — one-time: create package (manual publish or placeholder) then configure Trusted Publisher |
| Action scope | Documents the prerequisite; does not invent a permanent token workflow for steady state |
| Blocker      | Execute of publish step is blocked until Trusted Publisher is configured |

**Status:** **Confirmed** — do not re-open

---

## Decision: Docs and STATE (LOCKED)

| Surface       | Change                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| CONTRIBUTING  | Extend Releasing: OIDC publish after Release; Trusted Publisher setup pointer |
| README        | Official install includes registry (`pnpm add -g` / `npm i -g` or documented equivalent); clone remains valid for contributors |
| STATE Deferred| On Done: remove/narrow “npm publish / npx / pnpm dlx” Deferred; record Decision that publish is OIDC-only via `release.yml` |
| `npx` / `dlx` | Document if accurate for the published bin; do not invent unsupported flags |

**Status:** **Confirmed** — do not re-open

---

## Explicit non-goals

- Private registry / GitHub Packages as primary
- Keeping `NPM_TOKEN` as the steady-state auth path
- Renaming `release.yml` after Trusted Publisher is set
- Bumping JSON contract versions as part of publish
- semantic-release
