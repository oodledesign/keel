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

/**
 * Like parseCsv, but skips title/blank preamble rows (common in Numbers/Kato
 * exports) until a row looks like a header — e.g. contains "ID" and "Address".
 */
export function parseCsvDetectingHeader(
  text: string,
  hints: string[] = ['id', 'address'],
): {
  headers: string[];
  rows: string[][];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const normalizedHints = hints.map((h) => h.toLowerCase());
  let headerIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = parseCsvLine(lines[i]!).map((h) =>
      h.trim().replace(/^"|"$/g, '').toLowerCase(),
    );
    const matched = normalizedHints.every((hint) =>
      cells.some((c) => c === hint || c.includes(hint)),
    );
    if (matched) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex >= lines.length - 1) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[headerIndex]!).map((h) =>
    h.trim().replace(/^"|"$/g, ''),
  );
  const rows = lines.slice(headerIndex + 1).map((line) => parseCsvLine(line));
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
