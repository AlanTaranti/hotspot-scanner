# Milestone 24 — Package DX Context

**Feature slug:** `package-dx`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M24; user-confirmed locked decisions during planning (do **not** reopen)

---

## Decision: Scope — prep-only + files allowlist including schemas/

**Question:** How far should package DX go for npm readiness?

**Choice:** **Scope B** — publish **prep only** (no actual `npm publish`). Add explicit `package.json` `files` allowlist that **includes `schemas/`** (closes the M20 json-contract thread: schemas ship with the package, not repo-only).

**Also include in `files`:** at least `dist/`, `schemas/`, plus `LICENSE` and `README.md` (explicit even where npm defaults would include them).

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-197–199, T1.

---

## Decision: Lint tool — ESLint flat config

**Question:** Which linter?

**Choice:** **ESLint** with **flat config** (`eslint.config.js` or `eslint.config.mjs` — ESM-compatible; prefer `.mjs` if root `"type": "module"` makes `.js` ambiguous for tooling).

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-195, T3.

---

## Decision: Format — Prettier (format script IN scope)

**Question:** Is formatting in scope? Write vs check?

**Choice:** **Prettier is IN scope.** Concrete scripts (no TBD):

| Script | Command | Role |
| ------ | ------- | ---- |
| `format` | `prettier --write .` | Mutating format (local fix) |
| `format:check` | `prettier --check .` | Non-mutating verification |

Both scripts are required deliverables. CONTRIBUTING recommends `format:check` (and `lint` / `typecheck`) as local steps; they are **not** part of the project quality gate.

**Status:** **Confirmed** (user locked + planner concrete script contract)

**Applies to:** HOTSPOT-196, T4.

---

## Decision: Out of scope (explicit)

| Item | Status |
| ---- | ------ |
| Actual `npm publish` / publish workflow | Out of scope |
| `publishConfig` | Out of scope |
| Registry vs Git-install distribution | Remains **Deferred** in STATE — do not resolve in M24 |
| GitHub Actions / any CI | Out of scope (keep “no CI in v1”) |
| `dev` script | Out of scope (YAGNI) |
| Changing AGENTS.md quality gate to require lint/format | Out of scope |

**Status:** **Confirmed** (user locked)

---

## Decision: Project gate unchanged

**Question:** Should AGENTS.md / quality-gates rule require lint or format?

**Choice:** **No.** Project gate remains:

```bash
pnpm build && pnpm test
```

CONTRIBUTING **may** recommend `typecheck` / `lint` / `format:check` as local contributor steps **alongside** the gate. Do **not** edit AGENTS.md gate text to require lint.

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-202, T5–T6.

---

## Decision: engines.node

**Choice:** `"engines": { "node": ">=22" }`

**Status:** **Confirmed** (user locked)

**Applies to:** HOTSPOT-197, T1.

---

## Decision: LICENSE

**Finding:** `LICENSE` already exists at repo root (MIT). No new license file in this feature.

**Status:** **Confirmed** (user locked)

---

## Decision: repository.url (concrete — no TBD)

**Finding (2026-07-23):** No `git remote` configured in this clone; README clone URL is a placeholder (`git clone <repo-url>`).

**Choice:** Set `package.json` `repository` to:

```json
{
  "type": "git",
  "url": "git+https://github.com/taranti/hotspot-scanner.git"
}
```

Rationale: author `Alan Taranti`; workspace under `.../taranti/.../hotspot-scanner`. If a real `origin` remote is added before Execute, implementer **may** replace the URL with that remote’s HTTPS git URL — but **must not** leave `repository` unset or as a TBD placeholder.

**Status:** **Locked for planning** (concrete default string)

**Applies to:** HOTSPOT-198, T1.

---

## Decision: typecheck script contract

**Choice:**

```json
"typecheck": "tsc --noEmit && tsc --noEmit -p tsconfig.bin.json"
```

Mirrors `build`’s dual-project layout (`tsconfig.json` + `tsconfig.bin.json`) without emitting.

**Status:** **Locked**

**Applies to:** HOTSPOT-194, T2.

---

## Decision: lint script contract

**Choice:**

```json
"lint": "eslint ."
```

Flat config owns ignores (`dist/`, `coverage/`, `node_modules/`, and other generated/fixture noise as needed). Use `typescript-eslint` for TS; disable stylistic conflicts via `eslint-config-prettier` once Prettier lands (T4 may adjust ESLint config if T3 lands first without prettier integration — T4 owns adding prettier compatibility).

**Status:** **Locked**

**Applies to:** HOTSPOT-195, T3.

---

## Agent notes (non-decisions)

- No application logic under `src/` / `bin/` expected.
- Living docs: STACK.md + CONVENTIONS.md; note that `schemas/` ships via `files`.
- Do not remove STATE Deferred “npm private registry vs Git install”.
