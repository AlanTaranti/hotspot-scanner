# Milestone 37 — README Adoption DX Specification

**Feature slug:** `readme-adoption-dx`  
**Milestone:** ROADMAP M37  
**Design SoT:** [PROJECT.md](../../project/PROJECT.md), [README.md](../../../README.md), [CONTRIBUTING.md](../../../CONTRIBUTING.md)  
**Depth:** Large (docs + versioned asset; thin `design.md`)  
**Sister pattern:** [product-docs-sync](../product-docs-sync/spec.md) (M25) — docs-only

## Problem Statement

The README is accurate enough for maintainers but weak for first-time adoption: a broken Markdown fence (~L322–323) truncates rendering; there is no early sample output or screenshot; install still shows `<repo-url>`; cover naming mixes package vs bin; internal milestone jargon (M26/M28/M32/RT-003) and “v1” wording leak into the user surface; advanced detail (workers, mega-commit, rename confidence) crowds the top. Tech leads scanning GitHub need a short problem→solution opening, TOC, workflows, privacy callout, honest limitations, and badges — without waiting on npm publish.

## Goals

- [ ] Fix the duplicate fence so all README sections render
- [ ] Restructure a **single** README: short top for adoption DX; Advanced (or deep linked sections) for detail
- [ ] Add real versioned CLI table asset under `docs/assets/` from fixture `small-ts`
- [ ] Replace `<repo-url>` with the real GitHub clone URL; keep clone + `pnpm install` + `pnpm build` as the official path
- [ ] Expand `package.json` `keywords` for discovery prep (no publish)
- [ ] No `src/` / `bin/` behavior changes

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Critical #1 — npm / npx / publish install path | Future backlog — depends on publish decision |
| Medium #13 — Quick start via `npx` / `pnpm dlx` | Depends on publish; deferred with #1 |
| Inventing an npm registry install story | Locked: clone URL only until publish phase |
| Rewriting CONTRIBUTING as the user README | CONTRIBUTING remains contribute SoT; README points |
| Splitting primary UX into many `docs/*.md` files | Default: single README restructure (see design) |
| Changing CLI / pipeline / warning `code` values | Docs + keywords only; stable codes stay |
| Implementing scanner features | Separate milestones |

---

## User Stories

### P1: Fix broken Markdown fence ⭐ MVP

**User Story**: As a GitHub reader, I want the README to render past the JSON example so that later sections (compare, limitations, license) are visible.

**Why P1**: Critical #3 — broken fence blocks adoption reading.

**Acceptance Criteria**:

1. WHEN README is rendered (GitHub or common Markdown preview) THEN there SHALL be no duplicate closing fence that empties/truncates following content (~current L322–323)
2. WHEN sections after the JSON example are opened THEN they SHALL render as normal Markdown (headings, tables, code blocks)
3. WHEN searching README for consecutive fence-only lines that close a block twice THEN zero such defects SHALL remain in edited regions

**Independent Test**: Open README preview; grep for ````\n```` adjacent closers around the large JSON sample.

**Requirements**: HOTSPOT-420

---

### P1: Official install via real GitHub clone URL ⭐ MVP

**User Story**: As a new user, I want copy-pasteable `git clone` instructions with the real repository URL so that I can install without guessing placeholders.

**Why P1**: Locked install story until publish; Critical #2 nuance.

**Acceptance Criteria**:

1. WHEN Installation (and any README clone snippet) is read THEN it SHALL use `https://github.com/taranti/hotspot-scanner.git` (or equivalent from `package.json` `repository.url`, not `<repo-url>`)
2. WHEN Installation is read THEN the official path SHALL remain `git clone` → `pnpm install` → `pnpm build` (no npm/npx as primary install)
3. WHEN CONTRIBUTING local setup still shows `<repo-url>` THEN it SHALL be updated to the same real URL (contribute SoT stays; URL must match)

**Independent Test**: `rg '<repo-url>' README.md CONTRIBUTING.md` → empty; `rg 'github.com/taranti/hotspot-scanner' README.md`.

**Requirements**: HOTSPOT-439

---

### P1: Opening — problem → solution ⭐ MVP

