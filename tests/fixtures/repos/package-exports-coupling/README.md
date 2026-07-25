# package-exports-coupling fixture

Minimal workspace-style tree for static coupling enrichment via `package.json` **`exports`** (cross-package) and **`imports`** (`#` subpath). Sources only — no Git history; T5 tests call `enrichCouplingStaticDeps` with injected pairs against this `repoPath`.

## Layout

```
packages/
  provider/
    package.json          # name: @repo/provider; exports "." → ./src/index.ts
    src/index.ts
  consumer/
    package.json          # name: @repo/consumer; imports "#util" → ./src/util.ts
    src/exports-consumer.ts   # import from @repo/provider (package exports)
    src/imports-consumer.ts   # import from #util (package imports)
    src/util.ts
    src/isolated.ts             # external lodash import — negative control
```

## Expected enrich outcomes

Call `enrichCouplingStaticDeps(pairs, repoPath)` with `repoPath` = this directory. Inject `CouplingPair` rows (co-change counts are arbitrary; ranking fields must be preserved).

| fileA | fileB | hasStaticDependency | staticDependencyDirection | hasRuntimeStaticDependency | hasTypeOnlyStaticDependency | hasReExportStaticDependency | Resolution |
| ----- | ----- | ------------------- | ------------------------- | -------------------------- | --------------------------- | --------------------------- | ---------- |
| `packages/consumer/src/exports-consumer.ts` | `packages/provider/src/index.ts` | `true` | `a-to-b` | `true` | `false` | `false` | `@repo/provider` → provider `exports["."]` |
| `packages/consumer/src/imports-consumer.ts` | `packages/consumer/src/util.ts` | `true` | `a-to-b` | `true` | `false` | `false` | `#util` → consumer `imports["#util"]` |
| `packages/consumer/src/isolated.ts` | `packages/provider/src/index.ts` | `false` | `none` | `false` | `false` | `false` | `lodash` not in peer index |

## Usage in tests (T5)

```typescript
import { join } from "node:path";
import { enrichCouplingStaticDeps } from "./enrich-coupling-static.js";

const repoPath = join(process.cwd(), "tests/fixtures/repos/package-exports-coupling");

const pairs = enrichCouplingStaticDeps(
  [
    {
      fileA: "packages/consumer/src/exports-consumer.ts",
      fileB: "packages/provider/src/index.ts",
      coChangeCount: 3,
      couplingStrength: 1,
      hasStaticDependency: false,
      staticDependencyDirection: "none",
      hasRuntimeStaticDependency: false,
      hasTypeOnlyStaticDependency: false,
      hasReExportStaticDependency: false,
    },
  ],
  repoPath,
);
```

## Git / scan integration

This fixture intentionally has **no** `.git` directory. Full `hotspot-scanner scan` needs Git churn for coupling pairs; M44 T5 asserts via enrich API + injected pairs. Add `bootstrap-repo.mjs` later only if a scan integration test needs co-change history.

## Validate (enrich smoke)

```bash
pnpm test -- src/scoring/enrich-coupling-static.test.ts -t "package exports"
```

Or after T5 lands:

```bash
pnpm test -- src/scoring/enrich-coupling-static.test.ts -t "package-exports-coupling"
```
