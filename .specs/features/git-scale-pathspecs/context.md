# Milestone 47 — Git Scale Pathspecs Context

**Feature slug:** `git-scale-pathspecs`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M47; user-locked scope in planner mission (do **not** reopen)  
**Depth:** Large  
**IDs:** HOTSPOT-660–689 (687–689 reserved)  
**Sisters:** [function-mode-scan-efficiency](../function-mode-scan-efficiency/spec.md) (M35), [coupling-stream-aggregate](../coupling-stream-aggregate/spec.md) (M32), [cli-init-doctor-dry-run](../cli-init-doctor-dry-run/spec.md) (M39 dry-run)

---

## Decision: Pathspec batching scope — patch stream only (LOCKED)

**Question:** Should M47 batch pathspecs on numstat, patch, or both?

**Choice:** **Function-mode patch stream only** (`git log -p` via `buildGitPatchLogArgv` / `FunctionChurnMiner`).

| Stream                        | M47 change                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Numstat (`git log --numstat`) | **Unchanged** — no pathspecs; ADR-2026-020 full stream for churn + coupling  |
| Patch (`git log -p`)          | **Batch** when allowlist length `> PATCH_PATHSPEC_FALLBACK_THRESHOLD` (1000) |

**Rationale:** Coupling needs the full scoped numstat universe; M35 pathspecs already apply only to the patch allowlist (churn ∩ eligible). Batching replaces the M35 unrestricted fallback for large allowlists.

**Status:** **Confirmed — planner locked (mission “as applicable”)**

**Applies to:** HOTSPOT-660–669

---

## Decision: Replace count-based unrestricted fallback with batching (LOCKED)

**Question:** When `paths.length > 1000`, keep omitting pathspecs (M35) or batch?

**Choice:** **Batch.** Never omit pathspecs **solely because** `paths.length > PATCH_PATHSPEC_FALLBACK_THRESHOLD`.

| Condition                 | Behavior                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `paths` empty             | No spawn (M35 unchanged)                                                                   |
| `1 ≤ paths.length ≤ 1000` | Single spawn with `--` + pathspecs (M35 unchanged)                                         |
| `paths.length > 1000`     | Partition into chunks of size ≤ 1000; sequential pathspec-restricted spawns; merge results |

**Threshold constant:** Keep exporting `PATCH_PATHSPEC_FALLBACK_THRESHOLD = 1000` as the **batch chunk size** (rename meaning in docs to “max pathspecs per argv”; keep symbol name for YAGNI/API stability unless Execute finds a clearer alias with re-exports).

**Status:** **Confirmed — user locked**

**Applies to:** HOTSPOT-660–666

---

## Decision: Partition + merge / dedup semantics (LOCKED)

**Question:** How are batches cut and how are multi-batch results merged without double-counting?

**Choice:**

1. **Sort** allowlist paths with stable lexicographic order (same determinism as today’s argv tests).
2. **Partition** into contiguous chunks of length `≤ PATCH_PATHSPEC_FALLBACK_THRESHOLD` (last chunk may be smaller).
3. **Run batches sequentially** — one `git log -p` stream at a time (no parallel patch spawns in M47 — peak RSS / CONCERNS).
4. **Merge:** For each batch, run existing hunk→function aggregation into a shared per-function stats map (or merge maps by function key). Because path partitions are **disjoint**, each file (and its functions) appears in exactly one batch → **no per-function commit double-count**.
5. **Cross-batch commits:** A commit touching files in batch A and batch B appears in both streams with only that batch’s path hunks — equivalent to one unrestricted stream filtered to the full allowlist (attribution correct; do **not** dedupe by commit hash across batches).
6. **Progress:** `phase: "function-churn"` continues; `commitsProcessed` may count commits observed across batches (document that cross-batch commits can increment the counter more than once — acceptable for progress UX, not for scoring). Prefer counting **lines/commits yielded by streams** without inventing a global unique-commit set (YAGNI).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-660–664, HOTSPOT-669

