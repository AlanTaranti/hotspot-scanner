# Milestone 74 — Doctor Color UX Context

**Gathered:** 2026-07-27  
**Spec:** [`.specs/features/doctor-color-ux/spec.md`](./spec.md)  
**Status:** Ready for design  
**Milestone:** ROADMAP M74 | **IDs:** HOTSPOT-1520–1539 | **Slug:** `doctor-color-ux`

User-locked scope from the planning brief; gray areas decided firmly below (no open discussion items).

**Note:** M73 / HOTSPOT-1500–1519 are already assigned to `top-only-rollups`. This feature is **M74**.

---

## Feature Boundary

**In scope:** ANSI coloring of `hotspot-scanner doctor` **text** status prefixes (`pass:` / `warn:` / `fail:`) when writing to an interactive stdout TTY, gated like M41 table color (`--no-color`, `NO_COLOR`, non-TTY → plain).

**Out of scope:** Coloring message bodies, paths, or numbers; `FORCE_COLOR`; JSON color; scan/trend table color changes; new runtime color libraries; changing finding messages or exit codes; doctor `--output` (doctor has none).

---

## Locked Decisions

### D1: Color target — status prefix only

**Choice:** Color only the status token and its trailing colon (`pass:`, `warn:`, `fail:`). The remainder of the line (` message`) stays uncolored.

**Rationale:** Matches the operator need to scan pass/warn/fail at a glance; YAGNI on path/number highlighting; preserves M51 line shape `status: message`.

**Status:** **Confirmed**

---

### D2: Palette

**Choice:** Raw ANSI (no chalk/picocolors/kleur):

| Status | Color |
| ------ | ----- |
| `pass` | Green (`\x1b[32m`) |
| `warn` | Yellow (`\x1b[33m`) |
| `fail` | Red (`\x1b[31m`) |

Wrap with reset (`\x1b[0m`) after the prefix. Reuse patterns from [`src/report/color.ts`](../../../src/report/color.ts).

**Status:** **Confirmed**

---

### D3: When color is enabled

**Choice:** Color **on** only when **all** of:

1. Doctor output format is `text`
2. `process.stdout.isTTY === true` (injectable in tests)
3. `--no-color` is **not** set on the doctor command
4. `NO_COLOR` env is unset or empty (non-empty disables — [no-color.org](https://no-color.org) spirit, same as M41)

Color **off** for `--format json` always.

**No** `FORCE_COLOR` (YAGNI — same as M41 D6).

Doctor has no `--output`; do not invent file-output color rules.

**Status:** **Confirmed**

---

### D4: `--no-color` on doctor

**Choice:** Add `--no-color` to the **doctor** subcommand (CLI-only). Scan’s existing `--no-color` stays on scan; do not hoist to a global parent option in this milestone. Not a config key.

Help text may say “Disable ANSI colors in doctor text output” (agent discretion on exact wording).

**Status:** **Confirmed**

---

### D5: Formatting ownership

**Choice:** Move text formatting out of thin bin helper into `src/doctor/format.ts` as `formatDoctorTextReport(findings, { color })`. Bin resolves color and writes the string. JSON formatter unchanged.

**Status:** **Confirmed**

---

### D6: Pipeline / contract unchanged

**Choice:** No changes to `runDoctor` findings, `aggregateExitCode`, JSON envelope `version: "1.0"`, or schemas. Presentation + CLI gates only.

**Status:** **Confirmed**

---

## Agent Discretion (non-blocking)

- Exact green code: bright vs normal green — prefer normal `\x1b[32m` (readable on dark terminals)
- Whether `formatDoctorFindings` remains as a deprecated alias or is deleted after move — prefer delete/replace call sites only
- Whether `resolveDoctorColor` lives next to `resolveTableColor` or shares a tiny private helper — prefer parallel export for clarity (different format allowlist)

---

## Related Closed Decisions

| Decision | Value | Relevance |
| -------- | ----- | --------- |
| M41 table color gates | TTY + `--no-color` + `NO_COLOR`; no FORCE_COLOR; no chalk | Sister gates to reuse |
| M51 doctor text shape | `status: message` lines; JSON envelope | Keep shape; color wraps prefix only |
| M39/M52/M64 doctor checks | Finding IDs and messages | Do not change messages |
| Reporter pure / stripAnsi | `src/report/color.ts` | Reuse `stripAnsi` for tests |
