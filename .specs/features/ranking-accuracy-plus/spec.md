# Milestone 50 — Ranking Accuracy Plus Specification

**Feature slug:** `ranking-accuracy-plus`  
**Milestone:** M50  
**Priority:** High  
**Depth:** Large  
**Context:** [context.md](./context.md)  
**Sisters:** [rename-confidence](../rename-confidence/) (M26), [coupling-enrichment](../coupling-enrichment/) (M27), [function-ast-coverage-plus](../function-ast-coverage-plus/) (M29), [function-mode-scan-efficiency](../function-mode-scan-efficiency/) (M35)

## Problem Statement

Hotspot rankings still under-count or mis-attribute signal in five known gaps: unlinked renames only warn (churn stays split), static enrich ignores rename canonicalization, parse-failed files vanish from rankings despite churn, function AST misses callbacks/IIFEs, and function mode drops zero-churn-file functions (M35 D6). Operators need more accurate, still-trustworthy rankings without historical AST or formula changes.

## Goals

- [ ] Same-commit unlinked renames with strengthened relatedness **link** into `PathAliasMap` and still emit stable `RENAME_HISTORY_INCOMPLETE` warnings
- [ ] Static coupling enrich resolves peers via `PathAliasMap` canonical paths
- [ ] `PARSE_FAILED` files appear in file `hotspots` with `parseFailed: true` and `hotspotScore: 0` without distorting successful-file norms
- [ ] Function AST collects call-argument callbacks and IIFEs; McCabe decision nodes unchanged
- [ ] Function mode includes functions from zero-churn eligible files; ranking impact documented

## Out of Scope

| Feature                                                               | Reason                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Historical AST / per-commit function ranges                           | Deferred (CONCERNS); M26 avisos remain for pós-rename overlap       |
| `node_modules` / publish-map resolve                                  | Explicit out of scope                                               |
| M46 exclude-tests / path-scope test changes                           | Separate milestone                                                  |
| Changing harmonic mean formula                                        | Locked                                                              |
| New ScanWarning `code` values                                         | Prefer M28 catalog (`RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`, …) |
| Global `git log --follow`                                             | CONCERNS / ARCHITECTURE forbid                                      |
| Changing M35 patch pathspec efficiency (churn allowlist for git `-p`) | Keep; only AST allowlist revisit                                    |

---

## User Stories

### P1: Stronger unlinked-rename linking ⭐ MVP

**User Story:** As an operator scanning a repo with moves that git did not emit as `old => new`, I want matching delete+add pairs linked under one canonical path so churn and coupling are not split, while still seeing rename-confidence warnings.

**Why P1:** Direct RT-003 accuracy gap; foundation for enrich PathAliasMap benefits.

**Acceptance Criteria:**

1. WHEN a commit contains an unlinked delete-only path and add-only path that pass the strengthened relatedness rules (context.md) THEN the miner SHALL call `PathAliasMap.link(from, to)` before canonicalize.
2. WHEN such pairs are detected THEN the system SHALL still emit `ScanWarning` with `code: "RENAME_HISTORY_INCOMPLETE"` (stable code; message may note heuristic link).
3. WHEN relatedness fails THEN the system SHALL NOT link those paths.
4. WHEN many pairs match THEN the system SHALL keep the M26 cap (max 5 detail + summary).
5. WHEN find-renames already supplied `renameFrom` / `=>` THEN the system SHALL NOT double-link or treat as unlinked.

**Independent Test:** Inject `rename-unlinked.txt` (extended) / unit tests — canonical churn under new path + warning present; unrelated delete+add → no link.

---

### P1: Rename-aware static enrich ⭐ MVP

**User Story:** As an operator, I want `hasStaticDependency*` to remain true across rename-linked peer paths so enrichment matches git-canonical coupling pairs.

**Why P1:** Closes CONCERNS “renamed-but-unlinked → false” for **linked** renames (git `-M` + M50 heuristic).

**Acceptance Criteria:**

1. WHEN `runScan` has a `PathAliasMap` from the file miner THEN `enrichCouplingStaticDeps` SHALL canonicalize peer paths when building the static edge graph and labeling pairs.
2. WHEN pair `fileA`/`fileB` are canonical forms of rename-linked paths and a static edge exists under working-tree current paths THEN `hasStaticDependency` SHALL be `true` (direction/kind flags per M27 invariants).
3. WHEN no alias map / empty links THEN enrich behavior SHALL match pre-M50 relative/alias/exports resolution (regression).
4. WHEN enrich runs THEN `couplingStrength`, `coChangeCount`, and pair order SHALL be unchanged.

**Independent Test:** Unit test with injected alias map + temp files under new paths; coupling pair uses canonical names; edge detected.

---

### P1: PARSE_FAILED files in hotspot ranking ⭐ MVP

