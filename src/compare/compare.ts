import { getPackageVersion } from "../package-meta.js";
import type {
  CompareResult,
  HotspotCompareSection,
  HotspotScore,
  RankChange,
  ScanResult,
  ScanWarning,
} from "../types/index.js";
import { hotspotKey } from "./keys.js";

type RankChangeMetricDeltas<T> = Pick<
  RankChange<T>,
  "scoreDelta" | "nclocDelta" | "commitCountDelta"
>;

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
  metricDeltas: (baseline: T, current: T) => RankChangeMetricDeltas<T>,
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
        ...metricDeltas(baselineEntry.entity, currentEntry.entity),
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

function hotspotMetricDeltas(
  baseline: HotspotScore,
  current: HotspotScore,
): RankChangeMetricDeltas<HotspotScore> {
  return {
    scoreDelta: current.hotspotScore - baseline.hotspotScore,
    nclocDelta: current.ncloc - baseline.ncloc,
    commitCountDelta: current.commitCount - baseline.commitCount,
  };
}

function compareHotspots(
  baseline: HotspotScore[],
  current: HotspotScore[],
): HotspotCompareSection {
  return compareRankedSections(
    baseline,
    current,
    (item) => hotspotKey(item.filePath),
    hotspotMetricDeltas,
  );
}

export function compareScanResults(
  baseline: ScanResult,
  current: ScanResult,
): CompareResult {
  const warnings: ScanWarning[] = [];
  if (baseline.meta.since !== current.meta.since) {
    warnings.push({
      severity: "warning",
      code: "COMPARE_SINCE_MISMATCH",
      message: `Baseline and current use different --since windows (baseline: "${baseline.meta.since}", current: "${current.meta.since}").`,
    });
  }

  return {
    version: "3.0",
    hotspots: compareHotspots(baseline.hotspots, current.hotspots),
    meta: {
      baseline: { ...baseline.meta },
      current: { ...current.meta },
      warnings,
      scannerVersion: getPackageVersion(),
    },
  };
}
