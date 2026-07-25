# Milestone 49 — Pipeline Perf Controls Context

**Feature slug:** `pipeline-perf-controls`  
**Milestone:** ROADMAP M49  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-710–729  
**Status:** Locked (planning) — no open discuss items  
**Captured:** 2026-07-24 (planner-feature; user-locked + agent discretion)

---

## Intent

M34 made **file-mode** `GitMiner.mine ∥ ComplexityAnalyzer.analyze` the default for lower wall time at higher peak RSS. Operators and maintainers need:

1. A **CLI opt-out** to force sequential stages (debug flaky overlap, lower peak memory, A/B timing).
2. An **automated bench harness** that records wall-clock + scale counts without polluting the `pnpm test` / CI gate.

Function mode already sequences numstat → complexity (M35 `pathAllowlist`); the new flag must remain safe there. Pathspec batching (M47) and SIGINT (M51) stay out of scope.

**Sisters:** [pipeline-stage-overlap](../pipeline-stage-overlap/) (M34), [ast-parallelization](../ast-parallelization/) (M15), `scripts/benchmark-scan.md`, M51 (explicitly excludes bench harness).

---

## Decision: Primary flag + alias (LOCKED)

| Role | Flag |
| ---- | ---- |
| **Primary** | `--sequential` |
| **Alias** | `--no-overlap` |

**Semantics:** Either flag alone sets `ScanOptions.sequential = true`. Both together = same effect (not an error).

**Help copy:** Primary documents behavior; alias help text MUST state it is an alias for `--sequential` (and that both disable M34 file-mode git∥complexity overlap).

**Rationale:** `--sequential` states the resulting stage order; `--no-overlap` matches M34 vocabulary for operators who think in “overlap on/off.”

**Applies to:** HOTSPOT-710, HOTSPOT-711, HOTSPOT-717.

---

## Decision: Default remains overlap ON (LOCKED)

Omit both flags → file-mode M34 overlap unchanged (`Promise.all` start of mine ∥ analyze).

**Applies to:** HOTSPOT-712.

---

## Decision: CLI-only — no config key (LOCKED)

`sequential` is **not** a `.hotspot-scanner.json` key and **not** part of `HotspotScannerConfig`. Wire like other runtime CLI controls (`--quiet`, `--explain`): set on `ScanOptions` from the bin / `executeScan` path only.

Precedence irrelevant beyond CLI presence. Programmatic API callers may set `ScanOptions.sequential` directly.

**Rationale:** YAGNI — opt-out is for debugging/benchmarks, not permanent project config; avoids config schema churn.

**Applies to:** HOTSPOT-713.

---

## Decision: What “sequential” changes in `runScan` (LOCKED)

| Mode | With `sequential: true` | Default (`sequential` falsy) |
| ---- | ----------------------- | ---------------------------- |
| **file** | `await mine` then `await analyze` (pre-M34 order); no concurrent in-flight mine∥analyze | M34 `Promise.all` overlap + sibling abort on first failure |
| **function** | Accept flag; git→complexity already sequenced for allowlist — **no timing change required**; must not error | Current M35-aware wiring |

Scoring / coupling / function-churn barriers, rankings, and JSON `version: "1.0"` stay unchanged.

**Abort:** Sequential path may omit sibling-abort orchestration (no concurrent sibling). Failures still reject `runScan` with the original error; no partial rankings. Shared `AbortController` reuse is implementer discretion if it simplifies code — behavior must not regress default overlap cancel semantics.

**Applies to:** HOTSPOT-710, HOTSPOT-714, HOTSPOT-715, HOTSPOT-716.

---

## Decision: Commands that expose the flags (LOCKED)

Add `--sequential` / `--no-overlap` wherever `--concurrency` is already a scan-tuning flag:

- `scan`
- `compare`
- `baseline save` (if it accepts concurrency today)

Forward into `runScan` via `ScanOptions.sequential`. Dry-run / doctor: **no** (no mine/AST).

**Applies to:** HOTSPOT-711, HOTSPOT-717.

---

## Decision: Benchmark harness (LOCKED)

| Topic | Choice |
| ----- | ------ |
| Entry | `package.json` script **`pnpm bench`** |
| Implementation | Script under `scripts/` (e.g. `scripts/bench-scan.mjs` or `.ts` runnable via `tsx`/node) — prefer zero new runtime dependency |
| Metrics | **Wall-clock** (ms or seconds) + **counts** (at least: commits processed and/or eligible source files; document fields in `scripts/benchmark-scan.md`) |
| Modes | Support comparing **default overlap** vs **`--sequential`** (A/B) on the same repo path |
| Repo | Accept path arg and/or generate/use a documented disposable synthetic repo (evolve Option B from current `benchmark-scan.md`) |
| Gate policy | **NOT** part of `pnpm test`; **no** CI duration thresholds; **no** fail-on-slow exit for timing |
| Docs | Update `scripts/benchmark-scan.md` to point operators at `pnpm bench` while keeping qualitative notes for M15/M31/M36 |

**Applies to:** HOTSPOT-721–726.

---

## Decision: Equivalence testing (LOCKED)

Prove rankings/`meta` semantic equivalence for file mode: default overlap vs `sequential: true` on `tests/fixtures/repos/small-ts` under fixed options. Prove **non-overlap** structurally in unit tests with delayed mocks (assert stages are **not** concurrently in-flight when sequential). **No** wall-clock asserts in Vitest/CI.

**Applies to:** HOTSPOT-716, HOTSPOT-719, HOTSPOT-720.

---

## Explicit non-goals (context)

- Pathspec batching / mega-commit CLI (M47)
- SIGINT / shared process AbortSignal (M51)
- CI timing thresholds or bench inside `pnpm test`
- Config key for sequential
- Changing M15/M31 worker concurrency semantics (`--concurrency` unchanged)
- Function-churn ∥ numstat
- Ranking / JSON schema / warning code changes

---

## Open items

None — no `PENDENTE-DISCUSSÃO`. Ready for Design / Tasks.
