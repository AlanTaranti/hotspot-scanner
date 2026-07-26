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