**User Story:** As an operator, I want files that failed to parse but have churn to still appear in the hotspot table, clearly flagged, with score 0, so I do not lose track of them.

**Why P1:** Ranking coverage gap; operators currently only see stderr warnings.

**Acceptance Criteria:**

1. WHEN a source file fails parse THEN complexity SHALL emit a stub `ComplexityResult` (`cyclomaticComplexity: 0`, `functionCount: 0`) **and** a `PARSE_FAILED` warning (code unchanged).
2. WHEN scoring file hotspots THEN each stub SHALL produce a `HotspotScore` with `parseFailed: true`, `hotspotScore: 0`, `complexityNormalized: 0`, `churnNormalized: 0`.
3. WHEN successful files are scored THEN their normalized values and relative order SHALL be computed as if parse-failed rows were absent from the normalize universe.
4. WHEN reporting JSON/CSV/table/markdown THEN `parseFailed` SHALL be visible (JSON/CSV field; table/markdown flag column or marker).
5. WHEN loading a baseline missing `parseFailed` THEN `loadBaseline` SHALL reject with a re-scan hint (additive required field; version `"1.0"`).

**Independent Test:** Fixture with invalid syntax + churned path — appears in `hotspots` with `parseFailed: true` and score 0; valid peers’ order matches pre-stub scoring.

---

### P1: Function AST callbacks / IIFEs ⭐ MVP

**User Story:** As an operator in function mode, I want callbacks passed to APIs and IIFEs ranked when they carry complexity, without changing McCabe decision-node rules.

**Why P1:** Reopens M29 omit; improves function-mode coverage (RT-005 safe).

**Acceptance Criteria:**

1. WHEN a `CallExpression` has an `ArrowFunction` or `FunctionExpression` argument THEN that callable SHALL be collected.
2. WHEN an IIFE form `(function () { … })()` or `(() => { … })()` is present THEN it SHALL be collected as `<anonymous>:L{line}`.
3. WHEN collecting these nodes THEN `mccabe.ts` decision-node kinds SHALL be unchanged (RT-005).
4. WHEN file-level complexity is summed THEN new callables SHALL contribute to the file total.
5. WHEN fixtures document expected McCabe for sample callback/IIFE bodies THEN tests SHALL lock those values.

**Independent Test:** Complexity fixtures + `analyze-file` unit tests; `mccabe.ts` untouched (or comment-only).

---

### P1: Zero-churn-file functions in function mode ⭐ MVP

**User Story:** As an operator, I want functions in eligible files with no in-window file churn to still appear in function rankings (typically score 0) so the function list matches working-tree inventory.

**Why P1:** Intentional revisit of M35 D6; restores pre-M35 coverage while keeping patch pathspec efficiency.

**Acceptance Criteria:**

1. WHEN `granularity: "function"` THEN complexity SHALL run full in-scope discovery (no churn-only `pathAllowlist`).
2. WHEN an eligible file has zero scoped file-level churn THEN its functions SHALL appear in `ScanResult.functions` with zero churn stats and `hotspotScore: 0` (typical).
3. WHEN function-mode patch mining runs THEN pathspecs SHALL remain churn ∩ eligible extensions (M35 I/O preserved).
4. WHEN file mode runs THEN patch stream SHALL still not spawn (M35 non-regression).
5. WHEN docs/CONCERNS describe function-mode efficiency THEN they SHALL state that zero-churn functions are included and note normalization impact.

**Independent Test:** Isolated `small-ts` + `untouched.ts` — present in `functions`; file-mode zero patch spawn still holds; churned ranking smoke parity retained.

---

## Edge Cases

- WHEN heuristic rename relatedness matches multiple adds for one delete THEN system SHALL apply documented deterministic pairing (design: first related unused add in path-sort order) and still cap warnings.
- WHEN `PathAliasMap.link` would create ambiguity THEN existing ambiguous-path warning behavior SHALL apply.
- WHEN PARSE_FAILED path has no git churn THEN it MAY still appear with all zeros / `parseFailed: true` if discovered in-scope (discovery includes it).
- WHEN callback is already collected via variable/property initializer THEN system SHALL not double-collect the same node.
- WHEN zero-churn allowlist removal makes function AST slower on large repos THEN that is accepted (document; M49/M35 patch pathspecs still limit git `-p`).
- WHEN compare/baseline lacks `parseFailed` THEN load fails closed (no defaulting).

---

## Requirement Traceability

