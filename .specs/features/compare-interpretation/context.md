# Milestone 53 — Compare Interpretation Context

**Feature slug:** `compare-interpretation`  
**Milestone:** ROADMAP M53  
**Depth:** Medium  
**Requirement IDs:** HOTSPOT-820–839  
**Status:** Locked (planning) — no open discuss items  
**Sisters:** [output-interpretation-ux](../output-interpretation-ux/) (M41), [explain-and-scan-feedback](../explain-and-scan-feedback/) (M42), [scan-compare](../scan-compare/) (M13)

---

## Intent

M41 deliberately omitted triage on compare reports (absolute thresholds are misleading on deltas). M42 `--explain` looks up **scan** rankings only; today `scan --baseline --explain` explains the current `ScanResult`, not the delta. M13 treats `COMPARE_SINCE_MISMATCH` as warn-and-continue (exit `0`).

M53 closes the compare interpretation gap: **delta-aware** triage on table/markdown, **compare-target** `--explain` on stderr, and optional **`--strict`** so mismatched `--since` windows fail CI with exit ≠ 0.

**Supersedes:** M41 context D4 “Compare: No triage hints”; STATE row “M53 will override M41 no compare triage”.

---

## Decision: Delta-aware triage rules (LOCKED)

**Question:** What triage rules apply to compare table/markdown without reusing absolute-only M41 rules on rank deltas?

**Choice:** Default **ON** for compare `table` and `markdown` only. Disable with `--no-triage-hints` (same flag as M41; **no longer a no-op** for compare). Exactly **3** deterministic rules. Cap **3 matches per rule**. Evaluate on the **sliced** display set (what the user sees). Omit section when no matches. Never emit triage in json/csv. Must not change rankings, scores, or JSON/CSV payloads.

| ID | Condition | Hint text (stable) |
| -- | --------- | ------------------ |
| `new-dual-signal` | Entity in `hotspots.new` or `functions.new` with `hotspotScore ≥ 0.7` **and** `complexityNormalized ≥ 0.5` **and** `churnNormalized ≥ 0.5` | `New dual-signal hotspot vs baseline — complexity and churn both elevated; prioritize review.` |
| `rank-worsened` | Entry in `hotspots.rankChanged` or `functions.rankChanged` with `rankDelta ≥ 5` (positive = moved **down** / worse) **and** `entity.hotspotScore ≥ 0.5` | `Rank worsened by ≥5 vs baseline — investigate regression.` |
| `new-coupled-with-static` | Pair in `coupling.new` with `couplingStrength ≥ 0.5` **and** `hasStaticDependency === true` | `New strong temporal coupling with a static dependency vs baseline — candidate boundary/split review.` |

**Thresholds:** Export named constants (reuse M41 dual-signal / coupling strength where equal; add `COMPARE_TRIAGE_RANK_DELTA_THRESHOLD = 5` and `COMPARE_TRIAGE_WORSENED_SCORE_THRESHOLD = 0.5`).

**Presentation:** Same titles as scan — `Triage hints` / `## Triage hints` — after delta tables, before glossary / trailing notes.

**Not rules (YAGNI):** removed entities; coupling `rankChanged`; dual-signal on rankChanged current scores alone; ML.

**Applies to:** HOTSPOT-820–827.

---

## Decision: Compare `--explain` (LOCKED)

**Question:** How does `--explain` behave when a compare is running?

**Choice:**

1. **Always** run full scan + compare + normal compare report (same as M42 “full then explain”).
2. When compare mode is active (`scan --baseline` **or** `compare` command) and `--explain <target>` is set, explain against **`CompareResult`**, not the bare current `ScanResult`.
3. Stream = **stderr** after report write (stdout / `--output` unchanged).
4. Grammar = M42 (`path` or `path:function`); path normalization = M42; `--top` does not hide explainable entities (lookup on **full** compare arrays before slice).
5. Lookup order per target: `new` → `removed` → `rankChanged` within the active granularity section (`hotspots` or `functions`). Coupling explain is **out of scope** (path targets only).
6. Explain block MUST include: classification (`new` | `removed` | `rank-changed`), identity, and for rank-changed: `baselineRank`, `currentRank`, `rankDelta`; plus score fields from the entity (reuse M42 field set — no recomputation).
7. Not found → clear stderr message (`explain: no compare delta for <target>`); still exit `0` if compare succeeded (unless `--strict` fails independently).
8. Without `--baseline` / not in compare command → existing M42 scan explain unchanged.
9. `compare` command MUST gain `--explain` (parity with `scan --baseline`).

**Applies to:** HOTSPOT-828–833.

---

## Decision: `--strict` + `COMPARE_SINCE_MISMATCH` (LOCKED)

**Question:** How does `--strict` interact with M13 warn-and-continue on since mismatch?

**Choice:**

| Mode | Behavior |
| ---- | -------- |
| Default (no `--strict`) | Unchanged: warning on stderr + `meta.warnings`; compare proceeds; exit `0` on success |
| `--strict` | After successful compare + report write, if any `meta.warnings` entry has `code === "COMPARE_SINCE_MISMATCH"`, exit **`1`** (hard error) |

**Rules:**

1. CLI-only flag (not `.hotspot-scanner.json`). Available on `scan` and `compare`.
2. `compareScanResults` stays pure — still returns the warning; CLI / `executeCompareAndRender` enforces strict.
3. Report is still written (operators keep the artifact); stderr still shows the warning.
4. `--strict` does **not** promote other warning codes to hard errors (YAGNI).
5. Granularity mismatch remains throw/`CompareError` (unchanged).

**Applies to:** HOTSPOT-834–836.

---

## Decision: CLI / config surface (LOCKED)

| Flag | Config key? | Commands |
| ---- | ----------- | -------- |
| `--no-triage-hints` | No | `scan`, `compare` — now effective for compare triage |
| `--explain <target>` | No | `scan`, `compare` |
| `--strict` | No | `scan`, `compare` |

Help text: document that `--strict` fails on `COMPARE_SINCE_MISMATCH`; that compare triage is delta-aware; that `--explain` with baseline explains deltas.

---

## Explicitly out of scope

| Item | Reason |
| ---- | ------ |
| Absolute M41 rules on compare rankChanged rows | Misleading; use delta-aware rules only |
| Fail-on score / rank thresholds beyond since-mismatch | STATE: CI fail-on deferred; M12 removed |
| Explain coupling pairs | YAGNI |
| JSON schema / `version` bump | stderr + report text only |
| Changing `compareScanResults` warn emission | Keep M13 pure warn; strict at CLI |
| SARIF / harmonic formula / color policy changes | Unrelated |

---

## Supersedes / sister notes

| Prior lock | M53 action |
| ---------- | ---------- |
| M41 D4 “no compare triage” | **Override** — delta-aware triage ON by default |
| M13 “since mismatch = warning only” | Default preserved; `--strict` opt-in hard fail |
| M42 explain = ScanResult | Compare mode switches lookup to CompareResult |
| STATE “M53 will override M41…” | Satisfied by this feature |
