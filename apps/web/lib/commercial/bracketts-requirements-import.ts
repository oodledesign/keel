/**
 * Parse Bracketts "All requirements" sheet into contacts / businesses / requirements.
 */

import {
  type RequirementUseClass,
  inferRequirementUseClass,
} from './requirement-use-class';

export const BRACKETTS_REQUIREMENTS_IMPORT_SOURCE =
  'bracketts_requirements_csv_202602';

export type ParsedRequirementRow = {
  importKey: string;
  rowIndex: number;
  dateIso: string | null;
  companyName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  useRaw: string | null;
  useClass: RequirementUseClass | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  sizeRaw: string | null;
  locationText: string | null;
  detailsSent: string | null;
  notes: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function parseUkDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function parseTenure(raw: string): 'rent' | 'buy' | 'both' | null {
  const t = raw.trim().toLowerCase();
  if (!t || t === 'open') return null;
  const hasFh = /\bfh\b|freehold/.test(t);
  const hasLh = /\blh\b|leasehold/.test(t);
  if (hasFh && hasLh) return 'both';
  if (hasFh) return 'buy';
  if (hasLh) return 'rent';
  return null;
}

function parseSizeRange(raw: string): {
  min: number | null;
  max: number | null;
} {
  const cleaned = raw.replace(/,/g, '').toLowerCase();
  const nums = [...cleaned.matchAll(/(\d+(?:\.\d+)?)\s*(?:k)?/g)].map((m) => {
    let n = Number(m[1]);
    if (/k/.test(m[0]) && n < 1000) n *= 1000;
    return n;
  });
  if (nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function firstEmail(raw: string): string | null {
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? null;
}

function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  if (!t || /unknown|not provided|n\/a/i.test(t)) return null;
  return t.replace(/\s+/g, ' ');
}

function sectorFromUseClass(useClass: RequirementUseClass | null): string | null {
  if (!useClass) return null;
  switch (useClass) {
    case 'class_b':
      return 'Industrial';
    case 'class_e':
      return 'Retail / Offices';
    case 'land':
      return 'Land';
    case 'investment':
      return 'Investment';
    case 'development':
      return 'Development';
    case 'sui_generis':
      return 'Sui Generis';
    case 'pending':
      return 'Pending';
    default:
      return null;
  }
}

/**
 * CSV layout (Sheet 1): legend rows, then header with Date/Company/…,
 * then data. Column indices are resolved from the header (supports a
 * leading empty column as in the exported sheet).
 */
export function parseBrackettsRequirementsCsv(
  csvText: string,
): ParsedRequirementRow[] {
  const rows = parseCsv(csvText);
  let headerIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const joined = rows[i]!.map((c) => c.trim().toLowerCase()).join('|');
    if (joined.includes('company') && joined.includes('contact name')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error('Could not find requirements header row');
  }

  const header = rows[headerIndex]!.map((c) => c.trim().toLowerCase());
  const idx = (aliases: string[]) => {
    for (const alias of aliases) {
      const found = header.findIndex(
        (h) => h === alias || h.startsWith(alias) || h.includes(alias),
      );
      if (found >= 0) return found;
    }
    return -1;
  };

  const col = {
    date: idx(['date']),
    company: idx(['company']),
    contact: idx(['contact name', 'contact']),
    tel: idx(['tel', 'phone']),
    email: idx(['email']),
    use: idx(['use']),
    tenure: idx(['fh / lh', 'fh/lh', 'tenure']),
    size: idx(['size']),
    location: idx(['location']),
    details: idx(['details sent', 'details']),
    notes: idx(['notes']),
  };

  const read = (row: string[], column: number) =>
    column >= 0 ? (row[column] ?? '').trim() : '';

  const out: ParsedRequirementRow[] = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]!;
    const dateRaw = read(row, col.date);
    const companyName = read(row, col.company) || null;
    const contactName = read(row, col.contact) || null;
    const phone = normalizePhone(read(row, col.tel));
    const email = firstEmail(read(row, col.email));
    const useRaw = read(row, col.use) || null;
    const tenureRaw = read(row, col.tenure);
    const sizeRaw = read(row, col.size) || null;
    const locationText = read(row, col.location) || null;
    const detailsSent = read(row, col.details) || null;
    const notes = read(row, col.notes) || null;

    const hasSignal = [
      dateRaw,
      companyName,
      contactName,
      phone,
      email,
      useRaw,
      notes,
    ].some(Boolean);
    if (!hasSignal) continue;

    const size = parseSizeRange(sizeRaw ?? '');
    const useClass = inferRequirementUseClass(useRaw);
    const dateIso = dateRaw ? parseUkDate(dateRaw) : null;
    const importKey = `${BRACKETTS_REQUIREMENTS_IMPORT_SOURCE}:row:${i}:${slugify(
      [companyName, contactName, email, useRaw].filter(Boolean).join('-') ||
        `r${i}`,
    )}`;

    out.push({
      importKey,
      rowIndex: i,
      dateIso,
      companyName,
      contactName,
      phone,
      email,
      useRaw,
      useClass,
      tenure: parseTenure(tenureRaw),
      sizeMinSqft: size.min,
      sizeMaxSqft: size.max,
      sizeRaw,
      locationText,
      detailsSent,
      notes,
    });
  }

  return out;
}

export function requirementSectorLabel(row: ParsedRequirementRow) {
  // Prefer the raw Use column for display; fall back to class label.
  return row.useRaw?.trim() || sectorFromUseClass(row.useClass);
}

/** Minimal CSV parser supporting quoted newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') continue;
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
