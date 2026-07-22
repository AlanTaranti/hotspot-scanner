# with-renames — rename chain fixture

Validates churn continuity across multiple renames (RT-003 E2E).

## History

1. Add and edit `src/a.ts`
2. Rename `src/a.ts` → `src/b.ts`
3. Rename `src/b.ts` → `src/c.ts`
4. Edit `src/c.ts`

## Expected

- Canonical path `src/c.ts` should aggregate churn from the rename chain
- Scan completes with exit code `0`

## Bootstrap

```bash
node bootstrap-repo.mjs
```

## Validation

```bash
pnpm build
pnpm exec hotspot-scanner scan tests/fixtures/repos/with-renames
```
