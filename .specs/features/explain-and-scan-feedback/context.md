# Milestone 42 — Explain & Scan Feedback Context

**Feature slug:** `explain-and-scan-feedback`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M42 — items 18, 25, 27 (`--explain`, rename next-steps, complexity progress)  
**Depth:** Large  
**IDs:** HOTSPOT-540–569

---

## Decision: Full scan then explain (not explain-only)

**Question:** Does `--explain` skip the full report / run a partial pipeline?

**Choice:** **Always run the full scan** (same pipeline as today). Then render the normal report, then print an **explain block** for the matched target. Do **not** add an explain-only fast path.

**Rationale:** Explain needs scored/normalized values from the full ranking universe; YAGNI for a second pipeline.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-540–HOTSPOT-548.

---

## Decision: Explain stream = stderr

**Question:** stdout or stderr for the explain block?

**Choice:** Print the explain block to **stderr** after the report write (stdout / `--output` file unchanged).

**Rationale:** Preserves machine-readable stdout for `--format json|csv` and file outputs; matches warning/progress diagnostics channel.

**Status:** **Confirmed** (planner lock from user “stdout/stderr” option)

**Applies to:** HOTSPOT-547.

---

## Decision: `--explain` grammar

**Question:** How is the argument parsed for file vs function targets?

**Choice:** Single CLI option `--explain <target>` with this grammar:

| Form                    | Meaning                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `<path>`                | File path relative to repo root (or absolute under repo), posix-style as in `ScanResult`                           |
| `<path>:<functionName>` | Function target — `functionName` is the suffix after the **last** `:` that matches the function-name pattern below |

**Function-name pattern:** one or more segments separated by `.`, each segment `/^[A-Za-z_$][\w$]*$/` (covers `foo`, `Foo.bar`, getters named like identifiers). If the suffix after the last `:` does **not** match, treat the **entire** string as a path (so exotic paths with colons are not mis-split).

**Granularity rules:**

| `--granularity`  | Accepted target         | Lookup                                                                      |
| ---------------- | ----------------------- | --------------------------------------------------------------------------- |
| `file` (default) | `<path>` only           | `ScanResult.hotspots` by `filePath`                                         |
| `file`           | `<path>:<functionName>` | **CliUsageError** — suggest `--granularity function`                        |
| `function`       | `<path>`                | All `ScanResult.functions` rows with that `filePath` (rank order preserved) |
| `function`       | `<path>:<functionName>` | Single row matching `filePath` + `functionName`                             |

**Path normalization:** Strip repo-root prefix; compare with `filePath` as stored in rankings (repo-relative). Leading `./` ignored. No glob support in M42.

**Not found:** Clear stderr message (still exit `0` if scan succeeded): e.g. `explain: no hotspot ranking for <path>` / `explain: no function ranking for <path>:<name>`. Do **not** fail the scan.

**`--top` interaction:** Lookup uses the **full** `ScanResult` arrays (pre-report truncation). A file ranked below `--top` can still be explained.

**Status:** **Confirmed** (user locked grammar in context)

**Applies to:** HOTSPOT-540–HOTSPOT-546, HOTSPOT-549.

---

## Decision: Explain block contents

**Question:** What fields appear in the breakdown?

**Choice:** Human-readable block listing, for each matched row:

**File mode (`HotspotScore`):**

- `filePath`
- raw complexity: `cyclomaticComplexity` (and `functionCount`)
- normalized complexity `c`: `complexityNormalized`
- churn: `commitCount` (and `linesChanged`, `authorCount`)
- normalized churn `h`: `churnNormalized`
- harmonic score: `hotspotScore` (= `2ch/(c+h)`, already computed)
- optional one-line formula reminder: `hotspotScore = 2·c·h / (c+h)` with `c`/`h` as above

**Function mode (`FunctionHotspotScore`):**

- `filePath`, `functionName`, `line`
- raw complexity: `complexity`
- normalized `c` / `h` / `hotspotScore`
- churn: `commitCount`, `linesChanged`, `authorCount`

