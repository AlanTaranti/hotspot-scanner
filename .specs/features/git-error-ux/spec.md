# Milestone 65 — Git Error UX Specification

**Feature slug:** `git-error-ux`  
**Milestone:** M65  
**Priority:** High  
**Status:** Specs Planned  
**Depth:** Medium  
**IDs:** HOTSPOT-1140–1159 (1151–1159 reserved)  
**Design SoT:** [ARCHITECTURE.md](../../codebase/ARCHITECTURE.md), [INTEGRATIONS.md](../../codebase/INTEGRATIONS.md), [TESTING.md](../../codebase/TESTING.md)  
**Artifacts:** [context.md](./context.md) · [design.md](./design.md) · [tasks.md](./tasks.md)

---

## Problem Statement

When `git log` (or related git spawn) fails at scan time, operators see raw stderr wrapped as `git log failed for repo …` with no next step. Invalid `--since` strings, shallow clones, and corrupt object stores are common and actionable — but unlike M38 `CliUsageError` / `ConfigError` / not-a-git paths, runtime `GitLogError` has no `Hint:` line. Doctor since preflight (M64) catches some bad `since` values early; scan-time failures still need the same hint tone.

## Goals

- [ ] Map high-value git stderr families to actionable `Hint:` lines on `GitLogError` (and shared helper for `GitLsFilesError`)
- [ ] Cover invalid `--since` / date parse, detectable shallow clone, and cheap corrupt-repo patterns
- [ ] Keep enrichment in `src/git/`; CLI only prints `error.message`
- [ ] Do not duplicate not-a-git (resolve-repo) or doctor since probe (M64)
- [ ] `pnpm build && pnpm test` green after Execute

## Out of Scope

| Feature                                                   | Reason                                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Doctor `since` probe / finding / CLI                      | M64 config-doctor-dx sister — do not duplicate       |
| Re-implement not-a-git Hint                               | Already on `resolve-repo` / M38                      |
| Soft warnings for empty-but-valid `--since` windows       | Existing rename/empty-window warnings; not hard fail |
| New CLI flags, config keys, JSON schema / ranking changes | YAGNI                                                |
| Changing exit-code scheme (`GitLogError` → still 1)       | Preserve pipeline-failure semantics                  |
| Bin-side git stderr parsers                               | Domain stays in `src/git/`                           |
| Proactive `.git/shallow` file checks without stderr       | Detect from stderr only when cheap                   |
| Exhaustive git error encyclopedia                         | Three locked families + unmatched passthrough        |

---

## User Stories

### P1: Invalid since / date parse Hint ⭐ MVP

**User Story:** As an operator who mistypes `--since` or config `since`, I want a `Hint:` telling me how to fix the date window when git rejects the string at scan time.

**Why P1:** Highest-frequency actionable `git log` failure; complements M64 doctor preflight for users who skip doctor.

**Acceptance Criteria:**

1. WHEN `git log` exits non-zero and stderr indicates an invalid date / since parse THEN `GitLogError.message` SHALL include a newline `Hint:` directing the user to fix `--since` or config `since` (relative window or ISO date) per [context.md](./context.md)
2. WHEN such a failure occurs THEN the original stderr substance SHALL remain in the primary message (hint is additive)
3. WHEN doctor since preflight is absent or skipped THEN scan-time Hint behavior SHALL still apply (no dependency on M64 being Implemented)

**Independent Test:** Unit — construct / throw `GitLogError` (or stream mock) with synthetic stderr containing `invalid date format`; assert `Hint:` substring.

**Requirements:** HOTSPOT-1141, HOTSPOT-1145

---

### P1: Shallow clone Hint ⭐ MVP

**User Story:** As an operator scanning a shallow clone that causes git to fail with a shallow-related stderr, I want a `Hint:` to deepen or re-clone with full history.

**Why P1:** Common CI / `git clone --depth` footgun; detectable when stderr mentions shallow.

**Acceptance Criteria:**

1. WHEN git exits non-zero and stderr indicates a shallow-clone limitation (case-insensitive `shallow`) THEN `GitLogError.message` SHALL include a `Hint:` to deepen (`git fetch --unshallow`) or re-clone without depth limits
2. WHEN stderr does not mention shallow THEN the system SHALL NOT emit the shallow Hint
3. WHEN a successful (exit 0) mine returns fewer commits due to shallow history THEN the system SHALL NOT invent a hard-fail Hint (success path unchanged)

**Independent Test:** Unit — synthetic stderr with `shallow`; assert Hint; control case without `shallow`.

**Requirements:** HOTSPOT-1142

---

### P1: Corrupt / bad-object Hint ⭐ MVP

**User Story:** As an operator whose repo object store is damaged, I want a short `Hint:` pointing at `git fsck` / re-clone instead of only opaque `bad object` text.

**Why P1:** Cheap high-value pattern; avoids support dead-ends.

**Acceptance Criteria:**

1. WHEN stderr matches locked corrupt/bad-object cues ([context.md](./context.md)) THEN `GitLogError.message` SHALL include a `Hint:` mentioning repair (`git fsck`) or re-clone
2. WHEN multiple families could match THEN the locked priority (since/date → shallow → corrupt) SHALL pick **one** Hint
3. WHEN stderr is empty or unmatched THEN message SHALL keep today’s shape with **no** `Hint:` line