**User Story**: As a tech lead, I want the README opening to state the maintenance-prioritization problem and the local hotspot solution so that I know in seconds whether this tool fits.

**Why P1**: High #4; reuse PROJECT.md vision tone.

**Acceptance Criteria**:

1. WHEN the first screenful (before deep Features laundry) is read THEN it SHALL state the problem (prioritize refactoring / find hard-to-maintain TS/JS code and hidden co-change pairs) then the solution (local CLI combining complexity + churn + temporal coupling)
2. WHEN the opening is compared to PROJECT.md vision THEN tone SHALL match (tech-lead, no marketing fluff, no commercial SaaS pitch as primary identity)
3. WHEN the cover title/H1 area is read THEN package `@vitals/hotspot-scanner` vs bin `hotspot-scanner` SHALL be distinguished clearly (see HOTSPOT-425)

**Independent Test**: Manual read of first ~40 lines against PROJECT.md Goals/Vision.

**Requirements**: HOTSPOT-421

---

### P1: Sample CLI output early ⭐ MVP

**User Story**: As an evaluator, I want realistic CLI table output in the first ~60 lines so that I can see the product without building first.

**Why P1**: High #5.

**Acceptance Criteria**:

1. WHEN reading the first ~60 lines of README THEN a sample of CLI **table** output SHALL appear (from `tests/fixtures/repos/small-ts` scan, truncated if needed but recognizable as real output)
2. WHEN the sample is presented THEN it SHALL be clearly labeled as example/fixture output
3. WHEN capturing the sample THEN commands used SHALL be documentable (e.g. `pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts`)

**Independent Test**: Line-count check that sample appears before line ~60; content matches a real fixture run shape.

**Requirements**: HOTSPOT-422

---

### P1: Screenshot / GIF asset ⭐ MVP

**User Story**: As a visual evaluator, I want a real CLI table screenshot or short GIF in-repo so that GitHub shows the product without cloning.

**Why P1**: Medium #16; locked — versioned under `docs/assets/`.

**Acceptance Criteria**:

1. WHEN the repo is checked THEN `docs/assets/` SHALL exist with at least one versioned image/GIF of the CLI table (fixture `small-ts` preferred)
2. WHEN README early sections are read THEN they SHALL reference that asset (Markdown image) near the sample output / quick start
3. WHEN the asset is committed THEN it SHALL be real captured output (not a placeholder SVG saying “TODO”)

**Independent Test**: File exists under `docs/assets/`; README contains `docs/assets/` image link; visual smoke on GitHub/raw.

**Requirements**: HOTSPOT-432

---

### P1: Short top + Advanced detail ⭐ MVP

**User Story**: As a first-time reader, I want a short README top and advanced detail later (or clearly linked) so that I am not forced through workers/mega-commit/rename depth before trying the tool.

**Why P1**: High #6 + Medium #14.

**Acceptance Criteria**:

1. WHEN the default structure is applied THEN a **single** README SHALL carry adoption content near the top and move worker pool / mega-commit / rename-confidence depth into an **Advanced** section (or equivalent end section) — no mandatory multi-file `docs/*.md` split
2. WHEN “How it works” near the top is read THEN it SHALL be a slim pipeline summary (git → complexity → scoring → report)
3. WHEN Advanced is read THEN concurrency/workers, mega-commit guard, and rename-confidence detail MAY appear there without blocking the top

**Independent Test**: TOC + heading order review; top How-it-works ≤ short paragraph/bullets; Advanced contains former deep paragraphs.

**Requirements**: HOTSPOT-423, HOTSPOT-430

---

### P1: Remove internal jargon from user surface ⭐ MVP

**User Story**: As a package consumer, I want warnings and behavior described without internal milestone IDs so that docs do not require knowing M26/M28/M32/RT-003.

**Why P1**: High #7.

**Acceptance Criteria**:

1. WHEN searching user-facing README prose for `M26`, `M28`, `M32`, `RT-003` as explanatory labels THEN those SHALL be removed or rephrased (stable warning `code` values such as `MEGA_COMMIT_SKIPPED`, `RENAME_HISTORY_INCOMPLETE` SHALL remain)
2. WHEN Advanced still documents rename/mega-commit behavior THEN it SHALL use product language + `code` names, not “M28 + M32 warning codes” headings
3. WHEN CONTRIBUTING or `.specs/` still use milestone IDs THEN that is OK — only user-facing README surface is in scope for jargon purge

