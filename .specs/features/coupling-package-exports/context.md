# Milestone 44 — Coupling Package Exports Context

**Feature slug:** `coupling-package-exports`  
**Captured:** 2026-07-24  
**Trigger:** ROADMAP M44; closes CONCERNS unmitigated gap for `package.json` `exports` / `imports`  
**Depth:** Complex  
**Sister:** [coupling-enrichment (M27)](../coupling-enrichment/context.md), [static-enrich-cache (M33)](../static-enrich-cache/design.md)

---

## Feature Boundary

Extend static coupling enrichment so that Node/TS `package.json` **`exports`** and **`imports`** resolve to in-repo peer files when labeling `hasStaticDependency` / direction / kind flags. Ranking (`couplingStrength`, order) stays unchanged. Prefer **workspace / in-repo** `package.json` resolution; do **not** implement full npm/`node_modules` resolution. Keep M33 peer-scoped graph cache — extend resolution helpers, do not reintroduce per-pair source re-reads.

---

## Implementation Decisions

### Scope: in-repo packages only (locked)

- Resolve `exports` / `imports` / package `name` only for `package.json` files discovered **under `repoPath`**.
- **Peer-scoped package index:** for each unique coupling peer path, walk up to `repoPath` for the nearest `package.json`; cache by absolute package directory and by `"name"` when present.
- **Out of scope / miss:** bare or scoped package names that only resolve via `node_modules` (external deps) → no edge (same as today’s bare-npm miss after tsconfig paths fail).
- Do not traverse or read `node_modules/**` for resolution.

**Applies to:** HOTSPOT-595, HOTSPOT-596, HOTSPOT-599.

### Resolution order (locked)

For each static specifier in `buildStaticEdgeGraph` / `resolutionBases`:

1. **Relative** (`./` / `../`) — existing M14 candidates  
2. **Tsconfig / jsconfig** `paths` / `baseUrl` — existing M27 `TsconfigPathMap`  
3. **Package `imports`** — if specifier starts with `#`, resolve against the **importer’s** nearest `package.json` `"imports"`  
4. **Package `exports` / workspace name** — if specifier is non-relative and not `#`:
   - If it matches a peer-indexed package `"name"` or `name/subpath`, resolve via that package’s `"exports"` (or `"main"` fallback)
   - Self-package references (importer’s own `"name"`) are in scope when the target lands on a peer

First existing candidate that equals the peer path wins (same match rule as M14/M27). Empty candidates → miss.

**Applies to:** HOTSPOT-593, HOTSPOT-594, HOTSPOT-595, HOTSPOT-596.

### `exports` / `imports` shape support (locked)

| Supported | Behavior |
| --------- | -------- |
| String `exports` / `main` | Treat as `"."` entry target |
| Object `exports` keys | Exact subpath (`.`, `./foo`) and single-`*` patterns (`./features/*`) |
| Conditional objects | Expand targets under conditions listed below |
| Array targets | Try each element in order |
| `imports` keys | Must start with `#`; exact and single-`*` patterns |

| Explicitly out of scope | Reason |
| ----------------------- | ------ |
| Full Node ESM_RESOLVE / PACKAGE_EXPORTS_RESOLVE parity | YAGNI — couple peers only |
| `node_modules` package lookup | Locked boundary |
| Source↔dist inventing (map `dist/*.js` → `src/*.ts`) | Extension/index candidates only; document residual false negatives |
| Multiple `*` wildcards / regex patterns | Match M27 single-`*` rule |
| `exports` blocking semantics for non-listed subpaths beyond miss | Miss is enough for labeling |

**Applies to:** HOTSPOT-597, HOTSPOT-610, HOTSPOT-612.

### Conditional exports conditions (locked)

When expanding a condition map, collect string targets from:

- `"default"` (always eligible)
- `"import"` and `"require"` (both — enrichment is not a real loader; either may point at the on-disk peer)
- `"types"` (helps type-only edges when `"types"` points at a peer `.ts`/`.d.ts` path that matches after candidates)
- `"node"` when nested under those

