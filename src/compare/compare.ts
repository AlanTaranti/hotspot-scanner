import type {
  CompareResult,
  FunctionCompareSection,
  FunctionHotspotScore,
  HotspotCompareSection,
  HotspotScore,
  RankChange,
  ScanResult,
  ScanWarning,
} from "../types/index.js";
import { functionKey, hotspotKey } from "./keys.js";

export class CompareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompareError";
  }
}

const EMPTY_HOTSPOT_SECTION: HotspotCompareSection = {
  new: [],
  removed: [],
  rankChanged: [],
};

const EMPTY_FUNCTION_SECTION: FunctionCompareSection = {
  new: [],
  removed: [],
  rankChanged: [],
};

interface RankedEntity<T> {
  entity: T;
  rank: number;
}

function buildRankMap<T>(
  items: T[],
  keyFn: (item: T) => string,
): Map<string, RankedEntity<T>> {
  const map = new Map<string, RankedEntity<T>>();
  for (const [index, entity] of items.entries()) {
    map.set(keyFn(entity), { entity, rank: index + 1 });
  }
  return map;
}

function compareRankedSections<T>(
  baselineItems: T[],
  currentItems: T[],
  keyFn: (item: T) => string,
): {
  new: T[];
  removed: T[];
  rankChanged: RankChange<T>[];
} {
  const baselineMap = buildRankMap(baselineItems, keyFn);
  const currentMap = buildRankMap(currentItems, keyFn);

  const removed: T[] = [];
  const rankChanged: RankChange<T>[] = [];

  for (const [key, baselineEntry] of baselineMap) {
    const currentEntry = currentMap.get(key);
    if (currentEntry === undefined) {
      removed.push(baselineEntry.entity);
      continue;
    }
    if (baselineEntry.rank !== currentEntry.rank) {
      rankChanged.push({
        entity: baselineEntry.entity,
        baselineRank: baselineEntry.rank,
        currentRank: currentEntry.rank,
        rankDelta: currentEntry.rank - baselineEntry.rank,
      });
    }
  }

  const newItems: T[] = [];
  for (const [key, currentEntry] of currentMap) {
    if (!baselineMap.has(key)) {
      newItems.push(currentEntry.entity);
    }
  }

  removed.sort(
    (left, right) =>
      baselineMap.get(keyFn(left))!.rank - baselineMap.get(keyFn(right))!.rank,
  );
  newItems.sort(
    (left, right) =>
      currentMap.get(keyFn(left))!.rank - currentMap.get(keyFn(right))!.rank,
  );
  rankChanged.sort((left, right) => {
    const deltaDiff = Math.abs(right.rankDelta) - Math.abs(left.rankDelta);
    if (deltaDiff !== 0) {
      return deltaDiff;
    }
    return keyFn(left.entity).localeCompare(keyFn(right.entity));
  });

  return { new: newItems, removed, rankChanged };
}

function compareHotspots(
  baseline: HotspotScore[],
  current: HotspotScore[],
): HotspotCompareSection {
  return compareRankedSections(baseline, current, (item) =>
    hotspotKey(item.filePath),
  );
}

function compareFunctions(
  baseline: FunctionHotspotScore[],
  current: FunctionHotspotScore[],
): FunctionCompareSection {
  return compareRankedSections(baseline, current, (item) =>
    functionKey(item.filePath, item.functionName, item.line),
  );
}

export function compareScanResults(
  baseline: ScanResult,
  current: ScanResult,
): CompareResult {
  if (baseline.meta.granularity !== current.meta.granularity) {
    throw new CompareError(
      `Granularity mismatch: baseline is "${baseline.meta.granularity}" but current scan is "${current.meta.granularity}".`,
    );
  }

  const warnings: ScanWarning[] = [];
  if (baseline.meta.since !== current.meta.since) {
    warnings.push({
      severity: "warning",
      code: "COMPARE_SINCE_MISMATCH",
      message: `Baseline and current use different --since windows (baseline: "${baseline.meta.since}", current: "${current.meta.since}").`,
    });
  }

  const granularity = baseline.meta.granularity;
  const hotspots =
    granularity === "file"
      ? compareHotspots(baseline.hotspots, current.hotspots)
      : EMPTY_HOTSPOT_SECTION;
  const functions =
    granularity === "function"
      ? compareFunctions(baseline.functions, current.functions)
      : EMPTY_FUNCTION_SECTION;

  return {
    version: "2.0",
    granularity,
    hotspots,
    functions,
    meta: {
      baseline: { ...baseline.meta },
      current: { ...current.meta },
      warnings,
    },
  };
}
