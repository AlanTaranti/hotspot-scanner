/**
 * Keys are suffixes after `{stem}.` — e.g. "hotspots.csv", "meta.json",
 * "hotspots.rank-changed.csv".
 * Values are full file bodies (CSV text or JSON text), without path.
 */
export type CsvBundle = Readonly<Record<string, string>>;
