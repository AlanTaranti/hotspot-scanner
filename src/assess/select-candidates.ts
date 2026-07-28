import type { HotspotScore } from "#types";

function compareHotspotScores(left: HotspotScore, right: HotspotScore): number {
  if (right.hotspotScore !== left.hotspotScore) {
    return right.hotspotScore - left.hotspotScore;
  }

  return left.filePath.localeCompare(right.filePath);
}

export function selectAssessCandidates(
  hotspots: ReadonlyArray<HotspotScore>,
  options: { minHotspotScore: number; top: number },
): HotspotScore[] {
  return hotspots
    .filter((hotspot) => hotspot.hotspotScore >= options.minHotspotScore)
    .sort(compareHotspotScores)
    .slice(0, options.top);
}
