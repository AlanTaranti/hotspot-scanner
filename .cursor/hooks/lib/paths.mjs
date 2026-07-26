import path from "node:path";

/** @typedef {string} RelPath */

export const CODE_PATH_RE =
  /^(src\/|bin\/|scripts\/|schemas\/|vitest\.config\.ts$)/;

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
 * Strip leading ./ and ../ segments from a path string.
 * @param {string} p
 * @returns {string}
 */
function stripDotSegments(p) {
  let out = p;
  while (out.startsWith("./") || out.startsWith("../")) {
    out = out.replace(/^\.\//, "").replace(/^\.\.\//, "");
  }
  return out;
}

/**
 * @param {string | undefined | null} raw
 * @returns {string | null}
 */
export function normalizeRelPath(raw) {
  if (!raw || typeof raw !== "string") return null;
  const p = stripDotSegments(raw.replace(/\\/g, "/"));
  return p || null;
}

/**
 * Convert an absolute or relative path to a repo-relative path.
 * @param {string | undefined | null} raw
 * @param {string | undefined | null} workspaceRoot
 * @returns {string | null}
 */
export function toRelPath(raw, workspaceRoot) {
  if (!raw || typeof raw !== "string") return null;
  let p = raw.replace(/\\/g, "/");

  if (workspaceRoot && typeof workspaceRoot === "string") {
    const root = path.resolve(workspaceRoot).replace(/\\/g, "/");
    const rootWithSlash = root.endsWith("/") ? root : `${root}/`;

    if (path.isAbsolute(raw)) {
      const abs = path.resolve(raw).replace(/\\/g, "/");
      if (abs === root) return null;
      if (abs.startsWith(rootWithSlash)) {
        return abs.slice(rootWithSlash.length) || null;
      }
      // Absolute path outside workspace — keep basename-style fallback
      return normalizeRelPath(abs);
    }

    // Relative but may still include the workspace prefix as a string
    if (p.startsWith(rootWithSlash)) {
      p = p.slice(rootWithSlash.length);
    } else if (p === root) {
      return null;
    }
  }

  return normalizeRelPath(p);
}

/**
 * @param {unknown} toolInput
 * @param {string | undefined | null} [workspaceRoot]
 * @returns {string | null}
 */
export function extractEditPath(toolInput, workspaceRoot) {
  if (!toolInput || typeof toolInput !== "object") return null;
  const input = /** @type {Record<string, unknown>} */ (toolInput);
  const candidates = [
    input.path,
    input.file_path,
    input.filePath,
    input.target_file,
    input.target_notebook,
  ];
  for (const c of candidates) {
    const n = toRelPath(typeof c === "string" ? c : null, workspaceRoot);
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

export const FRAGILE_CONTEXT = `Fragile scanner area. Rules: .cursor/rules/fragile-areas.mdc and .specs/codebase/CONCERNS.md — update or add a co-located Vitest test before marking Complete.`;

export const SCORING_FORMULA_CONTEXT = `Changes under src/scoring/ affect hotspotScore and couplingStrength — confirm tests with fixed inputs and expected ordering (fragile-areas.mdc).`;
