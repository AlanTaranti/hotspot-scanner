# Milestone 5 — Reporter + CLI Context

**Feature slug:** `reporter-cli`  
**Captured:** 2026-07-22  
**Trigger:** Open decisions from IMPL §6.1, §16 and ROADMAP M5 scope

---

## Decision: Default `--top` value

**Question:** IMPL §16 leaves default `--top` as `[CLARIFICAR]`. What value should M5 use when the flag is omitted?

**Proposed choice:** **20** — exported as `DEFAULT_TOP` from `src/scan.ts` (alongside existing `DEFAULT_SINCE`).

**Rationale:**

- Balances readability (fits typical terminal width) with enough signal for triage
- Matches common CLI defaults for ranked listings (e.g., `head -20`)
- Aligns with `vitals-cli-validation` skill examples (`--top 20`)

**Status:** **Confirmed: 20** — implementer uses `DEFAULT_TOP = 20` in `src/scan.ts`.

**Applies to:** Both hotspot and coupling tables/JSON arrays (same `--top` limits both rankings per IMPL §6.1).

---

## Decision: Progress log format (no total commit count)

**Question:** IMPL §8.5 example shows `"processando commit 5.000/40.000"`. Can M5 show total commits during streaming parse?

**Choice:** **Progress without total** — log `"Processing commit 5,000..."` (or similar) at throttled intervals.

**Rationale:**

- Git miner streams `git log` in a single pass (ADR-2026-020); a second pass to count commits would double I/O on large repos
- `GitMiner` tracks `commitCount` internally and exposes it via `onProgress({ commitsProcessed })` after each commit
- Total commits unknown until stream ends; M6 may add a final summary line (`Processed N commits`)

**Applies to:** `GitMinerOptions.onProgress` callback + CLI wiring via `ScanOptions.onProgress` (infrastructure in M5; full pipeline invocation in M6).

---

## Decision: Warning and progress output channel

**Question:** Where do warnings and progress messages go relative to scan results?

**Choice:**

- **Warnings** → `stderr` via `src/diagnostics/logger.ts`
- **Progress** → `stderr` via same module (throttled)
- **Scan results** (table or JSON) → `stdout` only

**Rationale:**

- Allows `hotspot-scanner scan ... --format json > report.json` without polluting JSON file
- Matches common CLI conventions and IMPL §8.5 observability intent

---

## Decision: `runScan()` scope in M5

**Question:** How much pipeline wiring belongs in M5 vs M6?

**Choice:** M5 updates `runScan()` for **option defaults**, **diagnostics callback plumbing**, and **typed empty `ScanResult`** — **no** calls to `GitMiner`, `ComplexityAnalyzer`, or scorers.

**Rationale:**

- Consistent with M2–M4 isolation pattern (each module testable independently)
- M4 explicitly deferred `src/scan.ts` pipeline wiring to M6 Integration
- M5 validates Reporter + CLI + diagnostics on stub/empty results; M6 adds fixture E2E with real pipeline

---

## Related closed decisions (STATE.md)

| Decision | Value | Relevance to M5 |
| -------- | ----- | ----------------- |
| Default `--since` | `"12 months ago"` | CLI default + `meta.since` in output |
| Default `--min-cochange` | `3` (`DEFAULT_MIN_COCHANGE`) | CLI default; import from `src/scoring/` |
| Exit code on success | `0` | No fail thresholds in v1 |
| `authors` not in JSON | Excluded | `ScanResult` schema has no authors field |
| Requirement ID start | `HOTSPOT-39` | Continues after M4 (`HOTSPOT-38`) |
