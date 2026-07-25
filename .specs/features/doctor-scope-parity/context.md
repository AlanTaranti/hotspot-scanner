# Milestone 52 — Doctor Scope Parity Context

**Feature slug:** `doctor-scope-parity`  
**Milestone:** ROADMAP M52  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-800–819  
**Status:** Locked (planning) — no open discuss items

---

## Intent

`scan` and `scan --dry-run` already share `resolveScanPipelineContext` (M43 remount + M30 config walk + merge). `doctor` still validates git on the **request path** only (`validateGitRepository(target)`), so a nested monorepo package that `scan` accepts fails doctor. Adopters who follow `init → doctor → dry-run → scan` get a false hard fail before they ever see remount/auto-include.

M52 makes doctor use the same prelude chain so remount, config merge, PathScope, and eligible-count semantics match dry-run / `runScan`.

---

## Decision: Shared prelude (LOCKED)

**Question:** What is the single prelude chain?

| Step | Owner | Used by |
| ---- | ----- | ------- |
| `resolveScanPipelineContext(options)` | `src/scan.ts` (existing) | `runScan`, `previewScanScope`, **`runDoctor`** |
| Shared PathScope build from `merged` + optional `includeTests` | thin helper (design) | `runScan`, `previewScanScope` (doctor via preview) |
| Eligible count via `discoverSourceFiles(pipelineRepoPath, scope)` | existing | `previewScanScope`; doctor **scope** finding |

**Rules:**

1. Doctor MUST NOT re-implement remount / auto-include / config-from-request.
2. Doctor MUST NOT call miner / AST / scorers / report ranking (same as dry-run).
3. Prefer doctor calling `previewScanScope` (or an extracted shared “scope inventory” used by preview) for eligible-count — do not fork a second discovery path.

**Applies to:** HOTSPOT-800, HOTSPOT-804–806, HOTSPOT-814.

---

## Decision: Git-repo finding after remount (LOCKED)

**Question:** How does the `git-repo` finding change vs M39?

| Case | Behavior |
| ---- | -------- |
| Request path is git root | Pass; message names that path (unchanged intent) |
| Nested package under parent git (M43 remount) | Pass; message names **pipeline git root**; may mention remount / auto-include |
| Not in any git work tree | Fail hard exit `1` (unchanged class) |
| Target missing / not a directory | Fail hard exit `1` (unchanged) |

**Supersedes M39 wording** that implied “`<path>/.git` must exist on the doctor target.” Post-M52, “is a git repository” means “`resolveScanPipelineContext` / remount succeeds,” same as scan.

Node engines + `git` on PATH checks remain unchanged and run **before** prelude.

**Applies to:** HOTSPOT-800–802, HOTSPOT-810.

---

## Decision: Config finding vs prelude (LOCKED)

Config soft-warn / fail semantics from M39 stay:

| Case | Finding | Exit |
| ---- | ------- | ---- |
| Valid discovered or `--config` | `config` pass | — |
| No config on walk | `config` warn | Soft (`0` if no hard fails) |
| Invalid / missing explicit `--config` | `config` fail | `2` |

Discovery root remains the **original request path** (M30/M43). Prelude merge uses the same root. Implementer may keep `checkConfig` on request path **or** derive pass/warn/fail from the same load the prelude uses — messages must stay operator-clear; do not drop the “no config” soft warn.

**Applies to:** HOTSPOT-803, HOTSPOT-809.

---

## Decision: New `scope` finding (LOCKED)

Add `DoctorFindingId` value **`scope`**:

| Status | When |
| ------ | ---- |
| `pass` | Prelude + PathScope + discovery succeeded (eligible count may be `0`) |
| skipped | Not emitted when path/git/config prelude already failed hard enough that inventory is meaningless (no git root / invalid path); do not invent a second fail for the same root cause |
| never `fail` for zero files | Count `0` is informational pass (align dry-run) |

**Message content (stable enough for tests):** pipeline `repoPath`, effective include/exclude summary (or pointer to same fields dry-run prints), `eligible files: N`, and remount note when `remountWarning` present. Exact phrasing is implementer discretion; must allow asserting count parity with `previewScanScope` on the same options.

**Exit:** `scope` never drives exit alone; aggregate policy unchanged (M39).

**Applies to:** HOTSPOT-805–806, HOTSPOT-808.

---

## Decision: M46 / `includeTests` forward-compat (LOCKED)

| Fact | Rule |
| ---- | ---- |
| M46 owns PathScope test-exclude defaults and `--include-tests` | M52 MUST NOT change default exclude sets |
| Suggested Execute order: M46 before M52 | When M46 is Done, doctor/dry-run/`runScan` MUST share `includeTests` → `createPathScope` |
| If Execute order slips | Optional `includeTests?: boolean` on `RunDoctorOptions` / shared helper; omit or `false` → current PathScope API (pre-M46 ignores unknown; post-M46 excludes tests) |
| Doctor CLI | When M46 is Done, add `--include-tests` on `doctor` forwarding into `RunDoctorOptions` / `previewScanScope`. If M46 not yet Done at Execute time, ship API field + helper wiring only; CLI flag can land in same task once M46 flag exists on scan |

**Doctor without flags** uses config + defaults + remount auto-include only (no new `--include`/`--exclude` on doctor — YAGNI).

**Applies to:** HOTSPOT-807, HOTSPOT-813.

---

## Decision: M51 sister (LOCKED)

`doctor --format json` is **M51**, out of scope for M52.

If M51 lands first: text formatter and any future JSON serializer must treat findings as a list of `{ id, status, message }` — adding `scope` is additive. M52 does not implement JSON output.

**Applies to:** HOTSPOT-812 (doc/note only).

---

## Out of scope (confirmed)

- `doctor --format json` (M51)
- Changing PathScope / test-exclude defaults (M46)
- Workspace yaml / nx / turborepo parsers
- Auto-fix from doctor
- New doctor flags for `--include` / `--exclude` / `--since` (use config or `scan --dry-run` for those)
- Export surface changes beyond what M55 may later publish (`previewScanScope` / `runDoctor` already exist)

---

## Fixtures / validation

| Asset | Use |
| ----- | --- |
| `tests/fixtures/repos/monorepo-nested` | Doctor from nested package path → exit `0`; scope eligible count matches dry-run |
| `tests/fixtures/repos/small-ts` | Regression healthy doctor + git-root path |
| Unit `src/doctor/` | Remount mock / temp nested tree; scope finding present; exit policy |
| `src/scan-preview.test.ts` / scan tests | Shared PathScope helper + `includeTests` pass-through |

---

## Sisters

| Milestone | Slug | Relationship |
| --------- | ---- | ------------ |
| M39 | `cli-init-doctor-dry-run` | Doctor exit policy + findings model; dry-run inventory |
| M43 | `monorepo-path-detect` | Remount + auto-include + config-from-request |
| M46 | `exclude-tests-by-default` | Test excludes + `includeTests` (forward-compat) |
| M51 | `scan-observability` | `doctor --format json` — additive findings only |
