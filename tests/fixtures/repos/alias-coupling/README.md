# alias-coupling fixture

Minimal Git repo for integration tests of tsconfig `paths` alias static coupling enrichment.

## Layout

- `src/consumer.ts` — imports `src/provider.ts` via `@app/provider` (not a relative path)
- `src/provider.ts` — exported symbol consumed by alias import
- `src/orphan.ts` — co-changes with consumer but no static import link
- `tsconfig.json` — `paths`: `@app/*` → `src/*`

## Expected scan highlights

- Coupling pair `src/consumer.ts` ↔ `src/provider.ts`: `hasStaticDependency: true`, `staticDependencyDirection: "a-to-b"`
- Coupling pair `src/consumer.ts` ↔ `src/orphan.ts`: `hasStaticDependency: false`, `staticDependencyDirection: "none"`

## Rebuild

```bash
node tests/fixtures/repos/alias-coupling/bootstrap-repo.mjs
```

## Validate

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/alias-coupling --format json
```