**Independent Test:** Unit — corrupt stderr → Hint; empty stderr → no Hint / unknown error path preserved.

**Requirements:** HOTSPOT-1143, HOTSPOT-1144

---

### P1: Domain ownership + exit stability ⭐ MVP

**User Story:** As a library/CLI consumer, I want git failure hints on the error object without bin special-casing, and without exit-code changes.

**Why P1:** INTEGRATIONS + M38 parity; avoid drift between CLI and `runScan`.

**Acceptance Criteria:**

1. WHEN `GitLogError` is thrown from numstat `streamGitLog` or any other `new GitLogError(...)` site THEN enrichment SHALL happen in the constructor / shared helper under `src/git/`
2. WHEN the CLI catches a fatal scan error THEN it SHALL print `error.message` only (no new git-pattern switch in `bin/`)
3. WHEN `GitLogError` or `GitLsFilesError` causes process exit THEN exit code SHALL remain **1**
4. WHEN `GitLsFilesError` is constructed with matching stderr THEN it SHALL use the same hint helper for the three families

**Independent Test:** Unit on constructors / helper; existing bin exit mapping untouched (no requirement to add bin tests if message already printed).

**Requirements:** HOTSPOT-1140, HOTSPOT-1146, HOTSPOT-1147

---

### P1: Sister boundaries ⭐ MVP

**User Story:** As a maintainer, I want M65 not to reimplement not-a-git or doctor since preflight.

**Why P1:** Explicit mission constraint; prevents path conflict with M38/M64.

**Acceptance Criteria:**

1. WHEN planning/implementing M65 THEN the feature SHALL NOT add or rewrite the resolve-repo not-a-git Hint path as a primary deliverable
2. WHEN implementing M65 THEN the feature SHALL NOT add `probeSinceWindow` / doctor `since` finding / doctor CLI flags
3. WHEN docs mention sisters THEN they SHALL cite M38 hint tone and M64 doctor since as non-overlapping

**Independent Test:** Spec/design review + Execute path check (no new doctor/probe files in this feature’s tasks).

**Requirements:** HOTSPOT-1148, HOTSPOT-1149

---

### P2: Living documentation

**User Story:** As an agent/developer, I want ARCHITECTURE / INTEGRATIONS (and STRUCTURE if a new helper file appears) to mention git stderr → Hint enrichment.

**Why P2:** Living-doc rule after significant CLI/domain DX change.

**Acceptance Criteria:**

1. WHEN Execute completes THEN `.specs/codebase/` SHALL describe the hint helper and that CLI prints messages only
2. WHEN INTEGRATIONS is updated THEN git spawn ownership SHALL still forbid ad-hoc git stderr parsing outside `src/git/`

**Independent Test:** Doc review in docs task.

**Requirements:** HOTSPOT-1150

---

## Edge Cases

- WHEN stderr matches both date and shallow cues THEN since/date Hint wins (priority order)
- WHEN AbortError / signal abort ends the spawn THEN no Hint enrichment (abort path unchanged)
- WHEN function-churn (or other) code constructs `GitLogError` THEN it inherits constructor enrichment automatically
- WHEN unmatched fatal git stderr is long THEN message still includes trimmed stderr; no Hint truncation of stderr itself beyond existing trim
- WHEN `GitLogError` somehow surfaces `not a git repository` THEN no **new** dedicated not-a-git pattern is required (resolve-repo remains SoT)

---

## Requirement Traceability

| Requirement ID    | Story                               | Phase | Status   |
| ----------------- | ----------------------------------- | ----- | -------- |
| HOTSPOT-1140      | P1: Domain ownership                | Tasks | Pending  |
| HOTSPOT-1141      | P1: Invalid since / date            | Tasks | Pending  |
| HOTSPOT-1142      | P1: Shallow clone                   | Tasks | Pending  |
| HOTSPOT-1143      | P1: Corrupt / bad-object            | Tasks | Pending  |
| HOTSPOT-1144      | P1: Unmatched passthrough           | Tasks | Pending  |
| HOTSPOT-1145      | P1: Domain / CLI print              | Tasks | Pending  |
| HOTSPOT-1146      | P1: Exit code 1                     | Tasks | Pending  |
| HOTSPOT-1147      | P1: Shared helper + GitLsFilesError | Tasks | Pending  |
| HOTSPOT-1148      | P1: No not-a-git duplicate          | Tasks | Pending  |
| HOTSPOT-1149      | P1: No doctor since duplicate       | Tasks | Pending  |
| HOTSPOT-1150      | P2: Living docs                     | Tasks | Pending  |
| HOTSPOT-1151–1159 | —                                   | —     | Reserved |

**Coverage:** 11 mapped + 9 reserved; all P1/P2 mapped to tasks.

---

## Success Criteria

- [ ] Synthetic unit tests cover since/date, shallow, corrupt, unmatched, and priority order
- [ ] `GitLogError` / `GitLsFilesError` messages include `Hint:` only for locked families
- [ ] No bin git-stderr switch; no doctor probe files in this feature
- [ ] Exit code for git spawn failures remains 1
- [ ] Full gate `pnpm build && pnpm test` passes after Execute
