# Milestone 51 — Scan Observability Context

**Feature slug:** `scan-observability`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M51 + planner lock (parent session)  
**Depth:** Large (schema + CLI + SIGINT + function-churn abort sprawl)  
**IDs:** HOTSPOT-770–799

---

## Feature Boundary

Operator observability for long scans and doctor: clean cancel on SIGINT/SIGTERM, additive stage timings in JSON meta, human warning summaries, structured doctor JSON, and a narrow `--verbose` that traces git spawn argv only.

**In scope:** Abort wiring through numstat, complexity pool, and function-churn patch spawn; `meta.timings`; table/markdown warning count+code summary (scan + compare); `doctor --format json`; `--verbose` git argv stderr.

**Out of scope:** Doctor remount prelude (M52); benchmark harness (M49); ranking/score changes; general debug/AST verbose dumps; new progress phases; fail-on-warning CI gates.

**Sisters:** perf-diagnostics-ux (M28), pipeline-stage-overlap (M34 — SIGINT was out of scope there), cli-surface-polish (M38 — general `--verbose` omitted), output-interpretation-ux (M41 summary).

---

## Decision: SIGINT / SIGTERM cancel + exit policy (LOCKED)

**Question:** How should user interrupt behave, and what exit code?

**Choice:**

1. **Bin owns process listeners** for `SIGINT` and `SIGTERM` while `scan` / `compare` (and any path that calls `runScan`) are in flight. On first signal: `abort()` a shared controller, remove listeners, do not re-raise.
2. **`ScanOptions.signal?: AbortSignal`** — bin passes the controller signal into `runScan`. Orchestrator keeps the existing sibling-failure `AbortController` and **links** external abort → internal `abort()` (and vice versa only as needed so all stages see one abort).
3. **Function-churn** must honor the same signal: extend `streamGitPatchLog` / `FunctionChurnMiner.mine` to kill the patch child (today options type inherits `signal` but spawn **does not** wire abort — gap from M34 follow-up).
4. **No zombies:** on abort, git children (`child.kill`) and complexity workers (pool terminate) settle via existing M34 patterns; await settlement before process exit.
5. **No partial report:** do not write scan/compare stdout/file body on cancel; do not emit a successful `ScanResult`.
6. **Stderr:** one concise line, e.g. `warning: scan cancelled` (severity `warning`), no stack dump for clean cancel.
7. **Exit codes (POSIX 128+N):**
   | Signal | Exit |
   | ------ | ---- |
   | `SIGINT` | `130` |
   | `SIGTERM` | `143` |
8. Sibling-failure abort (non-signal) remains existing non-zero error path (unchanged exit semantics for `GitLogError` / analyzer errors).

**Rationale:** Completes M34 coherent cancel for operators; POSIX exit codes are familiar in shells/CI; avoids ambiguous “success with empty rankings.”

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-770–779

---

## Decision: `meta.timings` shape + JSON version (LOCKED)

**Question:** Bump JSON `version` or stay additive under `1.0`?

**Choice:** **Keep `version: "1.0"`.** Add optional-but-documented `meta.timings` under `ScanMeta`. Schema already has `ScanMeta.additionalProperties: true`; still **declare** `timings` in `schemas/scan-result.json` `$defs.ScanMeta.properties` for contract clarity. Compare baselines embed `ScanMeta` — consumers that ignore unknown keys remain fine; `loadBaseline` must continue to accept results with or without `timings`.

**Shape (wall-clock ms, integers ≥ 0):**

```ts
interface ScanStageTimings {
  gitMs: number;
  complexityMs: number;
  /** Present only when granularity === "function"; omit key in file mode */
  functionChurnMs?: number;
  totalMs: number;
}
```

**Rules:**

