# monorepo-nested — M43 integration fixture

Versioned Git repository with two packages under `packages/` for monorepo path remount and include scoping.

## Layout

| Path                     | Role                                      |
| ------------------------ | ----------------------------------------- |
| `packages/api/src/`      | Primary package — nested scan target      |
| `packages/other/src/`    | Second package — excluded when scoped     |

## Bootstrap

```bash
node bootstrap-repo.mjs
```

## Validation

```bash
pnpm exec hotspot-scanner scan tests/fixtures/repos/monorepo-nested/packages/api
pnpm exec hotspot-scanner doctor tests/fixtures/repos/monorepo-nested/packages/api
```