**Independent Test**: `rg -n 'M26|M28|M32|RT-003' README.md` → none (or only in historical links if explicitly allowed — prefer zero).

**Requirements**: HOTSPOT-424

---

### P1: Package vs bin name on cover ⭐ MVP

**User Story**: As a reader, I want clear naming — npm-scoped package `@vitals/hotspot-scanner` vs CLI bin `hotspot-scanner` — so that I know what to run after build.

**Why P1**: High #8.

**Acceptance Criteria**:

1. WHEN the cover / opening is read THEN both names SHALL appear with distinct roles (package vs command)
2. WHEN Quick start commands are shown THEN they SHALL invoke `hotspot-scanner` (via `pnpm exec` or built bin), not the scoped package name as the executable
3. WHEN badges or title conflict THEN H1/title SHALL not imply the scoped string is the shell command

**Independent Test**: Manual cover read + quick-start command lines.

**Requirements**: HOTSPOT-425

---

### P1: Positioning vs commercial / SaaS ⭐ MVP

**User Story**: As a tech lead comparing tools, I want a brief note that this is local TS/JS + churn + coupling (not a hosted SaaS) so that positioning is honest.

**Why P1**: High #9.

**Acceptance Criteria**:

1. WHEN early README (opening or adjacent callout) is read THEN it SHALL briefly position vs commercial/SaaS: runs 100% locally; focused on TS/JS complexity + Git churn + temporal coupling
2. WHEN positioning is written THEN it SHALL stay one short paragraph or bullets — no competitor name-calling list required

**Independent Test**: Grep/read opening for local / not SaaS / TS/JS positioning.

**Requirements**: HOTSPOT-426

---

### P1: TOC at top ⭐ MVP

**User Story**: As a skimmer, I want a table of contents near the top so that I can jump to install, CLI, advanced, and limitations.

**Why P1**: Medium #15.

**Acceptance Criteria**:

1. WHEN README opens THEN a TOC (Markdown links to major headings) SHALL appear near the top (after cover/badges/opening, before or with Quick start)
2. WHEN major sections exist (Install, Quick start, CLI, Configuration, Advanced, Limitations, Contributing, License, etc.) THEN TOC entries SHALL cover them without listing every subsection

**Independent Test**: TOC links resolve to existing headings.

**Requirements**: HOTSPOT-431

---

### P1: Docs-only + project gate ⭐ MVP

**User Story**: As a maintainer, I want adoption-DX changes limited to docs/keywords and a green project gate so that scanner behavior is untouched.

**Acceptance Criteria**:

1. WHEN the feature diff is reviewed THEN intentional edits SHALL be limited to README, `docs/assets/`, CONTRIBUTING (URL/dedupe), `package.json` keywords, and `.specs/project` prose as needed — **no** `src/` / `bin/` behavior changes
2. WHEN Execute finishes THEN `pnpm build && pnpm test` SHALL pass

**Independent Test**: `git diff` path filter + gate.

**Requirements**: HOTSPOT-440

---

### P2: Badges (no npm version)

**User Story**: As a GitHub visitor, I want license / Node / repo badges so that constraints are visible at a glance — without a fake npm version badge.

**Why P2**: Medium #10; publish deferred.

**Acceptance Criteria**:

1. WHEN README cover is read THEN badges SHALL include at least license, Node engine (22+), and repository/link-style badge as designed
2. WHEN badges are listed THEN there SHALL be **no** npm version / npm downloads badge while publish is deferred
3. WHEN Node badge is shown THEN it SHALL align with `engines.node` (`>=22`)

**Independent Test**: Visual/badge URLs; `rg 'npmjs|npm-version' README.md` → empty for version badge.

**Requirements**: HOTSPOT-427

---

### P2: Workflows “Use this when…”

**User Story**: As a tech lead, I want short workflow examples (weekly triage, baseline/compare, markdown in PR) so that I know when to run the tool.

**Why P2**: Medium #11.

**Acceptance Criteria**:

1. WHEN README early/mid adoption section is read THEN a “Use this when…” (or equivalent) block SHALL cover at least: weekly triage, baseline/compare over time, markdown report in a PR
2. WHEN each workflow is described THEN one concrete command or flag hint SHALL be included

**Independent Test**: Section present with three workflows.

**Requirements**: HOTSPOT-428

---

### P2: Privacy / 100% local callout

**User Story**: As a security-conscious lead, I want an explicit 100% local / no network callout so that I can trust the tool in private repos.

**Why P2**: Medium #12.

**Acceptance Criteria**:

1. WHEN early README is read THEN a privacy callout SHALL state analysis runs locally with no network requirement for scanning
2. WHEN the callout is written THEN it SHALL not contradict clone/install needing network to fetch the repo itself

**Independent Test**: Grep `local` / `network` / privacy near top.

**Requirements**: HOTSPOT-429

---

### P2: Programmatic API placement

**User Story**: As a library consumer, I want the programmatic `runScan` API documented after CLI/baseline flow (or linked from Advanced) so that CLI adopters are not interrupted mid-quick-start.

**Why P2**: Medium #17.

**Acceptance Criteria**:

1. WHEN README structure is finalized THEN Programmatic API SHALL appear after CLI + baseline/compare flow, **or** be linked from Advanced with a short stub at the end of the CLI path
2. WHEN the API section exists THEN it SHALL still show a minimal TypeScript import/`runScan` example (content accuracy preserved from current README)

**Independent Test**: Heading order / TOC position check.

**Requirements**: HOTSPOT-433

---

### P2: Essential flags early; full reference slim/at end

**User Story**: As a new user, I want a short essential-flags table early and a full flag reference slim or at the end so that I can start without reading every option.

**Why P2**: Low #20.

**Acceptance Criteria**:

1. WHEN Quick start / early CLI section is read THEN an essential-flags table SHALL list the common subset (at least: `--since`, `--format`, `--top`, `--baseline`, `--output`)
2. WHEN full CLI reference remains THEN it SHALL be at the end of the CLI area or under Advanced — not duplicated verbosely in two full tables (one essential + one full is OK; avoid three copies)

**Independent Test**: Two-tier flag presentation present; no triple full tables.

**Requirements**: HOTSPOT-436

---

### P3: Dedupe setup with CONTRIBUTING

**User Story**: As a contributor, I want README to point at CONTRIBUTING for contribute setup so that install/setup is not maintained twice in full.

**Why P3**: Low #18.

**Acceptance Criteria**:

1. WHEN README discusses contributing / deep local setup THEN it SHALL point to [CONTRIBUTING.md](../../../CONTRIBUTING.md) as SoT
2. WHEN README Installation remains THEN it MAY keep a minimal clone+build path for **users**; detailed contribute gate (`pnpm test`, lint, etc.) stays in CONTRIBUTING
3. WHEN both files show clone URL THEN URLs SHALL match (HOTSPOT-439)

**Independent Test**: README link to CONTRIBUTING; no full duplicate of CONTRIBUTING quality-gate section in README.

**Requirements**: HOTSPOT-434

---

### P3: Remove user-facing “v1” wording

**User Story**: As a reader, I want product docs without “v1” framing so that the tool does not sound unfinished or temporary.

**Why P3**: Low #19.

**Acceptance Criteria**:

1. WHEN searching README for user-facing “v1” product framing THEN such wording SHALL be removed or rephrased (e.g. “in v1” progress notes)
2. WHEN `.specs/` or STATE still say v1 in historical decisions THEN that is OK — README user surface only

**Independent Test**: `rg -ni '\\bv1\\b' README.md` reviewed; no leftover “in v1” product caveats.

**Requirements**: HOTSPOT-435

---

### P3: Expand package.json keywords

**User Story**: As a future npm consumer, I want richer `keywords` in package.json so that discovery is ready when publish happens.

**Why P3**: Low #21; no publish in M37.

**Acceptance Criteria**:

1. WHEN `package.json` `keywords` is read THEN it SHALL include additional discovery terms beyond the current four (e.g. temporal-coupling, cyclomatic-complexity, refactoring, typescript, cli — exact list per design)
2. WHEN keywords are expanded THEN no publish scripts or registry install docs SHALL be added in this milestone