- Always populate `timings` on successful `runScan` (like `warnings` always present).
- Measure stages with `performance.now()` (or equivalent) around existing promises; `totalMs` from start of mining/analysis work through return (include scoring/enrich in `totalMs`, no separate `scoringMs` — YAGNI).
- File mode: omit `functionChurnMs` (do not send `0`).
- Overlap (file mode): `gitMs` and `complexityMs` are each stage’s own duration (may overlap wall clock); `totalMs` is wall clock for the overlapped section + post work — document in README that stage sums may exceed `totalMs` under overlap.
- Human table/markdown: **do not** dump full timings block in M51 (JSON + optional one-line in executive summary is enough — see warning decision). Prefer timings primarily for JSON consumers; optional single summary line `Timing: total Ns (git …, complexity …)` is **in scope** if cheap; CSV `meta.json` includes timings via full meta serialize.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-780–785

---

## Decision: Warning count / code summary (LOCKED)

**Question:** Where and how to summarize warnings in human reports?

**Choice:** Extend **executive summary** (M41 `buildScanExecutiveSummary` / `buildCompareExecutiveSummary`) for **table** and **markdown** only.

**Scan line:**

- Empty: `Warnings: 0`
- Non-empty: `Warnings: N total (CODE_A: a, CODE_B: b, …)` with codes sorted lexicographically; counts by `warning.code`.
- Warnings **without** `code`: fold into `(uncoded): k` in the parenthetical (still counted in `N`).

**Compare:** Same format over `CompareResult.meta.warnings` only (compare-level array — not a recursive dump of nested baseline/current `ScanMeta.warnings`). Nested scan warning arrays remain in JSON meta as today.

**Out of summary:** JSON/CSV payloads unchanged except timings on scan meta; full warning objects stay in `meta.warnings` / compare footers as today.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-786–789

---

## Decision: `doctor --format json` (LOCKED)

**Question:** What is the structured doctor payload?

**Choice:**

| Flag | Values | Default |
| ---- | ------ | ------- |
| `-f, --format <format>` on `doctor` | `text` \| `json` | `text` |

**JSON stdout (success and failure paths that still print findings):**

```json
{
  "version": "1.0",
  "findings": [
    { "id": "node-engines", "status": "pass", "message": "…" }
  ],
  "exitCode": 0
}
```

- `findings` / `exitCode` match existing `DoctorResult` (exit policy unchanged from M39).
- `text` keeps current `status: message` lines.
- Invalid format → `CliUsageError` (exit `2`).
- No schema file required in M51 (doctor is not a baseline contract); document shape in README. Optional tiny fixture assert in CLI tests only.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-790–793

---

## Decision: `--verbose` = git spawn argv only (LOCKED)

**Question:** Reopen M38 omit-`--verbose`?

**Choice:** **Narrow reopen** — CLI-only `--verbose` on `scan` and `compare` (commands that spawn git).

| Behavior | Rule |
| -------- | ---- |
| Emit | Before each git spawn (numstat + function-churn patch), one stderr line: `verbose: git <argv joined by space>` |
| Scope | Spawn argv only — **not** AST dumps, not progress spam, not scoring traces |
| Quiet | `--quiet` **suppresses** verbose lines |
| Config | Not a `.hotspot-scanner.json` key |
| Implementation | Prefer injectable hook / option on spawn helpers (e.g. `onSpawnArgv?: (argv: string[]) => void`) so bin/diagnostics own formatting |

**Rationale:** STATE already records this reopen; useful for pathspec/ARG_MAX debugging without a general debug mode.

**Status:** **Confirmed — planner locked** (narrow reopen of M38)

**Applies to:** HOTSPOT-794–797

---

## Deferred / non-goals

| Item | Disposition |
| ---- | ----------- |
| Doctor remount / shared prelude with `runScan` | M52 |
| Benchmark harness / wall-clock CI budgets | M49 |
| Ranking or formula changes | Out of scope |
| `--strict` on warnings / fail-on-warning | Not M51 (M53 owns compare strict elsewhere) |
| Verbose beyond git argv | Rejected |

---

## Open for implementer discretion (non-blocking)

- Exact AbortController link helper location (`src/scan.ts` vs small `src/diagnostics/abort.ts`) — prefer keep in `scan.ts` unless bin needs shared helper for compare-only paths.
- Whether `totalMs` includes config/discovery prelude before first spawn — prefer **yes** (whole `runScan` body) for operator usefulness.
