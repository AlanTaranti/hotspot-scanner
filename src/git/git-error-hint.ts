const SINCE_DATE_CUES = ["invalid date", "not a valid date", "bad date"] as const;

const CORRUPT_CUES = ["corrupt", "bad object", "loose object"] as const;

const SINCE_DATE_HINT =
  "Fix --since or config since — use a relative window (e.g. `12 months ago`) or an ISO date (YYYY-MM-DD).";

const SHALLOW_HINT =
  "Deepen the clone with `git fetch --unshallow` or re-clone without --depth for full history.";

const CORRUPT_HINT =
  "Run `git fsck` to check object integrity, or repair or re-clone the repository.";

export function formatGitStderrHint(stderr: string): string | undefined {
  const normalized = stderr.toLowerCase();

  if (SINCE_DATE_CUES.some((cue) => normalized.includes(cue))) {
    return SINCE_DATE_HINT;
  }

  if (normalized.includes("shallow")) {
    return SHALLOW_HINT;
  }

  if (CORRUPT_CUES.some((cue) => normalized.includes(cue))) {
    return CORRUPT_HINT;
  }

  return undefined;
}
