import type { CouplingPair, StaticDependencyDirection } from "../types/index.js";

const DIRECTION_DISPLAY: Record<StaticDependencyDirection, string> = {
  none: "none",
  "a-to-b": "a→b",
  "b-to-a": "b→a",
  both: "both",
};

export function formatStaticDep(value: boolean): string {
  return value ? "yes" : "no";
}

export function formatDirection(direction: StaticDependencyDirection): string {
  return DIRECTION_DISPLAY[direction];
}

export function formatKinds(pair: CouplingPair): string {
  const kinds: string[] = [];
  if (pair.hasRuntimeStaticDependency) {
    kinds.push("runtime");
  }
  if (pair.hasTypeOnlyStaticDependency) {
    kinds.push("type");
  }
  if (pair.hasReExportStaticDependency) {
    kinds.push("re-export");
  }
  return kinds.length === 0 ? "—" : kinds.join(",");
}

export const COUPLING_ENRICHMENT_CSV_COLUMNS = [
  "staticDependencyDirection",
  "hasRuntimeStaticDependency",
  "hasTypeOnlyStaticDependency",
  "hasReExportStaticDependency",
] as const;

export function couplingEnrichmentCsvValues(pair: CouplingPair): string[] {
  return [
    pair.staticDependencyDirection,
    String(pair.hasRuntimeStaticDependency),
    String(pair.hasTypeOnlyStaticDependency),
    String(pair.hasReExportStaticDependency),
  ];
}
