# Milestone 23 — Per-Function Git Churn Context

**Feature slug:** `per-function-churn`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M23; user-confirmed locked decisions during planning (do **not** reopen)

---

## Decision: Churn attribution — hunk overlap

**Question:** How should a commit count toward a function’s churn?

**Choice:** **Hunk overlap on `git log` patch output.** For each commit that touches a file, if **any** hunk intersects the function’s **current** working-tree range `[startLine, endLine]`, that commit counts toward that function’s churn.

**Out of scope:** Historical AST per commit (no per-revision function boundary reconstruction).

**Status:** **Confirmed** (user locked)

**Applies to:** Function churn miner, HOTSPOT-182, HOTSPOT-184.

---

## Decision: Replace M11 inherited file churn

**Question:** Should function mode keep inheriting parent `FileChangeStats`?

**Choice:** **No** — function mode **stops inheriting** parent file churn. Per-function `commitCount`, `linesChanged`, and `authorCount` come from hunk-overlap aggregation only.

**File mode:** Unchanged — existing `--numstat` GitMiner only; no patch stream.

**Status:** **Confirmed** (user locked; supersedes M11 STATE decision for function-mode churn source)

**Applies to:** `scoreFunctionHotspots`, `runScan` function branch, HOTSPOT-185, HOTSPOT-186.

---

## Decision: When to run the patch miner

**Question:** When is the hunk-overlap stream spawned?

**Choice:** **Only** when `--granularity function`. File mode pays **no** patch I/O cost.

**Status:** **Confirmed**

**Applies to:** `src/scan.ts` wiring, HOTSPOT-183.

---

## Decision: Signals and scoring math

**Question:** Which fields and formulas change?

**Choice:**

| Aspect | Behavior |
| ------ | -------- |
| Output fields | Same on `FunctionHotspotScore`: `commitCount`, `linesChanged`, `authorCount` |
| Source | Overlap aggregation (not whole-file `FileChangeStats`) |
| Normalization | `log1p` + min-max unchanged |
| Combiner | Harmonic `2ch/(c+h)` unchanged |
| Universe | All functions in the scan |

**Status:** **Confirmed**

**Applies to:** HOTSPOT-185, HOTSPOT-189.

---

## Decision: Function line range (`endLine`)

**Question:** How is the function range defined for overlap?

**Choice:** Complexity emits `endLine` via ts-morph `getEndLineNumber()`; existing `line` remains the start (`getStartLineNumber()`). `endLine` may stay **pipeline-internal** if the public JSON contract does not need it (no shape break under `version: "1.0"`).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-181.

---

## Decision: Nested function overlap

**Question:** If a hunk intersects N nested (or overlapping) functions, who gets credit?

**Choice:** The commit counts toward **all N** functions.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-184.

---

## Decision: `--since` and authors

**Question:** Do time window and author rules differ from file-level mining?

**Choice:** **Same** `--since` window and distinct-author rules as the file-level GitMiner (`authors` Set → `authorCount`).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-187.

---

## Decision: Cost / streaming

**Question:** How to avoid regressing large-repo performance (RT-001)?

**Choice:**

- Stream with `--unified=0` (or minimal equivalent)
- Line-by-line hunk processing — do **not** buffer entire repo patch
- Prefer an **additional** stream **only in function mode** — do **not** regress file-mode numstat parse

**Status:** **Confirmed**

**Applies to:** HOTSPOT-183, HOTSPOT-190.

---

## Decision: Renames

**Question:** How to handle path renames in the patch miner?

**Choice:** Reuse `PathAliasMap` / existing rename warnings. Document imprecision after moves (current working-tree range vs historical hunk line numbers).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-188.

---

## Decision: JSON contract

**Question:** Does the JSON schema version or shape change?

**Choice:** `version: "1.0"`; **no shape break** — only the **semantics** of churn numbers in function mode change (values may differ from pre-M23 inherited-file behavior).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-189.

---

## Decision: Requirement IDs and fixtures

| Item | Value |
| ---- | ----- |
| Requirement IDs | `HOTSPOT-181+` (continues after M22 `HOTSPOT-180`) |
| Fixtures | Synthetic logs/patches under `tests/fixtures/` (paths as task targets — implement in Execute) |

**Status:** **Confirmed**

---

## Related closed decisions (prior milestones)

| Decision | Value | Relevance to M23 |
| -------- | ----- | ---------------- |
| M11 inherited file churn | Superseded in function mode | This milestone replaces it |
| File-mode GitMiner | `--numstat` single pass (ADR-2026-020) | Unchanged; coupling still from numstat |
| Hotspot combiner | Harmonic `2ch/(c+h)` | Unchanged |
| Normalization | `log1p` + min-max | Unchanged; universe = all functions |
| Working-tree AST only | No historical AST | Aligns with hunk-overlap vs re-parse history |
| Spawn only in `src/git/` | INTEGRATIONS.md | Patch spawn stays in `src/git/` |