Ignore environment-only keys (`browser`, `development`, `production`, custom) unless they nest under an eligible branch that also yields `"default"` / `"import"` / `"require"` / `"types"`. Prefer **union of candidate targets** over picking a single Node-winning condition — goal is peer match, not runtime load.

**Applies to:** HOTSPOT-597, HOTSPOT-606.

### `"main"` fallback (locked)

When `"exports"` is absent/undefined, resolve package entry (specifier equals package name / `"."`) via `"main"` if present; else try `index` candidates under the package root (reuse `buildResolutionCandidates` patterns). When `"exports"` is present, do **not** fall back to arbitrary files outside the exports map (miss if no export match).

**Applies to:** HOTSPOT-610.

### M33 peer-scoped cache (locked)

- Keep `buildStaticEdgeGraph`: one source read/parse per unique peer path; O(1) pair labeling.
- Add `PackageExportsMap` (name flexible) with per-enrich-call caches:
  - package.json path → parsed scope (`name`, `exports`, `imports`, `main`)
  - peer path → owning package directory
  - package `name` → package directory (from peers only)
- Do **not** re-read package.json per pair or per specifier beyond cache misses.
- Do **not** reintroduce per-pair `collectEdgesToPeer` source re-read.

**Applies to:** HOTSPOT-600, HOTSPOT-601, HOTSPOT-613.

### Ranking + JSON contract (locked)

- Do not change `couplingStrength`, `coChangeCount`, pair order, or `--min-cochange`.
- No new CouplingPair fields; no `ScanResult.version` bump.
- Existing fields (`hasStaticDependency`, `staticDependencyDirection`, kind flags) keep M27 invariants — only true-positive rate for package-entry / `#` imports improves.
- Contract tests remain green without schema property changes (behavior fixtures may assert `true` where previously `false`).

**Applies to:** HOTSPOT-591, HOTSPOT-592, HOTSPOT-602, HOTSPOT-603.

### Errors / misses (locked)

Malformed or unreadable `package.json` → treat as no package scope for that directory (miss); scan continues. No new warning codes required (YAGNI); optional reuse of enrich `onWarning` only if already wired — prefer silent miss consistent with M27 config parse failure.

**Applies to:** HOTSPOT-598, HOTSPOT-611.

### Boundaries (locked)

- No PathAliasMap / historical AST / M26 rename graph.
- No ts-morph in `src/scoring/`.
- No new CLI flags.
- M45 (`adoption-docs-package-exports`) owns **this package’s** published `"exports"` map + adoption docs — not this feature.

**Applies to:** HOTSPOT-607 Out of Scope.

### Agent's Discretion

- Exact file name (`package-exports-map.ts` vs split index helper) as long as module stays under `src/scoring/`.
- Whether `WorkspacePackageIndex` is a class method on the same helper or a thin sibling — prefer one module unless file size warrants split.
- Fixture layout under `tests/fixtures/repos/` slug naming (`package-exports-coupling` recommended).

---

## Specific References

- CONCERNS § Enriched coupling + Unmitigated matrix: `package.json` `exports`/`imports` deferred → M44 closes
- ARCHITECTURE § Enriched coupling (M14/M27/M33): out-of-scope line today; Execute removes
- Node.js [Packages](https://nodejs.org/api/packages.html) `exports` / `imports` / conditions — pragmatic subset only
- M27 context: `package.json` exports deferred; bare npm without paths miss unchanged for **external** packages

---

## Deferred Ideas

- Full `node_modules` / lockfile-aware package resolution
- Source↔dist heuristic mapping
- Complete Node condition precedence / dual-package hazard emulation
- New diagnostic when exports miss looks like a monorepo workspace package
- Changing JSON schema version or additive coupling fields for “resolved via exports”

None of the above are in M44.