| Requirement ID | Story                                                    | Phase | Status  |
| -------------- | -------------------------------------------------------- | ----- | ------- |
| HOTSPOT-730    | P1: Unlinked rename — heuristic `link()`                 | Tasks | Pending |
| HOTSPOT-731    | P1: Unlinked rename — strengthened relatedness           | Tasks | Pending |
| HOTSPOT-732    | P1: Unlinked rename — stable `RENAME_HISTORY_INCOMPLETE` | Tasks | Pending |
| HOTSPOT-733    | P1: Unlinked rename — cap + no double-link with `-M`     | Tasks | Pending |
| HOTSPOT-734    | P1: Unlinked rename — fixtures/unit coverage             | Tasks | Pending |
| HOTSPOT-735    | P1: Unlinked rename — no `--follow` / no historical AST  | Tasks | Pending |
| HOTSPOT-736    | P1: Unlinked rename — deterministic multi-match pairing  | Tasks | Pending |
| HOTSPOT-737    | P1: Unlinked rename — docs CONCERNS/ARCHITECTURE         | Tasks | Pending |
| HOTSPOT-738    | P1: Enrich — accept PathAliasMap / canonicalize          | Tasks | Pending |
| HOTSPOT-739    | P1: Enrich — peer graph uses canonical paths             | Tasks | Pending |
| HOTSPOT-740    | P1: Enrich — scan wires alias map from miner             | Tasks | Pending |
| HOTSPOT-741    | P1: Enrich — ranking fields unchanged                    | Tasks | Pending |
| HOTSPOT-742    | P1: Enrich — regression without alias map                | Tasks | Pending |
| HOTSPOT-743    | P1: Enrich — unit tests rename-aware edge                | Tasks | Pending |
| HOTSPOT-744    | P1: Enrich — M27 invariants preserved                    | Tasks | Pending |
| HOTSPOT-745    | P1: Enrich — docs reopen M27 boundary                    | Tasks | Pending |
| HOTSPOT-746    | P1: PARSE_FAILED — stub ComplexityResult                 | Tasks | Pending |
| HOTSPOT-747    | P1: PARSE_FAILED — `parseFailed` on HotspotScore         | Tasks | Pending |
| HOTSPOT-748    | P1: PARSE_FAILED — score 0 + excluded from norm universe | Tasks | Pending |
| HOTSPOT-749    | P1: PARSE_FAILED — warning code unchanged                | Tasks | Pending |
| HOTSPOT-750    | P1: PARSE_FAILED — schema + baseline reject              | Tasks | Pending |
| HOTSPOT-751    | P1: PARSE_FAILED — reporters (table/md/csv/json)         | Tasks | Pending |
| HOTSPOT-752    | P1: PARSE_FAILED — successful-file order parity          | Tasks | Pending |
| HOTSPOT-753    | P1: PARSE_FAILED — no function rows for failed files     | Tasks | Pending |
| HOTSPOT-754    | P1: AST — collect call-argument callables                | Tasks | Pending |
| HOTSPOT-755    | P1: AST — collect IIFEs                                  | Tasks | Pending |
| HOTSPOT-756    | P1: AST — naming `<anonymous>:L{line}` default           | Tasks | Pending |
| HOTSPOT-757    | P1: AST — no McCabe decision-node drift                  | Tasks | Pending |
| HOTSPOT-758    | P1: AST — file sum includes new nodes                    | Tasks | Pending |
| HOTSPOT-759    | P1: AST — fixtures + unit tests                          | Tasks | Pending |
| HOTSPOT-760    | P1: AST — no double-collect                              | Tasks | Pending |
| HOTSPOT-761    | P1: Zero-churn — omit function-mode pathAllowlist        | Tasks | Pending |
| HOTSPOT-762    | P1: Zero-churn — functions appear with zero churn        | Tasks | Pending |
| HOTSPOT-763    | P1: Zero-churn — keep patch pathspec allowlist           | Tasks | Pending |
| HOTSPOT-764    | P1: Zero-churn — file-mode zero patch spawn              | Tasks | Pending |
| HOTSPOT-765    | P1: Zero-churn — invert M35 omission tests + docs        | Tasks | Pending |
| HOTSPOT-766    | Integration: rename + enrich smoke on fixture            | Tasks | Pending |
| HOTSPOT-767    | Integration: PARSE_FAILED ranking smoke                  | Tasks | Pending |
| HOTSPOT-768    | Integration: function AST + zero-churn smoke             | Tasks | Pending |
| HOTSPOT-769    | Docs sync ARCHITECTURE / CONCERNS / TESTING + full gate  | Tasks | Pending |

**Coverage:** 40 requirements (HOTSPOT-730–769), all mapped to tasks in [tasks.md](./tasks.md).

---

## Success Criteria

- [ ] All five ROADMAP M50 bullets verified by unit and/or integration tests
- [ ] Warning codes remain stable (`RENAME_HISTORY_INCOMPLETE`, `PARSE_FAILED`)
- [ ] Harmonic formula unchanged; successful-file ranking parity locked where specified
- [ ] `pnpm build && pnpm test` green at feature Done
- [ ] ARCHITECTURE / CONCERNS updated for reopened M27/M29/M35 boundaries
