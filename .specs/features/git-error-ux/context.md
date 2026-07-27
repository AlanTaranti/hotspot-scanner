# Milestone 65 — Git Error UX Context

**Spec**: [`.specs/features/git-error-ux/spec.md`](./spec.md)  
**Status**: Planned (planning session)  
**Captured:** 2026-07-26  
**Trigger:** User mission — Milestone 65 Git error UX (Medium); IDs HOTSPOT-1140–1159

All gray areas for M65 are closed below. No open `PENDING-DISCUSSION`.

---

## Decision: Enrich at GitLogError (domain), CLI prints only (LOCKED)

**Question:** Where do `Hint:` lines for git subprocess failures live?

**Choice:** Enrich `GitLogError.message` (and optionally `GitLsFilesError.message` via the same helper) inside `src/git/` when constructing the error from stderr. `bin/hotspot-scanner.ts` continues to `console.error(error.message)` with **no** git-specific catch mapping.

**Rationale:** Parity with M38 guided errors (`Hint:` on throw sites / domain messages). Keeps INTEGRATIONS ownership: git stderr interpretation stays in `src/git/`. Programmatic `runScan` callers get the same hints.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-1140, HOTSPOT-1145, HOTSPOT-1147

---

## Decision: Pattern table — since/date, shallow, corrupt (LOCKED)

**Question:** Which stderr families get hints?

| Family | Detect (case-insensitive substrings / cheap regex on stderr) | Hint tone (locked intent) |
| ------ | ------------------------------------------------------------ | ------------------------- |
| Invalid `--since` / date | `invalid date`, `not a valid date`, `bad date` (and close git phrasing) | Fix `--since` / config `since` — relative window (e.g. `12 months ago`) or ISO `YYYY-MM-DD` |
| Shallow clone | stderr contains `shallow` (git shallow limitation / object missing due to shallow) | Deepen or full clone — e.g. `git fetch --unshallow` / re-clone without `--depth` |
| Corrupt / bad objects | `corrupt`, `bad object`, `loose object`, `object file` + empty/corrupt cues | `git fsck` / repair or re-clone |

**First match wins** — order: **since/date → shallow → corrupt**. Unmatched stderr: keep today’s message shape (`git log failed for repo …: <stderr|unknown error>`) with **no** `Hint:` line.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-1141, HOTSPOT-1142, HOTSPOT-1143, HOTSPOT-1144

---

## Decision: Do not duplicate not-a-git or doctor since (LOCKED)

| Sister / existing | M65 does | M65 does not |
| ----------------- | -------- | ------------ |
| M38 guided errors | Same `Hint:` tone and newline presentation | Re-touch CliUsageError / ConfigError / baseline families |
| `resolve-repo` / not-a-git | Leave existing Hint on non-repo path | Add a dedicated not-a-git pattern as a deliverable (already handled before mine) |
| M64 config-doctor-dx since preflight | Runtime `GitLogError` when scan still hits git-rejected since | Implement `probeSinceWindow`, doctor finding `since`, or doctor CLI changes |

Empty `--since` windows that **succeed** with exit 0 remain M26/M64 warn territory — **not** GitLogError hints.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-1148, HOTSPOT-1149

---

## Decision: GitLsFilesError shares helper (LOCKED)

**Choice:** Reuse the same `formatGitStderrHint(stderr)` (name flexible) when building `GitLsFilesError` messages for the three families above. Do not invent ls-files-only patterns in this milestone.

**Rationale:** Cheap parity; discovery failures can surface corrupt/shallow the same way. Still YAGNI for not-a-git duplication.

**Status:** **Confirmed**

**Applies to:** HOTSPOT-1147

---

## Decision: Exit codes and surface unchanged (LOCKED)

| Item | Lock |
| ---- | ---- |
| Exit on `GitLogError` / `GitLsFilesError` | Still **1** (pipeline failure), not 2 |
| New CLI flags / config keys / schema | **None** |
| JSON report / rankings / spawn argv | Unchanged |
| AbortError / SIGINT paths | Unchanged (no Hint injection) |

**Status:** **Confirmed**

**Applies to:** HOTSPOT-1146

---

## Decision: Module ownership (LOCKED)

**Primary:** `src/git/` — hint helper + `GitLogError` / `GitLsFilesError` constructors (`spawn.ts`, `ls-files.ts`; function-churn spawn benefits automatically if it uses `GitLogError`).  
**Secondary:** Living docs under `.specs/codebase/` (+ README only if git errors are mentioned).  
**Forbidden:** Doctor probe implementation; ranking/report/schema; bin git-stderr parsers.

**Status:** **Confirmed**

---

## Open questions

None — scope locked by mission + sisters.
