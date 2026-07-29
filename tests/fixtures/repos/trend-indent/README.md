# trend-indent — M72 integration fixture

Versioned Git repository with measurable indentation and NCLOC growth on one file.

## Bootstrap

```bash
node bootstrap-repo.mjs
```

## Validation

```bash
pnpm exec hotspot-scanner trend src/trend.ts --since "10 years ago"
```
