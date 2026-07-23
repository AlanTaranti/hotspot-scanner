export function escapeCsvField(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value);
  if (!needsQuotes) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

export function formatCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}