**Independent Test**: Diff `package.json` keywords array length/content.

**Requirements**: HOTSPOT-437

---

### P3: Honest Limitations section

**User Story**: As an evaluator, I want an honest Limitations section so that I do not expect multi-language support, line-based churn, or older Node.

**Why P3**: Low #22.

**Acceptance Criteria**:

1. WHEN Limitations is read THEN it SHALL state at least: TS/JS only; churn is commit-count based (not relative LOC churn); Node 22+; git required at scan time
2. WHEN Limitations is placed THEN it SHALL be easy to find via TOC (near end is fine)

**Independent Test**: Section present with four constraints.

**Requirements**: HOTSPOT-438

---

## Edge Cases

- WHEN regenerating sample output / screenshot THEN prefer fixture `tests/fixtures/repos/small-ts` for stable, short output
- WHEN badge services are briefly unavailable THEN keep static Markdown badge URLs; do not block on live shield fetch in CI
- WHEN Advanced absorbs rename/mega-commit detail THEN keep stable `code` values identical to JSON `meta.warnings`
- WHEN a future publish milestone lands THEN install/#13 stories are separate backlog — do not leave half-npx docs in M37
- WHEN single-README default conflicts with length THEN prefer one README with Advanced over creating `docs/guide.md` unless Execute finds unreadable length (design default: single file)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| HOTSPOT-420 | P1: Fix broken Markdown fence | Tasks | In Tasks |
| HOTSPOT-421 | P1: Opening — problem → solution | Tasks | In Tasks |
| HOTSPOT-422 | P1: Sample CLI output early | Tasks | In Tasks |
| HOTSPOT-423 | P1: Short top + Advanced detail | Tasks | In Tasks |
| HOTSPOT-424 | P1: Remove internal jargon | Tasks | In Tasks |
| HOTSPOT-425 | P1: Package vs bin name | Tasks | In Tasks |
| HOTSPOT-426 | P1: Positioning vs SaaS | Tasks | In Tasks |
| HOTSPOT-427 | P2: Badges (no npm version) | Tasks | In Tasks |
| HOTSPOT-428 | P2: Workflows | Tasks | In Tasks |
| HOTSPOT-429 | P2: Privacy callout | Tasks | In Tasks |
| HOTSPOT-430 | P1: Slim How it works | Tasks | In Tasks |
| HOTSPOT-431 | P1: TOC at top | Tasks | In Tasks |
| HOTSPOT-432 | P1: Screenshot asset | Tasks | In Tasks |
| HOTSPOT-433 | P2: Programmatic API placement | Tasks | In Tasks |
| HOTSPOT-434 | P3: Dedupe setup CONTRIBUTING | Tasks | In Tasks |
| HOTSPOT-435 | P3: Remove “v1” wording | Tasks | In Tasks |
| HOTSPOT-436 | P2: Essential flags early | Tasks | In Tasks |
| HOTSPOT-437 | P3: Expand keywords | Tasks | In Tasks |
| HOTSPOT-438 | P3: Limitations section | Tasks | In Tasks |
| HOTSPOT-439 | P1: Real GitHub clone URL | Tasks | In Tasks |
| HOTSPOT-440 | P1: Docs-only + project gate | Tasks | In Tasks |

**ID range used:** HOTSPOT-420–HOTSPOT-440 (HOTSPOT-414–419 remain unused from M36 gap)

**Coverage:** 21 total, 21 mapped to tasks, 0 unmapped

**Review-item map:** #3→420, #4→421, #5→422, #6→423, #7→424, #8→425, #9→426, #10→427, #11→428, #12→429, #14→430, #15→431, #16→432, #17→433, #18→434, #19→435, #20→436, #21→437, #22→438; install URL→439; gate→440. Out of scope: #1, #13.

---

## Success Criteria

- [ ] README renders fully on GitHub (no fence truncation)
- [ ] First ~60 lines convey problem, solution, sample output, and asset
- [ ] Clone URL is real; no npm primary install; no npm version badge
- [ ] User-facing jargon (M26/M28/M32/RT-003) and “v1” framing removed from README
- [ ] `docs/assets/` holds a real CLI table capture
- [ ] `pnpm build && pnpm test` green after Execute
