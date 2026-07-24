# Milestone 25 — Product Docs Sync Context

**Feature:** `product-docs-sync`  
**Milestone:** M25  
**Locked:** 2026-07-23 (planner-feature; ROADMAP scope + audit)

Locked product decisions for Execute. Do not re-open without user ack.

---

## D1 — Docs only

**Question:** Any CLI / pipeline / test behavior changes?

**Choice:** **No.** Edits limited to living docs, feature Status metadata, and light ROADMAP/STATE prose consistency.

**Status:** **Confirmed**

---

## D2 — PROJECT.md shipped through M24

**Question:** What replaces “through M18” + “M20–M22 planned”?

**Choice:**

- Shipped heading: **through M24**
- Add summary bullets for at least: M20 JSON schemas, M21 `.hotspot-scanner.json`, M22 function AST extensions, M23 per-function hunk churn, M24 package DX; keep existing M7–M18; include M14 `hasStaticDependency` if coupling is listed
- Excludes / backlog: remove planned M20–M22 line; keep CI gate / non-TS-JS / relative churn; point forward work at ROADMAP post-M24 stubs (M25–M30)

**Status:** **Confirmed**

---

## D3 — Rename / `--follow` wording

**Question:** Exact product wording for rename?

**Choice:** Document current behavior: parse `old => new` + `PathAliasMap` canonicalize; **do not** use global `git log --follow` for mining (RT-003). Place in ARCHITECTURE § Key constraints and a short README How-it-works note. Do **not** implement M26 warnings.

**Status:** **Confirmed**

---

## D4 — README M23 function churn

**Question:** How deep should README go on hunk overlap?

**Choice:** One clear paragraph / bullet: function mode uses hunk overlap on a patch stream; churn is **not** inherited file stats. Point readers at ARCHITECTURE for detail. Do not paste full CONCERNS tables.

**Status:** **Confirmed**

---

## D5 — ROADMAP / STATE ownership

**Question:** Who updates ROADMAP Specs links for M25–M30?

**Choice:** **Parent** owns final ROADMAP/STATE Specs link sync for M25–M30. Execute **verifies** header + Active order (M26 → M25 → M27 → M28 → M30 → M29), may fix clearly stale Decision-row “Status Planned” for Done milestones, and may mark M25 checklist `[x]` when Done. Do not invent Specs links for unplanned stubs.

**Status:** **Confirmed** (user / parent instruction)

---

## D6 — Stale design Status targets

**Question:** Which Status fields are in scope?

**Choice:** At minimum set `design.md` Status to `Done` for `function-ast-coverage`, `per-function-churn`, `package-dx`. Grep other Done milestones for the same drift and fix. Leave context.md “Confirmed” decision statuses alone.

**Status:** **Confirmed** (audit 2026-07-23)

---

## D7 — Gate

**Question:** Per-task vs project gate?

**Choice:** Intermediate tasks may use grep-only verification (`Gate: none`). Final task **must** run `pnpm build && pnpm test`.

**Status:** **Confirmed**

---

## Audit snapshot (planning time)

| Doc | Drift found |
| --- | ----------- |
| `PROJECT.md` | Shipped “through M18”; backlog “M20–M22 — planned” |
| `README.md` | No PathAliasMap / `--follow` note; How it works = single numstat story; no M23 hunk overlap |
| `ARCHITECTURE.md` Key constraints | Dual-stream present; **missing** rename / not-`--follow` bullet |
| `function-ast-coverage/design.md` | `Status: Planned` |
| `per-function-churn/design.md` | `Status: Planned` |
| `package-dx/design.md` | `Status: Planned` |
| ROADMAP header / STATE Active | Already aligned with M24 Done + M26-first backlog (verify at Execute) |
