# Milestone 53 — Compare Interpretation Specification

**Feature slug:** `compare-interpretation`  
**Milestone:** ROADMAP M53  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)  
**Context:** [`.specs/features/compare-interpretation/context.md`](./context.md) — delta triage, compare explain, `--strict` locked  
**Sisters:** [output-interpretation-ux](../output-interpretation-ux/spec.md) (M41), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [scan-compare](../scan-compare/spec.md) (M13)  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-820–839  
**Priority:** Medium

## Problem Statement

Compare reports already show new / removed / rank-changed tables (M13) plus executive summary and glossary (M41), but operators still lack conservative **delta-aware** triage cues, cannot `--explain` a path in terms of **rank delta / new-removed**, and cannot fail CI when baseline and current `--since` windows disagree. M41 intentionally skipped compare triage; M53 reopens that with delta-safe rules and closes the explain/strict gaps.

## Goals

- [ ] Compare table/markdown emit delta-aware triage hints (default ON; `--no-triage-hints`)
- [ ] `--explain` in compare mode prints classification + ranks/delta (or new/removed) on stderr
- [ ] `--strict` exits ≠ 0 when `COMPARE_SINCE_MISMATCH` is present after compare
- [ ] Living docs updated; `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                              | Reason                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| Absolute M41 dual-signal rules on `rankChanged` rows | Misleading on deltas — context locked delta-aware rules |
| Fail-on hotspotScore / rank thresholds               | Deferred CI recipes; M12 removed                        |
| Coupling-pair `--explain`                            | YAGNI                                                   |
| JSON schema / `version` change                       | stderr + human report only                              |
| Promoting all warning codes under `--strict`         | Only `COMPARE_SINCE_MISMATCH`                           |
| Changing default since-mismatch to hard fail         | Opt-in via `--strict` only                              |

---

## User Stories

### P1: Compare delta triage hints ⭐ MVP

**User Story**: As an operator reading a compare table or markdown report, I want short delta-aware triage hints so I know which new or worsened entities to review first.

**Why P1**: ROADMAP primary; intentional M41 override.

**Acceptance Criteria**:

1. WHEN compare `table` or `markdown` renders and triage is enabled (default) THEN matching rows SHALL be listed under a triage section using exactly the three rules in context (new-dual-signal, rank-worsened, new-coupled-with-static)
2. WHEN `--no-triage-hints` is set on `scan --baseline` or `compare` THEN the triage section SHALL be omitted
3. WHEN no rows match THEN the triage section SHALL be omitted (no empty placeholder)
4. WHEN format is `json` or `csv` THEN triage hints SHALL NOT appear
5. WHEN triage evaluates matches THEN it SHALL use the **sliced** display set; summary totals remain full-corpus
6. WHEN triage runs THEN rankings, scores, and JSON/CSV numeric payloads SHALL be unchanged
7. WHEN scan (no baseline) triage runs THEN M41 absolute rules SHALL remain unchanged

**Independent Test**: Unit — `compare-triage.test.ts` (or `triage-compare.test.ts`) with crafted `CompareResult` fixtures for each rule, cap, disable, and json/csv absence; regression that scan triage still passes.

**Requirements**: HOTSPOT-820, HOTSPOT-821, HOTSPOT-822, HOTSPOT-823, HOTSPOT-824, HOTSPOT-825, HOTSPOT-826, HOTSPOT-827

---

### P1: Compare `--explain` ⭐ MVP

**User Story**: As an operator comparing against a baseline, I want `--explain <path>` (or `path:function`) so I can see whether the target is new, removed, or rank-changed and by how much — on stderr without corrupting the report.

**Why P1**: ROADMAP primary; closes M42 gap for compare.

**Acceptance Criteria**:

1. WHEN `scan --baseline` or `compare` runs with `--explain <target>` THEN the system SHALL write the compare report as usual, then print a compare explain block to **stderr**
2. WHEN the target matches a `new` hotspot/function THEN the explain block SHALL include classification `new` and entity score fields (M42 field set; no recomputation)
3. WHEN the target matches a `removed` entry THEN the explain block SHALL include classification `removed` and entity score fields from the removed entity
4. WHEN the target matches a `rankChanged` entry THEN the explain block SHALL include classification `rank-changed`, `baselineRank`, `currentRank`, `rankDelta`, and entity score fields
5. WHEN the target is absent from all compare delta sections THEN stderr SHALL show a clear not-found message and exit SHALL remain `0` if compare succeeded (unless `--strict` fails independently)
6. WHEN `--format json` or `csv` (or `--output`) THEN machine-readable output SHALL remain report-only — explain SHALL NOT corrupt it
7. WHEN `--explain` is used **without** compare mode THEN M42 scan explain SHALL remain unchanged
8. WHEN `compare` help is shown THEN `--explain` SHALL appear with a short description

**Independent Test**: Unit — compare explain formatter; CLI — `scan --baseline --explain` / `compare --explain` with stderr capture and JSON stdout intact.

**Requirements**: HOTSPOT-828, HOTSPOT-829, HOTSPOT-830, HOTSPOT-831, HOTSPOT-832, HOTSPOT-833

---

### P1: `--strict` on `COMPARE_SINCE_MISMATCH` ⭐ MVP

**User Story**: As a CI owner, I want `--strict` so a baseline/current `--since` mismatch fails the process with exit ≠ 0 after I still get the compare report.

**Why P1**: ROADMAP primary; opt-in hardening of M13 warning.

**Acceptance Criteria**:

1. WHEN compare succeeds without `--strict` and `COMPARE_SINCE_MISMATCH` is present THEN exit SHALL be `0` and the warning SHALL still appear (M13 unchanged)
2. WHEN `--strict` is set and compare `meta.warnings` contains `COMPARE_SINCE_MISMATCH` THEN after report write the process SHALL exit `1`
3. WHEN `--strict` is set and there is no since mismatch THEN exit SHALL be `0` on successful compare
4. WHEN `--strict` is set THEN other warning codes SHALL NOT alone cause a hard fail
5. WHEN `scan --help` / `compare --help` is shown THEN `--strict` SHALL be documented as failing on `COMPARE_SINCE_MISMATCH`

**Independent Test**: Unit/CLI — craft baseline vs current with different `meta.since`; assert exit `0` vs `1` with/without `--strict`; report still produced.

**Requirements**: HOTSPOT-834, HOTSPOT-835, HOTSPOT-836

---

### P1: Docs + wiring ⭐ MVP

**User Story**: As a maintainer, I want ARCHITECTURE / README / warning-codes docs to describe compare triage, compare explain, and `--strict` so operators do not rely on M41 “no compare triage” wording.

**Why P1**: Living-docs policy; supersedes M41 prose.

**Acceptance Criteria**:

1. WHEN ARCHITECTURE § Reporter / compare is read THEN it SHALL mention delta triage, compare `--explain`, and `--strict`
2. WHEN README Advanced / recipes mention compare THEN they SHALL note `--strict` and delta triage / explain briefly
3. WHEN `docs/warning-codes.md` documents `COMPARE_SINCE_MISMATCH` THEN it SHALL mention `--strict` as the hard-fail opt-in
4. WHEN M41 feature docs say “no compare triage” THEN M53 living docs (not historical M41 Status) SHALL state the override

**Independent Test**: Doc review checklist in tasks; no gate on prose alone beyond full project gate.

**Requirements**: HOTSPOT-837, HOTSPOT-838, HOTSPOT-839

---

## Edge Cases

- WHEN `--only hotspots` excludes coupling THEN `new-coupled-with-static` produces no matches from omitted sections
- WHEN `--top` slices away a matching new dual-signal row THEN that row SHALL NOT appear in triage (sliced evaluation)
- WHEN explain path has leading `./` or absolute path under repo THEN normalize like M42
- WHEN function granularity + `--explain path` (no `:fn`) THEN explain all matching function deltas for that file (new/removed/rankChanged), rank order within each class
- WHEN `--explain path:fn` in file granularity THEN `CliUsageError` (M42 unchanged)
- WHEN `--strict` and `--explain` not-found together THEN strict since-mismatch still exits `1` after report; not-found does not override
- WHEN baseline and current `since` match THEN `--strict` is a no-op for this code

---

## Requirement Traceability

| Requirement ID | Story                                                            | Phase | Status  |
| -------------- | ---------------------------------------------------------------- | ----- | ------- |
| HOTSPOT-820    | P1: Compare triage — three delta rules                           | Tasks | Pending |
| HOTSPOT-821    | P1: Compare triage — default ON                                  | Tasks | Pending |
| HOTSPOT-822    | P1: Compare triage — `--no-triage-hints`                         | Tasks | Pending |
| HOTSPOT-823    | P1: Compare triage — omit when empty                             | Tasks | Pending |
| HOTSPOT-824    | P1: Compare triage — table/md only (not json/csv)                | Tasks | Pending |
| HOTSPOT-825    | P1: Compare triage — sliced evaluation                           | Tasks | Pending |
| HOTSPOT-826    | P1: Compare triage — no score/JSON mutation                      | Tasks | Pending |
| HOTSPOT-827    | P1: Compare triage — wire into compare-table/markdown + reporter | Tasks | Pending |
| HOTSPOT-828    | P1: Explain — compare-mode lookup on CompareResult               | Tasks | Pending |
| HOTSPOT-829    | P1: Explain — new / removed / rank-changed fields                | Tasks | Pending |
| HOTSPOT-830    | P1: Explain — stderr after report                                | Tasks | Pending |
| HOTSPOT-831    | P1: Explain — not-found message; exit 0                          | Tasks | Pending |
| HOTSPOT-832    | P1: Explain — `compare` command gains `--explain`                | Tasks | Pending |
| HOTSPOT-833    | P1: Explain — scan-without-baseline unchanged                    | Tasks | Pending |
| HOTSPOT-834    | P1: Strict — default warn-and-continue preserved                 | Tasks | Pending |
| HOTSPOT-835    | P1: Strict — exit 1 on COMPARE_SINCE_MISMATCH                    | Tasks | Pending |
| HOTSPOT-836    | P1: Strict — CLI flag on scan + compare                          | Tasks | Pending |
| HOTSPOT-837    | P1: Docs — ARCHITECTURE                                          | Tasks | Pending |
| HOTSPOT-838    | P1: Docs — README / recipes                                      | Tasks | Pending |
| HOTSPOT-839    | P1: Docs — warning-codes `--strict` note                         | Tasks | Pending |

**Coverage:** 20 total (HOTSPOT-820–839), mapped in tasks.md.

---

## Success Criteria

- [ ] Default compare table/markdown shows triage when delta rules match; `--no-triage-hints` suppresses
- [ ] `--explain` with baseline prints classification + ranks/delta on stderr; JSON stdout intact
- [ ] `--strict` + since mismatch → exit `1` after report; without `--strict` → exit `0`
- [ ] Docs no longer claim “no compare triage” as current behavior
