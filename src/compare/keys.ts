function canonicalPair(fileA: string, fileB: string): [string, string] {
  return fileA < fileB ? [fileA, fileB] : [fileB, fileA];
}

export function hotspotKey(filePath: string): string {
  return filePath;
}

export function functionKey(
  filePath: string,
  functionName: string,
  line: number,
): string {
  return `${filePath}\0${functionName}\0${line}`;
}

export function couplingKey(fileA: string, fileB: string): string {
  const [left, right] = canonicalPair(fileA, fileB);
  return `${left}|${right}`;
}