---

## Decision: Emergency unrestricted path (LOCKED — narrow)

**Question:** Is unrestricted argv ever allowed after M47?

**Choice:** **Yes, only as documented emergency** — not for “paths.length > 1000”.

| Trigger                                                   | Action                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Count > threshold                                         | Batch (never unrestricted for this alone)                                                                                                                                                                                                                                                                |
| Spawn fails with ARG_MAX / `E2BIG`-class error on a chunk | Retry once with **half chunk size** (min 1); if still failing, fall back to **unrestricted** single stream for the **remaining paths of that failure path** and emit a `ScanWarning` (new code or reuse documented message — design picks code; prefer one stable code e.g. `PATHSPEC_ARG_MAX_FALLBACK`) |

**Do not** add a user-facing CLI flag to force unrestricted in M47 (YAGNI).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-667

---

## Decision: Mega-commit threshold configurable; skip policy unchanged (LOCKED)

**Question:** Change mega-commit behavior or only the threshold?

**Choice:** **Threshold only.** Over-threshold policy stays M32:

- Unique **in-scope** canonical paths in a commit **> threshold** → skip coupling pair increments; emit `MEGA_COMMIT_SKIPPED` warnings (capped as today).
- **Churn** (`FileChangeStats`) still aggregated.
- **No** sampling / partial pair counting in M47.

| Surface    | Name                                       | Notes                                                                    |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| Default    | `100`                                      | `MEGA_COMMIT_UNIQUE_FILE_THRESHOLD` remains the default constant         |
| Config     | `megaCommitThreshold`                      | Positive integer; same validation class as `minCochange` / `concurrency` |
| CLI        | `--mega-commit-threshold <n>`              | Positive integer; `CliUsageError` on invalid                             |
| API        | `ScanOptions.megaCommitThreshold?: number` | Merged CLI > config > default                                            |
| Precedence | CLI > config > default                     | M21                                                                      |

Warning detail/summary strings SHALL interpolate the **effective** threshold (not a hard-coded `100`).

**Status:** **Confirmed — user locked**

**Applies to:** HOTSPOT-670–679

---

## Decision: Dry-run pathspec scale warning (LOCKED)

**Question:** What count triggers the dry-run warning, given dry-run does not mine churn?

**Choice:** Warn when **`eligibleFileCount > PATCH_PATHSPEC_FALLBACK_THRESHOLD`** (1000).

| Rationale   | Detail                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy       | Function-mode allowlist ⊆ eligible churned paths ⊆ eligible discovery set; eligible count is an upper-bound scale signal without running numstat      |
| Surface     | `previewScanScope` / `formatScanScopePreview` — add a clear warning line (design locks exact phrasing); dry-run still exit `0` / no mine              |
| Granularity | Warn based on eligible count **regardless of granularity** (file-mode operators still see scale); wording may mention function-mode pathspec batching |

**Not in M47:** Computing true churn allowlist size in dry-run (would require numstat).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-680–683

---

## Decision: Out of scope / YAGNI (LOCKED)

| Item                                      | Reason                             |
| ----------------------------------------- | ---------------------------------- |
| `--sequential` / benchmark harness        | M49                                |
| Historical AST                            | CONCERNS deferred                  |
| Ranking formula / JSON `version` changes  | Out of scope                       |
| M46 exclude-tests                         | Separate milestone — do not replan |
| Numstat pathspecs                         | Locked out above                   |
| Parallel patch batch spawns               | Peak RSS; sequential only          |
| User flag to force unrestricted pathspecs | YAGNI                              |
| Changing default mega threshold from 100  | Default stays 100                  |

**Status:** **Confirmed**

---

## Ambiguity log

_None — product decisions locked in mission + planner locks above._

---

## Requirement ID band

Use **only** `HOTSPOT-660` … `HOTSPOT-689`.  
**Reserved unused:** HOTSPOT-687, HOTSPOT-688, HOTSPOT-689 (gaps OK).
