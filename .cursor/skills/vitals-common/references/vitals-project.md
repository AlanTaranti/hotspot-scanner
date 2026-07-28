# @vitals/hotspot-scanner — Project Context

**Canonical project overlay** for agents and skills (not a layout SoT). Index: [AGENTS.md](../../../../AGENTS.md). Ownership: [DOC-OWNERSHIP.md](../../../../.specs/codebase/DOC-OWNERSHIP.md).

---

## Identity

- **Package:** `@vitals/hotspot-scanner` (npm)
- **CLI bin:** `hotspot-scanner` (unscoped)
- **Purpose:** Local CLI that ranks TS/JS maintenance hotspots from NCLOC and Git churn (file-level)
- **Pipeline:** `git → NCLOC → hotspot scoring → report`; also `trend` / `assess` commands
- **Design SoT:** [ARCHITECTURE.md](../../../../.specs/codebase/ARCHITECTURE.md)
- **Module map SoT:** [STRUCTURE.md](../../../../.specs/codebase/STRUCTURE.md)
- **Fragile / formulas:** [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)

## Module map (overlay)

Full Path|Role table: [STRUCTURE.md](../../../../.specs/codebase/STRUCTURE.md). Critical prefixes for task routing:

| Path | Role |
| ---- | ---- |
| `bin/` | Commander + `*-actions.ts` (no domain logic) |
| `src/git/` | GitMiner + file-history |
| `src/complexity/` | NCLOC + indentation |
| `src/trend/` / `src/assess/` | Trend + assess workflows |
| `src/scoring/` | HotspotScorer |
| `src/paths/` / `src/doctor/` / `src/diagnostics/` | Scoping, preflight, stderr |
| `src/config/` / `src/scan-result/` / `src/report/` | Config, parse, report |
| `src/scan.ts` | File-only pipeline |
| `schemas/` | JSON contracts (`version: "3.0"` scan; assess `1.0`) |

Task path ownership: [implementer-routing.md](implementer-routing.md).

## Gate check

**Full gate:** [quality-gates.mdc](../../../../.cursor/rules/quality-gates.mdc) + [TESTING.md](../../../../.specs/codebase/TESTING.md) § Coverage.

```bash
pnpm build && pnpm test
```

## Domain concepts

- **FileChangeStats** — per-file churn from streaming `git log`
- **ComplexityResult** — file-level `ncloc` (working tree)
- **hotspotScore** — formula SoT: [CONCERNS.md](../../../../.specs/codebase/CONCERNS.md)
- **parseScanResult** — library JSON validation (`ScanResultParseError`)
- **Config** — `.hotspot-scanner.json`; CLI-only: `format`, `output`, assess `--min-hotspot-score`

## Requirement IDs / Commit / YAGNI

Pointers: [feature-planning.mdc](../../../../.cursor/rules/feature-planning.mdc) (`HOTSPOT-*`), [commit-policy.mdc](../../../../.cursor/rules/commit-policy.mdc), [coding-guidelines](../../coding-guidelines/SKILL.md). Index: [AGENTS.md](../../../../AGENTS.md).

## Validation (CLI)

No interactive UI UAT. Fixtures: `tests/fixtures/repos/<slug>`.

1. Exit codes SoT: [docs/cli-reference.md](../../../../docs/cli-reference.md#exit-codes)
2. Workflow: skill `vitals-cli-validation`
3. Flag encyclopedia: `docs/cli-reference.md` (not this file)

## Knowledge sources

1. `.specs/codebase/` + DOC-OWNERSHIP + STATE + ROADMAP
2. `vitals-pipeline-domain` — pipeline context (pointers)
3. `vitals-cli-validation` — CLI/fixture checks
