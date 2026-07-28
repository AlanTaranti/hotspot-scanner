/** Unicode ellipsis U+2026 — locked. */
export const PATH_ELLIPSIS = "…";

/** Fallback when columns missing / invalid — locked (= today's hard-coded width). */
export const FALLBACK_FILE_COLUMN_WIDTH = 24;

/** Minimum File width after clamp. */
export const MIN_FILE_COLUMN_WIDTH = 16;

/** Maximum File width after clamp. */
export const MAX_FILE_COLUMN_WIDTH = 64;

/**
 * Fixed non-File budget for scan hotspot row:
 * Rank(4) + Score(8) + NLOC(4) + NLOCN(8) + Churn(5) + ChurnN(6) + Authors(7)
 * + 7 × two-space separators = 56.
 */
export const SCAN_TABLE_NON_FILE_WIDTH = 56;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveFileColumnWidth(stdoutColumns?: number): number {
  const cols =
    stdoutColumns !== undefined ? stdoutColumns : process.stdout.columns;

  if (cols === undefined || !Number.isFinite(cols) || cols <= 0) {
    return FALLBACK_FILE_COLUMN_WIDTH;
  }

  const budgeted = Math.floor(cols) - SCAN_TABLE_NON_FILE_WIDTH;
  return clamp(budgeted, MIN_FILE_COLUMN_WIDTH, MAX_FILE_COLUMN_WIDTH);
}

function middleEllipsizePath(filePath: string, width: number): string {
  if (filePath.length <= width) {
    return filePath;
  }

  const slashIndex = filePath.lastIndexOf("/");
  const base = slashIndex === -1 ? filePath : filePath.slice(slashIndex + 1);

  // Preferred: head + "…" + "/" + basename when room for at least one prefix char.
  if (slashIndex !== -1 && 1 + 1 + base.length < width) {
    const headLength = width - 2 - base.length;
    const head = filePath.slice(0, headLength);
    return `${head}${PATH_ELLIPSIS}/${base}`;
  }

  // Fallback: ellipsis + tail (basename-biased end).
  const tailLength = width - 1;
  return `${PATH_ELLIPSIS}${filePath.slice(filePath.length - tailLength)}`;
}

export function formatFileColumn(filePath: string, width: number): string {
  const ellipsized = middleEllipsizePath(filePath, width);
  if (ellipsized.length >= width) {
    return ellipsized.slice(0, width);
  }
  return ellipsized.padEnd(width);
}

export function formatFileColumnHeader(width: number): string {
  return "File".padEnd(width);
}

export function formatFileColumnDashes(width: number): string {
  return "-".repeat(width);
}
