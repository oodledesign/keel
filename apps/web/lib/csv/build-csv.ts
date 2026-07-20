/**
 * Escape a cell and join rows into a downloadable CSV string.
 */
export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvDocument(headers: string[], rows: string[][]): string {
  return (
    [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n') + '\n'
  );
}
