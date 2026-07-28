# Milestone 28 — Performance & Diagnostics UX Context

**Feature slug:** `perf-diagnostics-ux`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M28 — CLI `--concurrency`, function-mode progress, warning UX / `meta.warnings` severity  
**Depth:** Large

---

## Decision: Expose complexity concurrency via CLI + config

**Question:** How should operators override the M15 worker-pool size?

**Choice:** Add CLI `--concurrency <n>` **and** config key `concurrency` in `.hotspot-scanner.json`, with precedence **CLI > config > default**.

**Default (unchanged):** `min(os.availableParallelism(), 4)` — exported as `DEFAULT_WORKER_CONCURRENCY` from `src/complexity/pool.ts` (M15 / CONCERNS).

**Validation:** positive integer ≥ 1; invalid values → `CliUsageError` / `ConfigError` (same pattern as `--top` / `minCochange`).

**Rationale:**

- ROADMAP M28 explicitly requires CLI `--concurrency` and documenting the default
- M15 deferred CLI flags (YAGNI then); M28 owns the operator control surface
- Config key matches existing knobs (`top`, `minCochange`, `granularity`)
- Does **not** change the default formula — only exposes the existing injectable override through scan → analyzer

**Status:** **Confirmed**

**Applies to:** HOTSPOT-251, HOTSPOT-252, HOTSPOT-253, HOTSPOT-254.

---

## Decision: Do not expose batch size

**Question:** Should `--batch-size` / config `batchSize` ship with M28?

**Choice:** **No** — `DEFAULT_BATCH_SIZE` (50) stays internal (M15 context).

**Rationale:** ROADMAP scope is concurrency + progress + warnings only; batch size is memory tuning, not operator UX for this milestone.

**Status:** **Confirmed**

**Applies to:** Out of Scope.

---

## Decision: Phase-aware progress (git + function-churn)

**Question:** How should function-mode patch-stream progress differ from the numstat pass?

**Choice:** Extend `onProgress` payload with a required `phase` field:

| `phase`            | Emitter                      | Counter meaning                        |
| ------------------ | ---------------------------- | -------------------------------------- |
| `"git"`            | `GitMiner` (numstat)         | commits processed in numstat stream    |
| `"function-churn"` | `FunctionChurnMiner` (patch) | commits processed in patch/hunk stream |

**Stderr format (throttled, interval unchanged = 1000):**  
`Processing <phase> commit <N>...` (e.g. `Processing function-churn commit 1,000...`).

**Throttle:** remains `maybeLogProgress`-style, evaluated **per phase** (each phase’s counter starts at 1).

**Out of P1:** complexity-stage / batch progress — not in ROADMAP M28 bullets; YAGNI.

**Rationale:**

- Today both miners call `onProgress({ commitsProcessed })` with the same shape; CLI resets visually and operators cannot tell numstat vs patch on large function-mode scans
- Phase label is the minimal fix for “progress reporting in function mode (patch-stream phase)”

**Status:** **Confirmed**

**Applies to:** HOTSPOT-255, HOTSPOT-256, HOTSPOT-257.

---

## Decision: Structured `ScanWarning` with severity (keep version `1.0`)

**Question:** How to consolidate warning UX and `meta.warnings` severity without reopening M26 content?

**Choice:** Introduce shared type:

```ts
type DiagnosticSeverity = "info" | "warning" | "error";

interface ScanWarning {
  severity: DiagnosticSeverity;
  message: string;
  /** Stable machine-oriented code for docs / filtering; optional for forward compat */
  code?: string;
}
```

**Contracts:**

- `ScanResult.meta.warnings: ScanWarning[]` — **additive** required field (empty array when none); `version` stays `"1.0"`
- `CompareResult.meta.warnings` migrates from `string[]` → `ScanWarning[]` (JSON consumers of compare meta must read objects; document in README / interpretation docs)
- `onWarning?: (warning: ScanWarning) => void` — callback receives structured warning
- Stderr: severity-aware prefix — `info:` / `warning:` / `error:` (default emitters use `warning`)

**Severity vs exit code:** Severity is diagnostic classification only. Exit codes remain AGENTS.md rules (scan success even when warnings exist; hard failures still throw). M28 emitters use `warning` for existing warn-and-continue sites; `info` / `error` reserved for documented future use (enum present for forward compat).

**Stable codes for existing sites (no new M26 messages):**

| Code                        | Typical source                       |
| --------------------------- | ------------------------------------ |
| `EMPTY_SINCE_WINDOW`        | git / function-churn empty `--since` |
| `RENAME_HISTORY_INCOMPLETE` | existing rename incomplete strings   |
| `PARSE_FAILED`              | complexity parse skip                |
| `COMPARE_SINCE_MISMATCH`    | compare baseline vs current `since`  |

**Boundary:** Do **not** invent RT-003 / rename-confidence / pós-rename overlap warnings (M26). Only reclassify/route **existing** generic warning strings into `ScanWarning` + docs.

**Rationale:** ROADMAP asks for severity + interpretation docs; structured meta enables JSON consumers; keeping `version: "1.0"` matches prior additive contract style (`additionalProperties: true` schemas).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-258–HOTSPOT-263.

---

## Decision: Requirement ID range

**Question:** Which HOTSPOT IDs does M28 use?

**Choice:** **HOTSPOT-251 through HOTSPOT-265** (15 IDs; all used).

**Status:** **Confirmed**

---

## Decision: Living docs + ROADMAP sync ownership

**Question:** Who syncs ROADMAP/STATE?

**Choice:** Parent agent syncs **ROADMAP.md** / **STATE.md** after planning. This feature folder owns living-doc updates for ARCHITECTURE / CONCERNS / TESTING / README / INTEGRATIONS as needed in Execute (tasks).

**Status:** **Confirmed**
