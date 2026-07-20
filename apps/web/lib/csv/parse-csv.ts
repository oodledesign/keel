/**
 * Parse CSV text into headers and data rows.
 * Handles quoted fields with commas; strips wrapping quotes from headers.
 */
export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]!).map((h) =>
    h.trim().replace(/^"|"$/g, ''),
  );

  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur.trim());
  return parts;
}
