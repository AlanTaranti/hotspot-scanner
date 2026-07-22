export const PROGRESS_LOG_INTERVAL = 1000;

export function logWarning(message: string): void {
  process.stderr.write(`warning: ${message}\n`);
}

export function logProgress(commitsProcessed: number): void {
  process.stderr.write(
    `Processing commit ${commitsProcessed.toLocaleString("en-US")}...\n`,
  );
}

/** Returns true when a progress line was emitted (passed throttle). */
export function maybeLogProgress(
  commitsProcessed: number,
  interval: number = PROGRESS_LOG_INTERVAL,
): boolean {
  if (commitsProcessed <= 0 || commitsProcessed % interval !== 0) {
    return false;
  }
  logProgress(commitsProcessed);
  return true;
}
