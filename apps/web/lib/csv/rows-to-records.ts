export const CSV_SKIP_FIELD = '__skip__' as const;

export type CsvFieldMapping = Record<string, string>;

/**
 * Apply header→field mapping to CSV rows.
 * Skipped columns (`__skip__`) are omitted. Empty rows (all blank) are dropped.
 */
export function applyCsvColumnMapping(
  headers: string[],
  rows: string[][],
  mapping: CsvFieldMapping,
): Record<string, string>[] {
  const records: Record<string, string>[] = [];

  for (const row of rows) {
    const record: Record<string, string> = {};
    let hasValue = false;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      const field = mapping[header];
      if (!field || field === CSV_SKIP_FIELD) continue;
      const value = (row[i] ?? '').trim();
      if (value) hasValue = true;
      // Later columns win if two headers map to the same field
      record[field] = value;
    }

    if (hasValue) {
      records.push(record);
    }
  }

  return records;
}

/** Convert raw CSV rows (same order as headers) into keyed objects by header. */
export function rowsToHeaderRecords(
  headers: string[],
  rows: string[][],
): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (!header) continue;
      record[header] = (row[i] ?? '').trim();
    }
    return record;
  });
}
