# Milestone 26 — Rename Confidence Context

**Feature slug:** `rename-confidence`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M26 (RT-003); user-locked scope during planning (do **not** reopen)

---

## Decision: Mitigation style — avisos only (no historical AST)

**Question:** How far should M26 go to fix rename / pós-rename ranking trust?

**Choice:** **Avisos + stronger fixtures only.** Do **not** invent historical AST, per-revision function boundaries, or blame-based re-attribution.

**Status:** **Confirmed** (user locked)

**Applies to:** All HOTSPOT-203+ requirements; function-mode overlap warning.

---

## Decision: “Confidence” means warning copy — not a schema field

**Question:** Does ROADMAP “warning/confidence” add a numeric or enum confidence field on scores / JSON?

**Choice:** **No.** Confidence is communicated via **actionable warning strings** (stderr via existing `onWarning` / miner `warnings[]`) and living docs. Keep `ScanResult` / JSON `version: "1.0"` shape unchanged — no new score fields, no `meta.warnings` on scan (stderr remains the scan warning channel; compare already has `meta.warnings`).

**Status:** **Confirmed** (planner lock; YAGNI + avoid M20 contract churn)

**Applies to:** HOTSPOT-209, HOTSPOT-210.

---

## Decision: File-miner blind spots to warn on

**Question:** Which incomplete-history cases get actionable warnings?

**Choice:** Emit warnings for these signals (in addition to existing PathAliasMap ambiguous paths):

| Signal                                 | When                                                                                                                                                                                                                                    | Intent                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Ambiguous alias chains                 | `PathAliasMap.getAmbiguousPaths()` nonempty                                                                                                                                                                                             | Keep existing RT-003 message pattern            |
| Suspected copy-paste / unlinked rename | Same commit: path fully deleted + path fully added (or add-only / delete-only pair) with **no** `old => new` / `renameFrom`, and a cheap relatedness heuristic (same basename **or** basename+parent similarity — exact rule in design) | History may split across paths                  |
| `--since` truncates rename history     | `since` is set **and** at least one in-window rename link was recorded                                                                                                                                                                  | Pre-window history under old paths is invisible |

Prefer **deduplicated / summary** messages over per-path spam when many paths match (cap or single summary — design § Error Handling).

**Status:** **Confirmed** (maps CONCERNS rename blind spots → M26)

**Applies to:** HOTSPOT-203, HOTSPOT-204, HOTSPOT-205.

---

## Decision: Enable git rename detection (`-M`) on miner spawns

**Question:** Should spawn argv gain `-M` / `--find-renames` so real repos emit `old => new`?

**Choice:** **Yes** for both file numstat miner and function patch miner. Without find-renames, real `git log --numstat` typically shows delete+add for moves; PathAliasMap only works on hand-crafted fixtures today. `-M` is **not** `--follow` and **not** historical AST — allowed under CONCERNS (“do not add `--follow` globally”).

**Out of scope:** Tuning similarity percentage beyond git default unless fixtures prove default insufficient (YAGNI; document if Execute needs `-M<n>`).

**Status:** **Confirmed** (planner lock; required for RT-003 on real repos)

**Applies to:** HOTSPOT-206; enables HOTSPOT-208 E2E.

---

## Decision: Function-mode pós-rename warning trigger

**Question:** When to emit the function-mode overlap / confidence warning?

**Choice:** In **function granularity only**, emit **once** (deduped) when the function-churn mine observes **any** rename link (`renameFrom` / PathAliasMap `link`) **or** any ambiguous path. Message must state that overlap uses **current** `[line, endLine]` vs **historical** hunk lines and that confidence may be reduced after moves.

Do **not** emit on every function row. File mode must not pay for this message beyond shared blind-spot file warnings.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-209.

---

## Decision: Boundary with M27 / M28

| Topic                                                                  | Owner                                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| RT-003 / rename blind spots / function-rename avisos                   | **M26** (this feature)                                                        |
| tsconfig `paths` / package `exports` enrichment                        | **M27** — out of scope                                                        |
| Generic `--concurrency` / progress UX / warning-severity consolidation | **M28** — out of scope (do not add severity levels or progress redesign here) |
| Renamed-but-unlinked → `hasStaticDependency: false`                    | Explicitly **not** a dedicated M26 deliverable (CONCERNS)                     |

**Status:** **Confirmed** (ROADMAP boundary)

---

## Decision: Requirement IDs and fixtures

| Item                | Value                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Requirement IDs     | `HOTSPOT-203` … (range reserved through `HOTSPOT-220`; gaps OK)                                       |
| File-miner fixtures | Extend `tests/fixtures/git-log/` (copy-paste / unlinked, since-truncation cases)                      |
| Repo fixture        | Strengthen `tests/fixtures/repos/with-renames/` so E2E proves unified churn **and** expected warnings |
| Patch fixtures      | Extend `tests/fixtures/git-patch/` only if needed for function-rename warning unit coverage           |

**Status:** **Confirmed**

---

## Related closed decisions (prior milestones)

| Decision                                        | Value                                     | Relevance to M26                       |
| ----------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| Rename via `PathAliasMap`, not `--follow`       | M2 / ARCHITECTURE                         | Extend warnings; keep no-`--follow`    |
| Ambiguous path warning text                     | `Rename history may be incomplete for: …` | Keep pattern; add new message families |
| Function churn = hunk overlap vs current ranges | M23                                       | Document + warn; no AST                |
| Working-tree AST only                           | Project constraint                        | Locked again for M26                   |
| Scan warnings → `onWarning` / stderr            | M5+                                       | No ScanMeta.warnings in M26            |
