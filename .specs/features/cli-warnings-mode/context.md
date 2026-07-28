# Milestone 58 — CLI Warnings Mode Context

**Feature slug:** `cli-warnings-mode`  
**Captured:** 2026-07-26  
**Trigger:** ROADMAP M58 + planner lock (parent session)  
**Depth:** Large (diagnostics sink + CLI enum + flush lifecycle + docs/completion)  
**IDs:** HOTSPOT-950–969 (963–969 reserved)

---

## Feature Boundary

Operator control over **stderr warning verbosity** so rename / multi-path diagnostics do not spam the terminal before the Hotspots report. Default becomes `summary` (intentional breaking UX for stderr volume). Structured `meta.warnings` and programmatic `onWarning` stay complete.

**In scope:** `--warnings summary|full` on commands that print scan/compare warnings via `createCliDiagnosticHandlers`; stderr aggregation by code + rename sub-kind; flush after pipeline warning emission; help / completion / living docs.

**Out of scope:** JSON schema / contract bump; config key for warnings mode; overloading `--verbose`; changing executive-summary `Warnings: N total (CODE: n, …)` beyond optional wording consistency; expanding unlinked pairs in `meta.warnings` beyond today’s 5 + remainder formatter; resurrecting function-mode product claims; CI fail-on-warning gates.

**Sisters:** cli-surface-polish (M38 quiet), scan-observability (M51 `--verbose` = git argv only; exec warning summary), explain-and-scan-feedback (M42 next-step copy), rename-confidence (M26), adoption-docs (M45 warning-codes), cli-adoption-extras (M54 completion).

**NCLOC / M57 note:** Plan against **current trunk file-mode** APIs (`RENAME_HISTORY_INCOMPLETE`, `createCliDiagnosticHandlers`, `src/git/rename-warnings.ts`, `src/git/index.ts`). `src/git/function-churn/` may still exist in tree but is **retired** for product scans — do not wire `--warnings` through function-churn paths; file miner is SoT. Dead `formatFunctionPostRenameOverlapWarning` may remain until a cleanup milestone; M58 does not require deleting it.

---

## Decision: Flag shape and default (LOCKED)

**Question:** Name, values, default, invalid handling?

**Choice:**

| Item    | Value                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------- |
| Flag    | `--warnings <mode>`                                                                            |
| Values  | `summary` \| `full`                                                                            |
| Default | **`summary`** (breaking stderr UX — intentional)                                               |
| Invalid | `CliUsageError` → exit **2**, message lists allowed values (parity with `--format` / `--only`) |

No short alias (YAGNI). Present on **`scan`**, **`compare`**, and **`baseline save`** (any path that builds handlers via `executeScan` / `executeCompareAndRender`).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-950, HOTSPOT-951

---

## Decision: Aggregation scope = stderr only (LOCKED)

**Question:** Does summary thin `meta.warnings` / `onWarning` for library callers?

**Choice:** **No.** Git miner / pipeline continue to emit the **full** `ScanWarning[]` into `collectedWarnings` / `meta.warnings` and invoke programmatic `onWarning` with each structured object (unchanged). Aggregation applies **only** inside `createCliDiagnosticHandlers` when writing to stderr.

- No schema change, no JSON `version` bump.
- Unlinked rename formatter still caps samples in the structured list at **5 + “… and N more”** as today (do **not** expand meta to every pair in this milestone).
- Under `--warnings=summary`, stderr collapses those into **one aggregated line per rename sub-kind** (not 5 samples).
- Under `--warnings=full`, stderr logs each warning as today (including unlinked cap + remainder line).

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-952, HOTSPOT-953

---

## Decision: `--verbose` / `--quiet` interaction (LOCKED)

**Question:** How do flags compose?

**Choice:**

