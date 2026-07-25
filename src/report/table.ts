import type { ScanResult } from "../types/index.js";
import { paintScore, paintStaticDep, stripAnsi } from "./color.js";
import {
  formatDirection,
  formatKinds,
  formatStaticDep,
} from "./coupling-format.js";
import { renderTableGlossary } from "./glossary.js";
import {
  includesSection,
  normalizeOnly,
  type ReportSection,
} from "./only.js";
import { buildScanExecutiveSummary } from "./summary.js";
import { buildTriageHints, renderTableTriageHints } from "./triage.js";

export interface RenderTableOptions {
  /** Full pre-slice corpus for executive summary totals. Defaults to `result`. */
  fullResult?: ScanResult;
  only?: readonly ReportSection[];
  /** When false, omits triage section. Defaults to true. */
  triageHints?: boolean;
  /** When true, applies ANSI color to score/strength/StaticDep cells. */
  color?: boolean;
}

function formatScore(value: number, color: boolean): string {
  return paintScore(value, color);
}

const SCORE_DECIMALS = 4;

function formatPlainScore(value: number): string {
  return value.toFixed(SCORE_DECIMALS);
}

function padEnd(value: string, width: number): string {
  const visible = stripAnsi(value);
  if (visible.length >= width) {
    return visible.slice(0, width);
  }
  return value + " ".repeat(width - visible.length);
}

function padStart(value: string, width: number): string {
  const visible = stripAnsi(value);
  if (visible.length >= width) {
    return visible.slice(0, width);
  }
  return " ".repeat(width - visible.length) + value;
}

function renderHotspotsSection(result: ScanResult, color: boolean): string[] {
  const lines = [
    "Top Hotspots",
    "Rank  File                      Score     Cpx   CpxN      Churn  ChurnN  Funcs  Authors",
    "----  ------------------------  --------  ----  --------  -----  ------  -----  -------",
  ];

  if (result.hotspots.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, hotspot] of result.hotspots.entries()) {
    lines.push(
      [
        padStart(String(index + 1), 4),
        padEnd(hotspot.filePath, 24),
        padStart(formatScore(hotspot.hotspotScore, color), 8),
        padStart(String(hotspot.cyclomaticComplexity), 4),
        padStart(formatPlainScore(hotspot.complexityNormalized), 8),
        padStart(String(hotspot.commitCount), 5),
        padStart(formatPlainScore(hotspot.churnNormalized), 6),
        padStart(String(hotspot.functionCount), 5),
        padStart(String(hotspot.authorCount), 7),
      ].join("  "),
    );
  }

  return lines;
}

function renderFunctionsSection(result: ScanResult, color: boolean): string[] {
  const lines = [
    "Top Functions",
    "Rank  File                      Function              Line  Score     Cpx   CpxN      Churn  ChurnN  Authors",
    "----  ------------------------  --------------------  ----  --------  ----  --------  -----  ------  -------",
  ];

  if (result.functions.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, fn] of result.functions.entries()) {
    lines.push(
      [
        padStart(String(index + 1), 4),
        padEnd(fn.filePath, 24),
        padEnd(fn.functionName, 20),
        padStart(String(fn.line), 4),
        padStart(formatScore(fn.hotspotScore, color), 8),
        padStart(String(fn.complexity), 4),
        padStart(formatPlainScore(fn.complexityNormalized), 8),
        padStart(String(fn.commitCount), 5),
        padStart(formatPlainScore(fn.churnNormalized), 6),
        padStart(String(fn.authorCount), 7),
      ].join("  "),
    );
  }

  return lines;
}

function renderCouplingSection(result: ScanResult, color: boolean): string[] {
  const lines = [
    "Top Coupling Pairs",
    "Rank  File A                    File B                    Strength  Co-changes  StaticDep  Direction  Kinds",
    "----  ------------------------  ------------------------  --------  ----------  ---------  ---------  ----------------------",
  ];

  if (result.coupling.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const [index, pair] of result.coupling.entries()) {
    const staticDep = paintStaticDep(formatStaticDep(pair.hasStaticDependency), color);
    lines.push(
      [
        padStart(String(index + 1), 4),
        padEnd(pair.fileA, 24),
        padEnd(pair.fileB, 24),
        padStart(formatScore(pair.couplingStrength, color), 8),
        padStart(String(pair.coChangeCount), 10),
        padStart(staticDep, 9),
        padStart(formatDirection(pair.staticDependencyDirection), 9),
        padEnd(formatKinds(pair), 22),
      ].join("  "),
    );
  }

  return lines;
}

function shouldShowHotspots(
  onlySet: ReadonlySet<ReportSection>,
  granularity: ScanResult["meta"]["granularity"],
  explicitOnly: boolean,
): boolean {
  if (!includesSection(onlySet, "hotspots")) {
    return false;
  }
  return explicitOnly || granularity === "file";
}

function shouldShowFunctions(
  onlySet: ReadonlySet<ReportSection>,
  granularity: ScanResult["meta"]["granularity"],
  explicitOnly: boolean,
): boolean {
  if (!includesSection(onlySet, "functions")) {
    return false;
  }
  return explicitOnly || granularity === "function";
}

export function renderTable(
  result: ScanResult,
  options?: RenderTableOptions,
): string {
  const full = options?.fullResult ?? result;
  const onlySet = normalizeOnly(options?.only);
  const explicitOnly = options?.only !== undefined && options.only.length > 0;
  const color = options?.color ?? false;
  const summary = buildScanExecutiveSummary(full, result);
  const sections: string[] = [...summary];

  const rankingBlocks: string[] = [];

  if (shouldShowHotspots(onlySet, result.meta.granularity, explicitOnly)) {
    rankingBlocks.push(...renderHotspotsSection(result, color));
  }

  if (shouldShowFunctions(onlySet, result.meta.granularity, explicitOnly)) {
    if (rankingBlocks.length > 0) {
      rankingBlocks.push("");
    }
    rankingBlocks.push(...renderFunctionsSection(result, color));
  }

  if (includesSection(onlySet, "coupling")) {
    if (rankingBlocks.length > 0) {
      rankingBlocks.push("");
    }
    rankingBlocks.push(...renderCouplingSection(result, color));
  }

  if (rankingBlocks.length > 0) {
    sections.push("", ...rankingBlocks);
  }

  if (options?.triageHints !== false) {
    const triageLines = renderTableTriageHints(buildTriageHints(result));
    if (triageLines.length > 0) {
      sections.push("", ...triageLines);
    }
  }

  sections.push("", ...renderTableGlossary());

  return sections.join("\n");
}
