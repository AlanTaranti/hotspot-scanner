# Milestone 38 — CLI Surface Polish Context

**Spec**: [`.specs/features/cli-surface-polish/spec.md`](./spec.md)  
**Status**: Planned (planning session)  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M38 + planner lock (user query)

All gray areas for M38 are closed below. No open `PENDENTE-DISCUSSÃO`.

---

## Decision: Default scan path = `.` (LOCKED)

**Question:** What happens when `<path>` is omitted?

**Choice:** Optional argument defaults to `.`. Still require `repoPath/.git` (existing `validateGitRepository` in `runScan`). Explicit path unchanged.

**Rationale:** Matches common CLI ergonomics; ROADMAP M38; monorepo package-without-`.git` heuristics are M43.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-450, HOTSPOT-451

---

## Decision: `--version` / `-V` from package.json (LOCKED)

**Question:** Where does version come from?

**Choice:** Root `package.json` `"version"` field, wired via commander `program.version(..., "-V, --version")`. Read at CLI setup time (stable relative to compiled bin / source layout — implementer picks `createRequire` or `readFileSync` from package root; must work for `dist/bin` and tests).

**Rationale:** Single source of truth; no hard-coded string in bin.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-452

---

## Decision: Ship `--quiet` + `--no-progress`; omit `--verbose` (LOCKED)

**Question:** Is `--verbose` clearly useful beyond default?

**Choice:** **Omit `--verbose` in M38.** Ship only:

| Flag            | Effect                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `--no-progress` | Suppress progress stderr lines only                                                                    |
| `--quiet`       | Suppress progress **and** `severity: "info"` warnings; keep `warning` / `error` + report + hard errors |

Default (neither flag) = pre-M38 behavior (throttled progress + all warning severities).

**Rationale:** Default already emits progress + warnings. Extra verbose dump (debug AST/git internals) is YAGNI and overlaps M42. ROADMAP stub wording refined to drop `--verbose`.

**Quiet ⊇ no-progress:** Both flags together ≡ `--quiet`.

**No config keys** for quiet/progress.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-453, HOTSPOT-454; ROADMAP M38 checkbox

---

## Decision: Error hints at presentation / throw enrichment (LOCKED)

**Question:** Where do next-step hints live?

**Choice:** Enrich user-facing messages for the four locked families without changing exit-code mapping. Prefer:

1. Update `CliUsageError` strings at existing throw sites in `bin/` (csv, baseline path validation)
2. Enrich `ConfigError` message for explicit missing `--config` in `src/config/` **or** wrap in bin when catching — prefer keeping message improvement at `ConfigError` throw for `Config file not found` so programmatic API benefits
3. Non-git: enrich message from `validateGitRepository` in `src/scan.ts` **or** map in bin `main` catch by recognizing the known prefix — prefer enriching `validateGitRepository` throw text with a second-line hint so all callers get it
4. Invalid baseline content: append hint when presenting `BaselineError` (bin catch or `loadBaseline` messages) — do not weaken validation

Hint tone: short actionable English, e.g. `Hint: …` or `Next: …` on a following line. Do not change JSON report payloads.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-455–458

---

## Decision: Help examples via commander `addHelpText` (LOCKED)

**Question:** How to embed examples?

**Choice:** `scan` command `.addHelpText("after", …)` with 3–5 copy-pasteable examples (cwd default, JSON+output, aliases, baseline). No separate man page.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-459

---

## Decision: Short aliases (LOCKED)

| Short | Long            |
| ----- | --------------- |
| `-f`  | `--format`      |
| `-o`  | `--output`      |
| `-t`  | `--top`         |
| `-g`  | `--granularity` |

Long flags remain. Document in help + README. No other short aliases in M38 (e.g. no `-c` for concurrency — avoids collision with future `--config` short form; `--config` stays long-only).

**Status:** **Confirmed**

**Applies to:** HOTSPOT-460

---

## Decision: Module ownership (LOCKED)

**Primary:** `bin/hotspot-scanner.ts` (+ `bin/*.test.ts`).  
**Secondary (allowed):** `src/diagnostics/` only if quiet/no-progress needs a small sink helper; `src/scan.ts` / `src/config/` only for hint text on existing throws.  
**Forbidden:** ranking, report renderers, schemas, new config keys.

**Status:** **Confirmed**

---

## Related closed decisions (do not reopen)

| Decision                 | Value                           | Relevance                                 |
| ------------------------ | ------------------------------- | ----------------------------------------- |
| Exit codes               | 0 / 2 (usage+config) / 1 (else) | Preserve                                  |
| CSV requires `--output`  | M18                             | Hint only                                 |
| Config discovery miss    | null, not error (M30)           | Only explicit `--config` missing is error |
| M43 monorepo path detect | Separate milestone              | No cwd package heuristic                  |
| npm publish              | Deferred                        | Out of scope                              |