| Flag                          | Role                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `--verbose`                   | **Git spawn argv only** (M51 lock). Do **not** overload for warning detail.                 |
| `--warnings=full`             | Owns per-path / per-pair **stderr** expansion.                                              |
| `--quiet`                     | Suppresses progress + `severity: "info"`. Warning/error still respect `--warnings` mode.    |
| `--quiet` + `--warnings=full` | Quiet wins for progress/info; warning/error still emit in **full** detail per `--warnings`. |
| `--no-progress`               | Progress only; unrelated to warning aggregation.                                            |

**Status:** **Confirmed — planner locked** (echoes M51 + user lock)

**Applies to:** HOTSPOT-954

---

## Decision: What `summary` means on stderr (LOCKED)

**Question:** How to aggregate?

**Choice:**

1. Group buffered `warning` / `error` diagnostics by **`(code, subKind)`**.
2. **Rename sub-kinds** under `RENAME_HISTORY_INCOMPLETE` (classify by stable message prefixes from `format*` in `rename-warnings.ts` — no new JSON fields):
   | subKind            | Message shape (today)                                                        |
   | ------------------ | ---------------------------------------------------------------------------- |
   | `ambiguous`        | `Rename history may be incomplete for: …`                                    |
   | `unlinked`         | `Suspected unlinked rename…` and `... and N more suspected unlinked rename…` |
   | `since-truncation` | `Rename history before the --since window…`                                  |
3. Emit **one stderr line per non-empty group**, with **count** + shared next-step text (reuse existing next-step sentences).
4. Codes that already emit a single logical line (`EMPTY_SINCE_WINDOW`, `COMPARE_SINCE_MISMATCH`, single `since-truncation`, etc.) stay one line (count may be 1).
5. Repeated same-code multi-file noise (e.g. many `READ_FAILED`) **also** collapses to one line with count under summary.
6. `severity: "info"` — under default/non-quiet: if multiple info of same code, may aggregate similarly; under `--quiet`, info remains suppressed entirely (existing M38).

**Unlinked under summary:** Prefer a **single** aggregated line with total pair count + next-step — **not** 5 samples then “… and N more”.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-955, HOTSPOT-956, HOTSPOT-957

---

## Decision: Aggregation lives in CLI diagnostic sink (LOCKED)

**Question:** Where does summary logic live?

**Choice (suggested default locked):**

```
Git miner / pipeline → full ScanWarning[] → meta.warnings (unchanged)
                              ↓
              createCliDiagnosticHandlers({ quiet, noProgress, warningsMode })
                              ↓
         summary: buffer → flush → group by (code, subKind) → one stderr line each
         full:    log each warning immediately (flush no-op)
```

- Extend `CliDiagnosticOptions` with `warningsMode?: "summary" | "full"` (default **`summary`** when omitted).
- Handlers return `{ onProgress, onWarning, flushWarnings }`.
- **`flushWarnings()`** must be called by bin/`scan-actions` after all CLI-path warning emission for that command (after `runScan` returns; for compare, after the compare `meta.warnings` loop).
- Programmatic library callers that pass their own `onWarning` are unaffected.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-958, HOTSPOT-959

---

## Decision: Config key — CLI-only (LOCKED)

**Question:** May `.hotspot-scanner.json` set `warnings`?

**Choice:** **CLI-only.** No config key. Matches M38 `--quiet` / `--no-progress` and M51 `--verbose` (presentation/transport stay out of config). Precedence remains CLI > config > defaults for scan parameters only.

**Rationale:** Warning stderr presentation is operator session UX, not durable scan parameters; M21/M38 pattern.

**Status:** **Confirmed — planner locked**

**Applies to:** HOTSPOT-950 (docs must state CLI-only)

---

## Decision: Executive summary on stdout (LOCKED)

**Question:** Change `Warnings: N total (CODE: n, …)`?

**Choice:** **Leave behavior.** Already aggregates by code. Tiny wording tweak only if needed for consistency with stderr summary labels — do **not** remove; do not require sub-kind breakdown on stdout in M58.

**Status:** **Confirmed — planner locked**

---

## Open items

_None._ All gray areas closed by user lock + planner confirmation above.
