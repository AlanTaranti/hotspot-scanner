# merge-heavy — merge and delete fixture

Validates git miner behavior with merge commits and file deletions.

## History

1. Add `src/keep.ts` and `src/remove.ts`
2. Feature branch with `src/feature.ts`, merged into `main`
3. Delete `src/remove.ts` on `main`

## Expected

- Scan completes with exit code `0`
- `src/keep.ts` remains in hotspot rankings

## Bootstrap

```bash
node bootstrap-repo.mjs
```

## Validation

```bash
pnpm build
pnpm exec hotspot-scanner scan tests/fixtures/repos/merge-heavy
```
