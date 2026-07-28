# Milestone 77 — Hotspot Assess Context

**Feature slug:** `hotspot-assess`  
**Milestone:** ROADMAP M77  
**Depth:** Large  
**Requirement IDs:** HOTSPOT-1620–1679 (unused IDs in band reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Inspiration:** Tornhill growth patterns + scan ranking — batch “which hotspots are deteriorating?” without reopening compare  
**Sisters:** [complexity-trend](../complexity-trend/spec.md) (M72), [growth-pattern-trend-bridge](../growth-pattern-trend-bridge/spec.md) (M75), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42); [trend-color-ux](../trend-color-ux/spec.md) (M76 Planned — do **not** block); [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do **not** reopen compare)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)

---

## Intent

Close the scan → trend loop at **repo scale**: run a normal hotspot scan, keep files above a hotspotScore floor, cap to `--top`, then run per-file complexity trend + growth-pattern classification and aggregate into an assess report focused on **deteriorating** candidates.

```text
scan   → which files are hotspots now?
trend  → how is one file evolving? + Pattern
assess → which top hotspots look deteriorating? (batch)
```

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field | Value |
| ----- | ----- |
| Milestone | **M77** |
| Slug | `hotspot-assess` |
| Depth | **Large** |
| IDs | **HOTSPOT-1620–1679** (next free band after M76 HOTSPOT-1600–1619) |
| Priority | **High** |

**Status:** **Confirmed** — do not re-open

---

## Decision: CLI grammar (LOCKED)

| Field | Value |
| ----- | ----- |
| Command | `hotspot-scanner assess <path>` |
| Positional | Repository path (required directory; defaulting to `.` is allowed if consistent with scan — prefer **required or default `.`** like scan: use **`assess [path]` default `.`**) |
| Formats | `table` \| `json` \| `markdown` (default `table`) |
| `--output` | Optional write path (parity with scan/trend) |
| CSV | **Out of scope** MVP |

**Status:** **Confirmed** — do not re-open  
**Agent note:** Positional defaults to `.` like `scan` for DX consistency (locked here as Confirmed).

---

## Decision: Pipeline (LOCKED)

```text
runScan → filter hotspotScore >= minHotspotScore → sort desc → slice --top
       → runComplexityTrend × N (per candidate) → AssessResult → report
```

| Step | Behavior |
| ---- | -------- |
| Scan | Existing `runScan` (config merge for scan params; same `--since` / include / exclude / concurrency / include-tests semantics) |
| Filter | Keep hotspots with `hotspotScore >= minHotspotScore` |
| Sort | Desc by `hotspotScore` (scan already sorts; re-assert after filter) |
| Cap | Slice first `--top` after filter (default **20**) |
| Trend | Call `runComplexityTrend` per candidate (already classifies via M75) |
| Aggregate | Build `AssessResult` with summary counts + per-candidate rows |

**Status:** **Confirmed** — do not re-open

---

## Decision: Flags (LOCKED)

| Flag | Default | Notes |
| ---- | ------- | ----- |
| `--min-hotspot-score <n>` | **0.7** | Long name **required** (not ambiguous `--min-score`); help text must say it is **hotspotScore** |
| `--top <n>` | **20** | Candidate cap **after** score filter; applies to **all** formats (unlike scan table-only top) |
| `--since` / `--include` / `--exclude` | Same as scan | Config merge for scan-backed params |
| Assess-only flags | CLI-only | `--min-hotspot-score` never a config key in MVP |
| `--top` for assess | CLI + may honor config `top` when CLI omits | Same config key as scan display default; semantics = assess candidate cap |
| Trend internals | Trend defaults | `--max-revisions` 100 / `--follow` on / no forensic `--start`/`--end` in MVP unless later task adds optional pass-through — **MVP: use trend defaults only** |

**Status:** **Confirmed** — do not re-open

---

## Decision: Output shape (LOCKED)

### Table / markdown

1. **Summary** — candidate count; counts by `growthPattern.kind`; skipped/error counts  
2. **Detailed section** — **only** candidates with `kind === "deteriorating"` (compact evidence: path, hotspotScore, Pattern summary; **no** full revision table / points dump)

### JSON

| Field | Value |
| ----- | ----- |
| `kind` | `"hotspot-assess"` |
| `version` | `"1.0"` |
| Schema | `schemas/hotspot-assess.json` |
| Isolation | Do **not** embed in scan `3.0` or complexity-trend `3.0` |
| Points | **No** full `points` dump in MVP |

**Status:** **Confirmed** — do not re-open

---

## Decision: Library export (LOCKED)

| Field | Value |
| ----- | ----- |
| Export | `runAssess` (parity with `runScan` / `runComplexityTrend`) |
| Package | Public entry + `#assess` import alias |

**Status:** **Confirmed** — do not re-open

---

## Decision: Concurrency + progress (LOCKED — agent discretion confirmed)

| Field | Value |
| ----- | ----- |
| Trend concurrency | **Sequential** (one `runComplexityTrend` at a time) in MVP |
| Progress | Per-file stderr progress when not quiet (e.g. `Assessing 3/20 path…`) — ephemeral TTY overwrite preferred when TTY |
| Scan phase | Unchanged `runScan` worker concurrency |
| Abort | Honor shared cancel signal (SIGINT→130 / SIGTERM→143) through assess orchestration |

**Status:** **Confirmed** — do not re-open

---

## Decision: Per-file trend failures (LOCKED)

| Case | Behavior |
| ---- | -------- |
| Trend usage / not-tracked / show failures | Record candidate as `skipped` or `error` with message; **continue** remaining files |
| Whole assess abort | Only on scan failure, CLI usage errors, or cancel |
| Exit code | **0** on successful assess completion even if some candidates errored (no fail-on-deteriorating) |

**Status:** **Confirmed** — do not re-open

---

## Out of scope MVP (LOCKED)

| Item | Reason |
| ---- | ------ |
| `--fail-on-deteriorating` / SARIF / exit 1 for deteriorating | Deferred CI horizon; false positives (formatter cliffs) |
| CSV format | YAGNI |
| Assess-specific config keys | CLI-only for assess-only flags |
| McCabe / historical AST | M57/M72 locks |
| Reopen compare / baseline | M71 |
| `scan --trend-top` / embedding assess in scan JSON | Cost / contract isolation |
| Assess ANSI color | Do **not** block on M76; plain table/markdown in MVP |
| Parallel trend pool | Sequential MVP; revisit if perf demands |

**Status:** **Confirmed** — do not re-open

---

## Supersedes (documentation only)

| Prior lock | Change |
| ---------- | ------ |
| M75 out-of-scope `scan --trend-top` / batch | Delivered as **dedicated** `assess` command (not scan flag) |

Historical M72/M75 Done specs remain historical; do not rewrite their acceptance.
