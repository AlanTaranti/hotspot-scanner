# with-renames — rename chain fixture

Validates churn continuity across multiple content-preserving renames with find-renames (`-M`) enabled (RT-003 / HOTSPOT-208 E2E).

## History

| Step | Commit message        | Action                                      |
| ---- | --------------------- | ------------------------------------------- |
| 1    | add a.ts              | Create `src/a.ts` (`v = 1`)                 |
| 2    | edit a.ts             | Edit `src/a.ts` (`v = 2`)                   |
| 3    | rename a.ts to b.ts   | `git mv` `src/a.ts` → `src/b.ts` (no edit)  |
| 4    | rename b.ts to c.ts   | `git mv` `src/b.ts` → `src/c.ts` (no edit)  |
| 5    | edit c.ts             | Edit `src/c.ts` (`v = 5`)                   |

Renames are content-preserving so `git log -M --numstat` emits `src/{old => new}` metadata.

## Expected scan outcomes

- **Canonical path:** `src/c.ts` aggregates all five commits (`commitCount: 5`).
- **No split paths:** `src/a.ts` and `src/b.ts` do not appear in hotspot rankings.
- **Warnings (file miner, default `--since`):**
  - Present: `Rename history before the --since window (…) may be missing under canonical paths` (rename links observed with `--since` set).
  - Absent: unlinked-rename (`Suspected unlinked rename…`) and ambiguous-path (`Rename history may be incomplete for:…`) families — git rename metadata links the chain.
- **Exit code:** `0`

## Bootstrap

```bash
node bootstrap-repo.mjs
```

Rebuilds `.git` from scratch (requires permission to remove `.git`).

## Validation

```bash
pnpm build
pnpm exec hotspot-scanner scan tests/fixtures/repos/with-renames
pnpm test -- src/scan.integration.test.ts
```
