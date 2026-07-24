# Manual performance benchmark — hotspot-scanner

**Requirement:** HOTSPOT-59 (RT-001)  
**Scope:** Manual qualitative assessment only — **not** part of `pnpm test` or CI.

## Purpose

Assess scan performance on a large repository before declaring v1 ready. CI runners vary; wall-clock timing is recorded by the operator, not gated in automation.

## Prerequisites

- Built CLI: `pnpm build`
- A large synthetic or real Git repository (thousands of commits and/or hundreds of TS/JS files)

### Option A — Use existing git-log sample as scale reference

The unit fixture [`tests/fixtures/git-log/large-synthetic.txt`](../tests/fixtures/git-log/large-synthetic.txt) documents expected log volume. For E2E timing, use a real Git repo with comparable commit count.

### Option B — Generate a synthetic repo

```bash
# Example: create a throwaway repo with many commits (adjust counts as needed)
BENCH_REPO=/tmp/hotspot-bench-repo
rm -rf "$BENCH_REPO"
mkdir -p "$BENCH_REPO/src"
cd "$BENCH_REPO"
git init
for i in $(seq 1 500); do
  echo "export const v$i = $i;" > "src/file-$i.ts"
  git add .
  git commit -m "add file $i"
done
```

## Run benchmark

From the hotspot-scanner project root:

```bash
pnpm build
time pnpm exec hotspot-scanner scan /path/to/large-repo --since "12 months ago" --format json > /dev/null
```

Optional: capture progress on stderr by omitting redirection.

## Record results

| Field               | Example                                              |
| ------------------- | ---------------------------------------------------- |
| Date                | 2026-07-22                                           |
| Machine             | laptop / CI runner name                              |
| Repo path           | `/tmp/hotspot-bench-repo`                            |
| `--since`           | `12 months ago`                                      |
| Commits processed   | (from progress stderr or `git rev-list --count`)     |
| Wall time (seconds) | `real` from `time` output                            |
| Notes               | qualitative: acceptable / slow / needs investigation |

## Qualitative target

On a typical developer laptop, a scan over ~10k commits in the default window should complete in reasonable time (operator judgment). Investigate streaming regressions if wall time grows disproportionately with commit count.

## M15 — AST parallelization (complexity stage)

Milestone 15 adds worker-thread batch processing inside `src/complexity/`. Git mining and scoring remain sequential; only AST analysis parallelizes internally.

**Before M15:** batches of ≤50 files processed sequentially on a single thread.

**After M15:** batches dispatched to a bounded worker pool (default concurrency `min(availableParallelism(), 4)`). Each worker runs `analyzeBatch` with a fresh ts-morph `Project`. Output is merged and reordered by file discovery index — rankings should be unchanged vs sequential mode.

### Benchmark notes

| Field            | Notes                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| Concurrency      | Internal constant only — no CLI `--workers` flag                               |
| Expected effect  | Reduced wall time on multi-core machines for repos with many TS/JS files       |
| Regression check | Compare wall time before/after on same large repo; record qualitative judgment |

```bash
# Same command as above — compare real time on a repo with 200+ source files
time pnpm exec hotspot-scanner scan /path/to/large-repo --since "12 months ago" --format json > /dev/null
```

## What this is not

- No millisecond threshold in CI
- No `package.json` script wired to `pnpm test`
- No failure exit code based on duration
