# small-ts — M6 integration fixture

Minimal versioned Git repository for end-to-end hotspot-scanner validation.

## Purpose

- Prove full pipeline: git miner → complexity → hotspot + coupling scoring
- Deterministic rankings for Vitest integration tests

## Layout

| File            | Role                                                |
| --------------- | --------------------------------------------------- |
| `src/low.ts`    | Minimal McCabe complexity                           |
| `src/medium.ts` | Moderate complexity                                 |
| `src/high.ts`   | Highest complexity (nested branches, loops, switch) |

## Git history (summary)

1. Add `low.ts`
2. Add `medium.ts`
3. Add `high.ts`
   4–6. Co-change `high.ts` + `medium.ts` (≥3 times for `DEFAULT_MIN_COCHANGE`)
4. Extra churn on `high.ts` only

Commit dates are fixed within the last 6 months so `DEFAULT_SINCE` (`12 months ago`) always includes all commits.

## Expected scan results

| Assertion         | Expected value                                            |
| ----------------- | --------------------------------------------------------- |
| Top hotspot file  | `src/high.ts`                                             |
| Top coupling pair | `src/high.ts` ↔ `src/medium.ts` with `coChangeCount >= 3` |

## Bootstrap

If `.git/` is missing, run:

```bash
node bootstrap-repo.mjs
```

## Validation

```bash
pnpm build
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts
pnpm exec hotspot-scanner scan tests/fixtures/repos/small-ts --format json
```

Exit code must be `0`. Output must include non-empty hotspot and coupling rankings.
