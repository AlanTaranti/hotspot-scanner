# Milestone 80 — GitHub Repo Identity Context

**Feature slug:** `github-repo-identity`  
**Milestone:** ROADMAP M80  
**Depth:** Medium (docs/metadata string replace; no pipeline)  
**Requirement IDs:** HOTSPOT-1720–1729 (1726–1729 reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md) (no pipeline change)

---

## Intent

Align published GitHub identity on live product surfaces with the real remote `AlanTaranti/hotspot-scanner`. Today clone/badge/Issues/advisories/`repository.url` still cite `taranti/hotspot-scanner` (404). npm package scope rename remains M79 and is intentionally separate.

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field | Value |
| ----- | ----- |
| Milestone | **M80** |
| Slug | `github-repo-identity` |
| Depth | **Medium** |
| IDs | **HOTSPOT-1720–1729** (next free band after M79 HOTSPOT-1700–1719) |
| Priority | **High** (broken public GitHub links) |

**Status:** **Confirmed** — do not re-open

---

## Decision: URL mapping (LOCKED)

| Field | Value |
| ----- | ----- |
| From | `github.com/taranti/hotspot-scanner` (and `git+https://github.com/taranti/hotspot-scanner.git`) |
| To | `github.com/AlanTaranti/hotspot-scanner` (and `git+https://github.com/AlanTaranti/hotspot-scanner.git`) |
| Badge label | `taranti%2Fhotspot-scanner` → `AlanTaranti%2Fhotspot-scanner` |

**Status:** **Confirmed** — do not re-open

---

## Decision: Live surfaces in scope (LOCKED)

| Surface | What changes |
| ------- | ------------ |
| [README.md](../../../README.md) | Badge label + href; clone URL |
| [CONTRIBUTING.md](../../../CONTRIBUTING.md) | Clone URL; Issues URL |
| [SECURITY.md](../../../SECURITY.md) | Security Advisories URLs (link + bare URL) |
| [package.json](../../../package.json) | `repository.url`; add `homepage` + `bugs` |

**package.json extras (LOCKED):**

```json
"homepage": "https://github.com/AlanTaranti/hotspot-scanner",
"bugs": { "url": "https://github.com/AlanTaranti/hotspot-scanner/issues" }
```

**Status:** **Confirmed** — do not re-open

---

## Decision: GitHub owner vs npm scope (LOCKED)

| Field | Value |
| ----- | ----- |
| GitHub owner | **`AlanTaranti`** |
| npm scope | **`@taranti`** (M79 `package-scope-rename`) |
| Relationship | **Intentionally differ** — do not “fix” one to match the other |
| M79 interaction | Keep M79 as-is for npm `@taranti`. **M79 does not change GitHub URLs.** |

**Status:** **Confirmed** — do not re-open

---

## Decision: Out of scope (LOCKED)

| Exclude | Reason |
| ------- | ------ |
| Historical Done feature specs (e.g. M24 / readme-adoption-dx archive prose) | Leave archive citations; live surfaces only |
| CI / `.github/workflows` | Already Deferred in STATE (CI recipes) |
| npm package rename / publish | M79 + STATE Deferred |
| CLI bin, config filename, `vitals-*` skill folders | Unrelated identity axes |
| Tracked file for local git remote | Contributor note in Verify / Done when only — ensure `origin` → AlanTaranti; do not invent a remotes file |
| STACK.md | Update only if it contains the wrong URL string (today it does not — generic “repository points at the git remote URL”) |

**Status:** **Confirmed** — do not re-open

---

## Agent notes (Execute)

1. Exact-string / badge-label replace; do not rewrite surrounding prose.
2. Do **not** touch `.specs/features/**` Done specs that still cite `taranti/hotspot-scanner`.
3. Do **not** invent `.github/` workflows.
4. Acceptance: `rg 'github.com/taranti/hotspot-scanner' README.md CONTRIBUTING.md SECURITY.md package.json` → empty; AlanTaranti hits in all intended places; badge fixes 404.
5. Contributor note (not a tracked file): confirm local `git remote get-url origin` points at `AlanTaranti/hotspot-scanner`.
6. Final gate: `pnpm build && pnpm test` (docs/metadata-only; must still pass).
