# Milestone 55 — API Trust Docs Context

**Feature slug:** `api-trust-docs`  
**Milestone:** ROADMAP M55  
**Depth:** Small (docs + public exports + thin config warn + fixture wire)  
**Requirement IDs:** HOTSPOT-860–889  
**Status:** Locked (planning) — no open discuss items  
**Sisters:** [adoption-docs-package-exports](../adoption-docs-package-exports/spec.md) (M45), [config-file](../config-file/spec.md) (M21), [package-dx](../package-dx/spec.md) (M24); cross-link [output-interpretation-ux](../output-interpretation-ux/spec.md) (M41 `--only` JSON ≠ baseline)

---

## Intent

Adopters who use the package programmatically still cannot import `previewScanScope` / `runDoctor` from `@vitals/hotspot-scanner` — those live behind `#` imports / deep paths. Config silently drops unknown keys (M21), which hides typos and CLI-only keys pasted into `.hotspot-scanner.json`. The `merge-heavy` fixture exists but is not in the integration suite. Trust docs (zero-network, security reporting, baseline placement, `--only` baseline trap) are scattered or missing (`SECURITY.md` absent).

M55 closes that gap without pipeline/ranking/schema changes.

---

## Decision: Public API surface expansion (LOCKED)

**Question:** What leaves `src/index.ts`?

| Export | Include |
| ------ | ------- |
| `previewScanScope` | Yes |
| `ScanScopePreview` (type) | Yes |
| `runDoctor` | Yes |
| Doctor types: `DoctorFinding`, `DoctorFindingId`, `DoctorFindingStatus`, `DoctorResult`, `RunDoctorOptions` | Yes |
| `formatScanScopePreview` | No (CLI formatting helper — YAGNI for public API) |
| Doctor helpers (`parseNodeMajor`, `satisfiesEnginesNode`, …) | No |

**package.json `"exports"`:** Keep single `"."` → `dist/index.js` / `dist/index.d.ts` (M45). No subpath exports for doctor/preview.

**Applies to:** HOTSPOT-860–866.

---

## Decision: Unknown config keys — warn-only (LOCKED)

**Question:** How do unknown keys behave vs M21 “ignored”?

| Rule | Behavior |
| ---- | -------- |
| Unknown keys | Still **ignored for merge** (values never applied) |
| Failure | **Never** — invalid *known* key types still hard-fail (`ConfigError`); unknowns do not |
| Forward-compat | Future keys added to `KNOWN_KEYS` stop warning when recognized |
| CLI-only keys in file (`format`, `output`, `baseline`, …) | Treated as unknown → warn (helps catch M21 lock mistakes) |
| Emission | One `ScanWarning` per loaded config with code **`UNKNOWN_CONFIG_KEY`**, message lists sorted unknown key names |
| Channels | `onWarning` + `meta.warnings` on successful `runScan`; CLI stderr via existing handlers; dry-run / doctor that load the same file SHOULD surface the same message (stderr / doctor config finding note — implementer discretion, same code string) |
| Exit | Unchanged — successful scan still `0` |

**Supersedes M21 docs wording** “Unknown keys are ignored” → “Unknown keys are ignored for merge and emit `UNKNOWN_CONFIG_KEY` (warn-only).”

**Applies to:** HOTSPOT-867–872.

---

## Decision: `merge-heavy` integration wire (LOCKED)

**Question:** How far to go on the existing fixture?

| Item | Rule |
| ---- | ---- |
| Fixture tree | Reuse `tests/fixtures/repos/merge-heavy/` — do **not** redesign history |
| Bootstrap | `ensureFixtureRepo` in Vitest `globalSetup` (same pattern as `small-ts`) and/or test `beforeAll` |
| Assertions | Scan completes; `src/keep.ts` in hotspots; deleted `src/remove.ts` absent from rankings; merge/`feature.ts` present per fixture README |
| Scope | Integration in `src/scan.integration.test.ts` (new describe); update TESTING.md P2 note → wired |

**Applies to:** HOTSPOT-873–876.

---

## Decision: Trust docs package (LOCKED)

| Doc | Content |
| --- | ------- |
| README | Strengthen **zero network / local-only** callout near top (existing Privacy block may be upgraded, not duplicated ad nauseam); TOC link to `SECURITY.md`; Programmatic API lists new exports |
| `SECURITY.md` (new) | Trust model (local Git+disk, no scan-time network/telemetry); how to report vulnerabilities (private channel — GitHub Security Advisories / email placeholder if no public contact yet); out of scope (supply-chain of deps during `pnpm install`) |
| Baseline-in-artifacts | Recipes + README compare section: prefer CI **artifact** paths for baselines (e.g. `artifacts/hotspot-baseline.json` / Actions upload); `baseline save` still valid; do not treat `--only` JSON as baseline |
| `--only` ≠ baseline | Cross-link M41: README already warns — ensure recipes Baseline section + warning-codes/help stay consistent; no schema change |

**package.json `files`:** Include `SECURITY.md` when present (publish-prep parity with README; no publish).

**Applies to:** HOTSPOT-877–882.

---

## Out of scope (explicit)

| Item | Reason |
| ---- | ------ |
| npm publish / registry install | Deferred (STATE) |
| Fail/hard-error on unknown config keys | Breaks forward-compat; user locked warn-only |
| New config keys / CLI flags | YAGNI |
| JSON schema / contract version bump | Unchanged |
| Ranking / miner / McCabe changes | Out of milestone |
| Subpath `exports` for doctor/preview | Single entry map |
| Expanding public API beyond listed symbols | YAGNI |
| Redesigning `merge-heavy` history | Fixture already Done (M6 P2) |

---

## Sister constraints

- **M45:** `"exports"` already points at `dist/index` — only grow `src/index.ts` surface.
- **M21:** Precedence CLI > config > defaults unchanged; filename `.hotspot-scanner.json` only.
- **M24:** `files` allowlist / engines / scripts unchanged except adding `SECURITY.md` to `files` if needed.
- **M41:** Filtered JSON is triage-only — document, do not weaken schemas.

---

## Open items

_None — all gray areas locked above._
