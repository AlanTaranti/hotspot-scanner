# Milestone 20 — JSON Contract Context

**Feature slug:** `json-contract`  
**Captured:** 2026-07-23  
**Trigger:** ROADMAP M20; depends on M14 field presence in schemas

---

## Decision: Schema location and split

**Question:** One schema file or two?

**Choice:** Two Draft-07 (or 2020-12) JSON Schema files under repo `schemas/`:

- `schemas/scan-result.json` — `ScanResult`
- `schemas/compare-result.json` — `CompareResult` (may `$ref` shared definitions)

**Rationale:** Clear CLI contract surfaces; compare is a distinct root.

**Status:** **Confirmed**

---

## Decision: Validation library

**Question:** How to validate in production `loadBaseline()` and in contract tests?

**Choice:**

- **Publish** schemas as SoT in `schemas/`
- **Runtime `loadBaseline` / `parseScanResult`:** deepen structural validation to match schema (required fields, types, enums) — prefer **Ajv** as a **runtime dependency** if keeping one implementation path; alternatively hand-rolled deep checks mirroring schema **without** Ajv if YAGNI prefers zero new deps
- **Contract tests:** always validate CLI JSON fixtures against published schemas (Ajv as **devDependency** minimum)

**Agent default if Execute prefers fewer deps:** hand-rolled deep `parseScanResult` + Ajv **devDependency** for contract tests only. Document chosen path in STATE during Execute.

**Planning recommendation:** Ajv **devDependency** for tests + strengthened hand validation in `parseScanResult` that rejects malformed item shapes (not only top-level keys). Avoid runtime Ajv unless hand validation becomes unmaintainable.

**Status:** **Confirmed** (recommendation locked; Exact Ajv runtime vs hand-rolled left as implementer choice within this constraint)

---

## Decision: Pre-M14 baselines missing `hasStaticDependency`

**Question:** Reject or default?

**Choice:** **Reject** baselines whose coupling items omit `hasStaticDependency` once M14+M20 are shipped — clear `BaselineError` message telling user to re-scan. Schemas require the boolean.

**Rationale:** Strict contract; M14 is ordered before M20 in execute plan.

**Status:** **Confirmed**

**Prerequisite:** Execute M14 before M20 (or M20 schema draft may mark field required anticipating M14 Done).

---

## Decision: version field

**Question:** Bump `version` for schema publication?

**Choice:** Keep ScanResult `version: "1.0"`; schemas encode that const. No `1.1` bump solely for schema files or `hasStaticDependency`.

**Status:** **Confirmed**
