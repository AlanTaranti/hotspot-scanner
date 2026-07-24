/** @typedef {string} RelPath */

export const CODE_PATH_RE =
  /^(src\/|bin\/|scripts\/|vitest\.config\.ts$)/;

export const FRAGILE_PATH_RES = [
  /^src\/git\//,
  /^src\/complexity\//,
  /^src\/scoring\//,
  /^src\/scan\.ts$/,
  /^src\/compare\//,
  /^schemas\//,
];

export const FRAGILE_SCORING_RE = /^src\/scoring\//;

export const PLANNER_BLOCKED_RE = /^(src|bin|tests)\//;

export const OWNERSHIP_PATH_RE = /tasks\.md$|ROADMAP\.md$/;

export const TSCONFIG_RE = /^tsconfig\.json$/;

/**
 * @param {string | undefined | null} raw
 * @returns {string | null}
 */
export function normalizeRelPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  let p = raw.replace(/\\/g, "/");
  const roots = ["./", "../"];
  while (roots.some((r) => p.startsWith(r))) {
    p = p.replace(/^\.\//, "").replace(/^\.\.\//, "");
  }
  return p || null;
}

/**
 * @param {unknown} toolInput
 * @returns {string | null}
 */
export function extractEditPath(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return null;
  const input = /** @type {Record<string, unknown>} */ (toolInput);
  const candidates = [
    input.path,
    input.file_path,
    input.filePath,
    input.target_file,
  ];
  for (const c of candidates) {
    const n = normalizeRelPath(typeof c === "string" ? c : null);
    if (n) return n;
  }
  return null;
}

/**
 * @param {unknown} toolInput
 * @returns {string}
 */
export function extractEditContent(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return "";
  const input = /** @type {Record<string, unknown>} */ (toolInput);
  const parts = [
    input.contents,
    input.content,
    input.new_string,
    input.newString,
    input.new_str,
  ];
  return parts
    .filter((p) => typeof p === "string")
    .join("\n");
}

/**
 * @param {string | null} relPath
 */
export function isCodePath(relPath) {
  return relPath !== null && CODE_PATH_RE.test(relPath);
}

/**
 * @param {string | null} relPath
 */
export function isFragilePath(relPath) {
  return (
    relPath !== null && FRAGILE_PATH_RES.some((re) => re.test(relPath))
  );
}

/**
 * @param {string | null} relPath
 */
export function isFragileScoringPath(relPath) {
  return relPath !== null && FRAGILE_SCORING_RE.test(relPath);
}

/**
 * @param {string} content
 */
export function tsconfigAddsBinInclude(content) {
  if (!/include/i.test(content)) return false;
  const lower = content.toLowerCase();
  if (!lower.includes("bin")) return false;
  return /"bin[^"]*"/.test(content) || /'bin[^']*'/.test(content);
}

export const FRAGILE_CONTEXT = `Área frágil do scanner. Regras: .cursor/rules/fragile-areas.mdc e .specs/codebase/CONCERNS.md — atualize ou adicione teste Vitest co-localizado antes de marcar Complete.`;

export const SCORING_FORMULA_CONTEXT = `Mudanças em src/scoring/ afetam hotspotScore e couplingStrength — confirme testes com inputs fixos e ordem esperada (fragile-areas.mdc).`;
