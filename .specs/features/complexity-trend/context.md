# Milestone 72 — Complexity Trend Context

**Feature slug:** `complexity-trend`  
**Milestone:** ROADMAP M72  
**Depth:** Complex  
**Requirement IDs:** HOTSPOT-1400–1499 (unused IDs in band reserved)  
**Status:** Locked (planning) — all decisions **Confirmed**; do not re-open  
**Inspiration:** Adam Tornhill — indentation / whitespace complexity trends (HGH08 proxy); no AST  
**Sisters:** [ncloc-metric](../ncloc-metric/spec.md) (M57), [explain-and-scan-feedback](../explain-and-scan-feedback/spec.md) (M42), [cli-surface-polish](../cli-surface-polish/spec.md) (M38), [remove-compare-baseline](../remove-compare-baseline/spec.md) (M71 — do **not** reopen compare)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md)

---

## Intent

Add a **dedicated CLI command** that, given a filepath, walks that file’s Git history and emits a **complexity vs size** time series using **indentation complexity** (language-agnostic whitespace proxy) plus **NCLOC**, so maintainers can tell whether a hotspot is deteriorating, stable, or was refactored — without changing the scan pipeline or JSON `3.0` contract.

```text
scan  → which files are hotspots now?     (snapshot)
trend → how is this one file evolving?    (time series)
```

Terminal UX includes **ASCII sparklines** for `mean` and `ncloc` in table/JSON; CSV remains plot-ready row data (no embedded chart library).

---

## Decision: Milestone / slug / depth / IDs (LOCKED)

| Field | Value |
| ----- | ----- |
| Milestone | **M72** |
| Slug | `complexity-trend` |
| Depth | **Complex** |
| IDs | **HOTSPOT-1400–1499** (next free band after M71 HOTSPOT-1300+) |

**Status:** **Confirmed** — do not re-open

---

## Decision: CLI grammar (LOCKED)

| Field | Value |
| ----- | ----- |
| Command | `hotspot-scanner trend <file>` |
| Repo | Defaults to cwd / git root discovered from the file; optional `--repo <path>` |
| Positional | Required `<file>` (not a directory); directory → exit `2` |
| `--file` alias | **Out of scope** (YAGNI) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Time range (LOCKED)

| Mode | Flags | Notes |
| ---- | ----- | ----- |
| Casual | `--since <period>` | Default = `DEFAULT_SINCE` (`"12 months ago"`) from scan |
| Forensic | `--start <rev>` **and** `--end <rev>` | Both required together |
| Conflict | Mixing `--since` with `--start`/`--end`, or only one of start/end | Exit `2` (`CliUsageError`) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Metrics per revision (LOCKED)

| Metric | Definition |
| ------ | ---------- |
| Indentation | `{ n, total, mean, sd, max }` — Tornhill-style whitespace analysis |
| Indent rule | **4 spaces = 1 logical level**; **1 tab = 1 level**; blank/whitespace-only lines **ignored** |
| Size | Always compute **`ncloc`** via existing `countNcloc()` on the same source blob |
| McCabe / AST | **Forbidden** — aligns with M57 |

**Status:** **Confirmed** — do not re-open

---

## Decision: Git follow + sampling (LOCKED)

| Field | Value |
| ----- | ----- |
| Rename follow | **On by default** (`git log --follow`); `--no-follow` opt-out |
| Output order | Chronological **ascending** (oldest → newest) |
| Default cap | `--max-revisions` default **100** |
| Sampling | When truncating: **uniform** sample across the revision list |
| Unlimited | `--all` disables the cap |
| Truncation UX | Stderr note: `N of M revisions (uniform sample); pass --all for full history` |
| Per-rev content | `git show <rev>:<pathAtRev>` — path may change under `--follow` |
| Single `show` failure | Skip point + warning; do not abort the whole trend |

**Status:** **Confirmed** — do not re-open

---

## Decision: Config interaction (LOCKED)

| Field | Value |
| ----- | ----- |
| `.hotspot-scanner.json` | **Not read** by `trend` (CLI-only) |
| Default since | Same constant `DEFAULT_SINCE` as scan (not loaded from config file) |
| Rationale | Scan `since` optimizes recent churn; trends often need longer arcs — silent inherit is bad UX |

**Status:** **Confirmed** — do not re-open

---

## Decision: Formats and library (LOCKED)

| Field | Value |
| ----- | ----- |
| Formats | `table` \| `json` \| `csv` only (no markdown MVP) |
| Embedded charts | **No** (Excel/Observable via CSV) |
| `-o` / `--output` | Optional write; stdout default for all three formats |
| CSV vs scan | Single file (not M18 multi-file bundle); `-o` **not** required for csv |
| Public API | Export `runComplexityTrend` + result/options types from `src/index.ts` |
| Scan JSON `3.0` | **Unchanged** — trend uses separate contract `version: "1.0"`, `kind: "complexity-trend"` |

**Status:** **Confirmed** — do not re-open

---

## Decision: Sparkline ASCII (LOCKED)

| Field | Value |
| ----- | ----- |
| Glyphs | `▁▂▃▄▅▆▇█` (8 levels) |
| Scale | Min–max over the series; **constant** series → mid-level bar; **empty** → `""` |
| Series | Post-sample chronological points: **`mean`** and **`ncloc`** |
| table | Print both sparkline lines under the header, before revision rows |
| json | `meta.sparklines: { mean: string, ncloc: string }` |
| csv | **No** sparkline column (row data only) |

**Status:** **Confirmed** — do not re-open

---

## Decision: Exit codes (LOCKED)

| Case | Exit |
| ---- | ---- |
| Success (including empty series with warning) | `0` |
| Usage / invalid flag combo / file is directory / never in range | `2` |
| SIGINT | `130` |
| SIGTERM | `143` |

**Status:** **Confirmed** — do not re-open

---

## Out of scope (LOCKED)

| Item | Reason |
| ---- | ------ |
| `--classify` (deteriorating/refactored/stable) | YAGNI; glossary/docs only |
| `git cat-file --batch` | Perf phase 2 |
| `--explain` auto-hint to `trend` | Nice-to-have later |
| Changing scan pipeline / `hotspotScore` / NCLOC definition | Orthogonal |
| Reintroducing compare/baseline | M71 stands |
| McCabe / ts-morph / historical AST | M57 + deferred |
| Markdown format / plot libraries | YAGNI |
| Reading config `since` / new config keys | Locked CLI-only |
| Repo-wide historical trend inside `scan` | Cost / contract |

**Status:** **Confirmed** — do not re-open

---

## Planning notes (non-blocking)

- Trend **intentionally** reads historical blobs — CONCERNS “working-tree source only” becomes a **scan-pipeline** constraint, not a product-wide ban.
- Document Prettier / mass-indent mid-history as a false cliff (book pitfall).
- Completions: add `trend` + flags to bash/zsh/fish with parity tests (M54 pattern).
