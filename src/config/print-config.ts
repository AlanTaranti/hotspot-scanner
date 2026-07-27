import type {
  MergedScanConfigWithSources,
  OptionSource,
} from "./merge-options.js";

export interface ConfigPrintJson {
  configPath: string | null;
  values: {
    since: string;
    include: string[];
    exclude: string[];
    top: number;
    concurrency: number;
  };
  sources: {
    since: OptionSource;
    include: OptionSource;
    exclude: OptionSource;
    top: OptionSource;
    concurrency: OptionSource;
  };
}

function formatPatternList(patterns: string[] | undefined): string {
  if (!patterns || patterns.length === 0) {
    return "[]";
  }
  return JSON.stringify(patterns);
}

export function toConfigPrintJson(
  result: MergedScanConfigWithSources,
): ConfigPrintJson {
  return {
    configPath: result.configPath,
    values: {
      since: result.values.since,
      include: result.values.include ?? [],
      exclude: result.values.exclude ?? [],
      top: result.values.top,
      concurrency: result.values.concurrency,
    },
    sources: result.sources,
  };
}

export function formatConfigPrintText(
  result: MergedScanConfigWithSources,
): string {
  const { values, sources, configPath } = result;
  const lines = [
    `config file: ${configPath ?? "none"}`,
    `since: ${values.since} (source: ${sources.since})`,
    `include: ${formatPatternList(values.include)} (source: ${sources.include})`,
    `exclude: ${formatPatternList(values.exclude)} (source: ${sources.exclude})`,
    `top: ${values.top} (source: ${sources.top})`,
    `concurrency: ${values.concurrency} (source: ${sources.concurrency})`,
  ];

  return `${lines.join("\n")}\n`;
}

export function formatConfigPrintJson(
  result: MergedScanConfigWithSources,
): string {
  return `${JSON.stringify(toConfigPrintJson(result), null, 2)}\n`;
}
