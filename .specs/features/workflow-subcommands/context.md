# Milestone 40 — Workflow Subcommands Context

**Feature slug:** `workflow-subcommands`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M40 / post-M37 DX item 7; locked decisions at planning start

---

## Decision: `baseline save` subcommand

**Question:** How should users persist a reusable baseline without remembering `--format json --output`?

**Choice:** **`hotspot-scanner baseline save <repoPath>`** — nested Commander command under parent `baseline`. Runs a normal `runScan()` and writes a `ScanResult` JSON file (JSON semantics: full ranked arrays, `version: "1.0"`).

**Rationale:**

- Makes the save/compare workflow explicit for CI and recipes (M45)
- Reuses existing scan pipeline; no new domain module
- Nested `baseline save` leaves room for future baseline helpers without polluting top-level

**Status:** **Confirmed** (locked)

**Applies to:** HOTSPOT-490–495, design § CLI surface, T2.

---

## Decision: Default baseline output path

**Question:** What path is used when `--output` is omitted on `baseline save`?

**Choice:** **`./hotspot-baseline.json`** (cwd-relative). `--output <path>` overrides. Path is not required when the default is acceptable.

**Rationale:**

- Predictable convention for docs/recipes
- Matches “required or default” planning lock — default satisfies the write destination
- Reuse existing `validateOutputPath` before write (directory / missing parent → `CliUsageError`)

**Status:** **Confirmed** (locked — default path)

**Applies to:** HOTSPOT-491, HOTSPOT-492, T2.

---

## Decision: `compare` subcommand + keep `scan --baseline`

**Question:** Should compare be a dedicated command, and what happens to `scan --baseline`?

**Choice:**

1. Add **`hotspot-scanner compare <repoPath> --baseline <file>`** — thin CLI wrapper around the same load → `runScan` → `compareScanResults` → `renderCompare` path used by `scan --baseline`.
2. **Keep `scan --baseline` working** — no removal, no deprecation warning in M40.

**Rationale:**

- Explicit verb for workflows that already think in “save then compare”
- Parity avoids two compare engines; `--baseline` remains the familiar flag for existing scripts
- YAGNI: no dual maintenance of domain logic — only CLI registration differs

**Status:** **Confirmed** (locked)

**Applies to:** HOTSPOT-496–499, T3, T4.

---

## Decision: Persistence model

**Question:** Where are baselines stored?

**Choice:** **JSON files only** — no DB, no cache store, no new config keys for baseline paths.

**Rationale:**

- Aligns with M13 baseline-as-file and STATE (no CI fail thresholds / no persistence layer)
- `loadBaseline` / `writeFile` remain the only I/O

**Status:** **Confirmed** (locked)

**Applies to:** all tasks; Out of Scope in spec.

---

## Decision: Domain vs bin boundary

**Question:** Where does compare/scan logic live for the new commands?

**Choice:** **Reuse `runScan` / `loadBaseline` / `compareScanResults` / reporters** — domain stays in `src/`. Bin only parses flags, validates paths, wires calls, and writes files/stdout.

**Rationale:**

- AGENTS.md / ARCHITECTURE: commander in bin, no domain logic in bin
- Avoid duplicating compare classification or JSON shaping in CLI

**Status:** **Confirmed** (locked)

**Applies to:** HOTSPOT-500, design § Code Reuse, T1–T3.

---

## Decision: `baseline save` format surface

**Question:** Does `baseline save` accept `--format` / `--baseline` / `--top`?

**Choice:**

| Flag | On `baseline save` |
| ---- | ------------------ |
| `--output` | Yes (default `./hotspot-baseline.json`) |
| Scan options (`--since`, `--granularity`, `--top`, `--min-cochange`, `--include`/`--exclude`, `--concurrency`, `--config`) | Yes — same merge semantics as `scan` (CLI > config > defaults). `--top` does **not** truncate JSON (M16: ignored for json) |
| `--format` | **Not exposed** — always ScanResult JSON |
| `--baseline` | **Not exposed** |

**Rationale:**

- “JSON semantics” means a loadable baseline, not a human table
- M16 already defines JSON as full arrays; save must remain round-trippable via `loadBaseline`

**Status:** **Confirmed** (agent discretion within lock)

**Applies to:** HOTSPOT-493, HOTSPOT-494, T2.

---

## Decision: `compare` flag surface

**Question:** Which flags does `compare` support?

**Choice:** Same as `scan --baseline` branch: required `--baseline <file>`; optional `--format`, `--output`, `--top`, scan options, `--config`. CSV still requires `--output`. Exit `0` on successful compare regardless of delta content (STATE / M13).

**Rationale:**

- Behavioral parity with `scan --baseline` (HOTSPOT-497)
- No new CompareResult schema or fail-on thresholds

**Status:** **Confirmed** (agent discretion within lock)

**Applies to:** HOTSPOT-496–498, T3.

---

## Decision: Overwrite behavior

**Question:** Does `baseline save` refuse to overwrite an existing file?

**Choice:** **Overwrite without prompt** — same as `scan --output` today. No `--force` / `--no-clobber` in M40.

**Rationale:** YAGNI; CI scripts expect idempotent rewrite of the baseline path.

**Status:** **Confirmed** (agent discretion)

**Applies to:** HOTSPOT-492, edge cases.

---

## Out of scope (locked)

| Item | Reason |
| ---- | ------ |
| Fail-on thresholds / non-zero exit on delta | STATE: M12 CI gate removed |
| CI action packaging | Future backlog |
| Changing `CompareResult` / `ScanResult` schema | Sister of M13/M20 — reuse as-is |
| Deprecating `scan --baseline` | Explicit keep |
| DB / remote baseline store | Locked: JSON files only |

---

## Related closed decisions

| Decision | Value | Relevance to M40 |
| -------- | ----- | ---------------- |
| M13 CLI shape | `scan --baseline` only | M40 **adds** subcommands; does not remove flag |
| Exit code on successful compare | `0` | Same for `compare` subcommand |
| JSON `--top` | Ignored (full arrays) | Baseline save always full ScanResult |
| Baseline validation | Strong `loadBaseline` | Compare path unchanged |
| Requirement ID range | HOTSPOT-490–509 | M40 allocation |
