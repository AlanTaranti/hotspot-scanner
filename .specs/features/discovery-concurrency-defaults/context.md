# Milestone 36 — Discovery & concurrency defaults Context

**Feature slug:** `discovery-concurrency-defaults`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M36 + planner lock (parent session)  
**Depth:** Medium

---

## Decision: Default worker concurrency cap (LOCKED)

**Question:** What should `DEFAULT_WORKER_CONCURRENCY` be after M36?

**Choice:** **`min(os.availableParallelism(), 8)`**

| Aspect | Detail |
| ------ | ------ |
| Today (M15/M28) | `min(availableParallelism(), 4)` |
| M36 | Cap raised **4 → 8**; still bounded by available parallelism |
| Override | Unchanged — CLI `--concurrency` and config `concurrency` (CLI > config > default) |
| Formula location | Single source: `DEFAULT_WORKER_CONCURRENCY` in `src/complexity/pool.ts` (imported by config merge) |

**Rationale:**

- Multi-core laptops/CI often have ≥8 logical CPUs; cap 4 leaves cores idle on complexity-heavy repos
- Cap **8** (not uncapped) still bounds peak memory: N workers × ≤50-file batches × ts-morph `Project` (CONCERNS RT-001)
- Operators on memory-constrained hosts keep `--concurrency 1`–`4` (document explicitly)

**CONCERNS check:** RT-001 memory risk remains; mitigation is documentation + override, not keeping the old cap forever. No CONCERNS argument against 8 when override stays available.

**Status:** **Confirmed — planner locked (parent preference)**

**Applies to:** HOTSPOT-406, HOTSPOT-407, HOTSPOT-408

---

## Decision: Discovery primary path = `git ls-files` (LOCKED)

**Question:** How should `discoverSourceFiles` enumerate candidates?

**Choice:** **Prefer `git ls-files` + PathScope/extension filter; filesystem walk as fallback.**

| Step | Behavior |
| ---- | -------- |
| 1 | Spawn `git -C <repoPath> ls-files -z` via a helper **inside `src/git/`** (INTEGRATIONS: no git spawn outside `src/git/`) |
| 2 | Decode null-delimited paths; keep eligible extensions (`.ts`/`.tsx`/`.js`/`.jsx`); apply `isPathInScope` (defaults + include/exclude) |
| 3 | Sort posix-relative paths (same contract as today) |
| 4 | On spawn failure or non-zero exit → **silent** fallback to existing recursive walk + prune |

**Primary-path semantics:** tracked files only (classic `git ls-files`). Untracked working-tree sources are **not** listed on the success path. Fallback walk still sees untracked files (preserves existing unit tests on non-git temp trees and direct API callers without git).

**Do not:**

- Use `git ls-files --others` / `--exclude-standard` in M36 (YAGNI; reopen only if product asks)
- Merge ls-files + walk on success (empty tracked set is valid → return `[]`)
- Emit a new `ScanWarning` for fallback (YAGNI)
- Change PathScope defaults or include/exclude semantics

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-400–HOTSPOT-405, HOTSPOT-412, HOTSPOT-413

---

## Decision: Docs scope (LOCKED)

**Update (living):** `README.md` concurrency section + flag table; `.specs/codebase/ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md` (default formula + discovery preference); `scripts/benchmark-scan.md` (M36 notes).

**Do not rewrite** historical M15/M28 feature `spec.md` / `context.md` decision text as if they always said `8` — those record past locks. Living SoT and operator docs are authoritative after M36.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-409–HOTSPOT-411

---

## Out of discuss

No remaining gray areas for Execute. Parent session locked concurrency formula and discovery preference.
