# Milestone 35 — Function-Mode Scan Efficiency Context

**Feature slug:** `function-mode-scan-efficiency`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M35; user-locked decisions during planning (do **not** reopen)

---

## Decision: No historical AST

**Question:** Should efficiency work include reconstructing function ranges from historical commits?

**Choice:** **No.** Overlap remains current working-tree `[line, endLine]` vs historical hunk lines (M23/M26). M35 only reduces I/O and CPU for the existing model.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-395, all function-churn / complexity tasks.

---

## Decision: File mode must not spawn patch stream

**Question:** May file mode share any patch-stream path for “simplicity”?

**Choice:** **No.** Default/`--granularity file` pays **zero** patch spawn cost. Regression test required.

**Status:** **Confirmed** (user locked; reinforces M23 HOTSPOT-183)

**Applies to:** HOTSPOT-392, HOTSPOT-393, HOTSPOT-397.

---

## Decision: Ranking parity vs intentional edges

**Question:** Must every function-mode output row match pre-M35 exactly?

**Choice:** **Typical rankings must match** (functions in files with in-window file-level churn; fixture `small-ts` / churned paths). **Documented intentional edge:** in function mode, files with **zero** scoped file-level churn in the scan window are **omitted from AST** and therefore do not appear in `ScanResult.functions` (previously they appeared with `hotspotScore === 0`). Normalization universe therefore excludes those rows — acceptable for triage; document in ARCHITECTURE/CONCERNS.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-387, HOTSPOT-388, HOTSPOT-398.

---

## Decision: Patch pathspec source

**Question:** Which paths restrict `git log -p`?

**Choice:** **Same allowlist as function-mode AST:** relative paths from scoped `fileStats` that are eligible source extensions (churn ∩ scope ∩ TS/JS), after complexity → unique `filePath`s from emitted functions (subset). Pass as git pathspecs after `--`. Empty allowlist → **do not spawn** (all-zero / empty result). If allowlist size exceeds a documented soft threshold, **fall back** to unrestricted patch stream (correctness over ARG_MAX risk).

**Status:** **Confirmed** (planner lock; aligns with ROADMAP “churn or functions”)

**Applies to:** HOTSPOT-380–HOTSPOT-383, HOTSPOT-398.

---

## Decision: Interval index semantics

**Question:** May overlap attribution change when switching to sort/sweep?

**Choice:** **No semantic change.** Nested/overlapping ranges still credit **all** intersecting functions; `linesChanged` still sums full intersecting hunk deltas. Interval index is a performance rewrite with equivalence tests vs the naive nested loop.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-389–HOTSPOT-391.

---

## Non-goals (do not reopen)

| Topic                                   | Reason                         |
| --------------------------------------- | ------------------------------ |
| Historical AST / blame                  | User locked; CONCERNS deferred |
| Parallelize function-churn with numstat | M34 boundary, not M35          |
| Change scoring formulas / JSON version  | Out of scope                   |
| Persistent AST workers                  | M31                            |
| Discovery via `git ls-files`            | M36                            |

---

## Requirement ID band

Use **only** `HOTSPOT-380` … `HOTSPOT-399`.
