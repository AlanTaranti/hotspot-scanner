export function functionStatsKey(
  filePath: string,
  functionName: string,
  line: number,
): string {
  return `${filePath}\0${functionName}\0${line}`;
}

export function parseFunctionStatsKey(key: string): {
  filePath: string;
  functionName: string;
  line: number;
} {
  const [filePath, functionName, lineRaw] = key.split("\0");
  return {
    filePath: filePath!,
    functionName: functionName!,
    line: Number(lineRaw),
  };
}