Do **not** recompute scores in explain — read fields from the ranked entry. No JSON schema change; explain is CLI stderr only (not a new report format).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-541–HOTSPOT-543.

---

## Decision: Rename warnings — append next-steps; stable codes

**Question:** How to make `RENAME_HISTORY_INCOMPLETE` (and related copy) more actionable?

**Choice:** Append a short **next-step** sentence to each existing `format*` message in `src/git/rename-warnings.ts`. **Do not** change `code` values (`RENAME_HISTORY_INCOMPLETE`, `EMPTY_SINCE_WINDOW`). Do not add new warning codes or families.

| Message family              | Next-step intent (exact copy in design/Execute)                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Ambiguous path              | Suggest verifying rename detection / widening `--since`                                        |
| Unlinked suspected rename   | Suggest ensuring git records renames (`-M` already on) or widening `--since`                   |
| `--since` truncation        | Explicitly suggest widening `--since` to include pre-window rename history                     |
| Function pós-rename overlap | Suggest treating function ranks cautiously after moves; file mode / wider window as mitigation |

`EMPTY_SINCE_WINDOW` may gain a next-step (“widen `--since` or check path scope”) in the same pass if already emitted from rename-warnings helpers — still **same code**.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-550–HOTSPOT-555.

---

## Decision: Complexity-phase progress

**Question:** How to report complexity progress without breaking M28 git phases?

**Choice:**

1. Extend `ScanProgressPhase` with `"complexity"`.
2. Extend `ScanProgress` **additively**:
   - Keep `commitsProcessed` for `"git"` / `"function-churn"` (unchanged semantics).
   - For `"complexity"`: set `commitsProcessed: 0`; set `filesProcessed`, `batchesProcessed`, and optional `totalFiles` / `totalBatches`.
3. Emit from complexity stage (analyzer and/or pool) after each batch completes (inline and worker paths).
4. Stderr via existing `maybeLogProgress` / extended logger — phase name **`complexity`**. Suggested line: `Processing complexity batch <N>/<totalBatches> (<filesProcessed>/<totalFiles> files)...` (throttle: emit at least every batch when `totalBatches` is small; if needed reuse interval on `filesProcessed` with interval = `DEFAULT_BATCH_SIZE` (50) so ~one line per batch).
5. Wire `onProgress` through `runScan` → `ComplexityAnalyzer` (today complexity has no progress callback — M28 documented gap).

**Sister M38 `--no-progress`:** M42 does **not** add `--no-progress`. Progress defaults **on**. When M38 lands, bin will omit/`no-op` `onProgress` under `--no-progress` / quiet — complexity progress then silences automatically through the same hook. Implementable independently.

**Out of P1:** percentage bars, ETA, TTY spinners.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-556–HOTSPOT-563.

---

## Decision: Requirement ID range

**Question:** Which HOTSPOT IDs does M42 use?

**Choice:** **HOTSPOT-540 through HOTSPOT-569** (30 IDs; unused IDs remain reserved / may be unused if YAGNI).

**Status:** **Confirmed**

---

## Decision: Living docs + ROADMAP sync ownership

**Question:** Who syncs ROADMAP/STATE?

**Choice:** Parent/planner syncs **ROADMAP.md** / **STATE.md** after planning. Feature folder owns living-doc updates for ARCHITECTURE / CONCERNS / TESTING / README as Execute tasks.

**Status:** **Confirmed**

---

## Out of scope (locked)

| Item                                            | Reason                          |
| ----------------------------------------------- | ------------------------------- |
| Historical AST / blame re-attribution           | CONCERNS deferred; M26 boundary |
| Changing McCabe decision nodes                  | RT-005                          |
| New or renamed warning `code` values            | Stable M26/M28 catalog          |
| Triage hints / legend / colors                  | M41                             |
| `--no-progress` / `--quiet` / `--verbose` flags | M38                             |
| Explain-only scan / skipping coupling           | YAGNI                           |
| Explain as JSON field / schema bump             | stderr CLI only                 |
