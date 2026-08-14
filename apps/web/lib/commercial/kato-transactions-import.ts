/**
 * Map Kato sale/letting transaction exports into commercial_leases rows.
 */

export const KATO_TRANSACTIONS_IMPORT_SOURCE = 'kato_transactions_xlsx_202608';

export type LeaseTransactionKind = 'letting' | 'sale';
export type LeaseImportStatus =
  | 'active'
  | 'expired'
  | 'terminated'
  | 'completed';

export type KatoTransactionImportRow = {
  externalId: string;
  transactionKind: LeaseTransactionKind;
  propertyLabel: string;
  town: string | null;
  postcode: string | null;
  tenantName: string | null;
  headlineRentPsf: number | null;
  headlinePricePence: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  status: LeaseImportStatus;
  notes: string | null;
};

function emptyToNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === '-' || s === '—') return null;
  return s;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === '' || value === '-') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseGbpToPence(value: unknown): number | null {
  const pounds = parseNumber(value);
  if (pounds == null) return null;
  return Math.round(pounds * 100);
}

function parseDate(value: unknown): string | null {
  const raw = emptyToNull(value);
  if (!raw) return null;
  // Already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function propertyLabel(row: Record<string, unknown>): string {
  return (
    emptyToNull(row['Property']) ||
    emptyToNull(row['Address line 1']) ||
    [emptyToNull(row['Town']), emptyToNull(row['Postcode'])]
      .filter(Boolean)
      .join(', ') ||
    'Untitled property'
  );
}

function buildNotes(
  parts: Array<[string, string | null | undefined]>,
): string | null {
  const lines = parts
    .map(([label, value]) => {
      const v = emptyToNull(value);
      return v ? `${label}: ${v}` : null;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

function mapLettingStatus(
  statusRaw: string | null,
  leaseEnd: string | null,
): LeaseImportStatus {
  const s = (statusRaw ?? '').toLowerCase();
  if (s.includes('terminat')) return 'terminated';
  if (s.includes('expir')) return 'expired';
  if (s.includes('complet') || s.includes('exchanged')) {
    if (leaseEnd) {
      const end = new Date(leaseEnd).getTime();
      if (Number.isFinite(end) && end < Date.now()) return 'expired';
    }
    return 'completed';
  }
  if (leaseEnd) {
    const end = new Date(leaseEnd).getTime();
    if (Number.isFinite(end) && end < Date.now()) return 'expired';
  }
  return 'active';
}

export function mapKatoSaleRow(
  row: Record<string, unknown>,
): KatoTransactionImportRow | null {
  const id = emptyToNull(row['ID']);
  if (!id) return null;
  const completion = parseDate(row['Completion Date']);
  const purchaser = emptyToNull(row['Purchaser']);
  const vendor = emptyToNull(row['Vendor']);
  const pricePence = parseGbpToPence(row['Headline Price']);

  return {
    externalId: `${KATO_TRANSACTIONS_IMPORT_SOURCE}:sale:${id}`,
    transactionKind: 'sale',
    propertyLabel: propertyLabel(row),
    town: emptyToNull(row['Town']),
    postcode: emptyToNull(row['Postcode']),
    tenantName: purchaser,
    headlineRentPsf: parseNumber(row['Price (psf)']),
    headlinePricePence: pricePence,
    leaseStart: completion,
    leaseEnd: null,
    status: 'completed',
    notes: buildNotes([
      ['Kato ID', id],
      ['Tenure', emptyToNull(row['Tenure'])],
      ['Property type', emptyToNull(row['Property Type'])],
      ['Vendor', vendor],
      ['Purchaser', purchaser],
      ['Vendor agents', emptyToNull(row['Vendor Agents'])],
      ['Purchaser agents', emptyToNull(row['Purchaser Agents'])],
      ['Size', emptyToNull(row['Size'])],
      ['Investment', emptyToNull(row['Investment'])],
      ['Assignees', emptyToNull(row['Assignees'])],
      ['Source', emptyToNull(row['Source'])],
    ]),
  };
}

export function mapKatoLettingRow(
  row: Record<string, unknown>,
): KatoTransactionImportRow | null {
  const id = emptyToNull(row['ID']);
  if (!id) return null;
  const leaseStart =
    parseDate(row['Lease Start']) || parseDate(row['Transaction Date']);
  const leaseEnd =
    parseDate(row['Lease End']) || parseDate(row['Lease Expiry']);
  const tenant = emptyToNull(row['Tenant']);
  const status = mapLettingStatus(emptyToNull(row['Status']), leaseEnd);

  return {
    externalId: `${KATO_TRANSACTIONS_IMPORT_SOURCE}:letting:${id}`,
    transactionKind: 'letting',
    propertyLabel: propertyLabel(row),
    town: emptyToNull(row['Town']),
    postcode: emptyToNull(row['Postcode']),
    tenantName: tenant,
    headlineRentPsf: parseNumber(row['Headline Rent (psf)']),
    headlinePricePence: null,
    leaseStart,
    leaseEnd,
    status,
    notes: buildNotes([
      ['Kato ID', id],
      ['Lease type', emptyToNull(row['Lease Type'])],
      ['Property type', emptyToNull(row['Property Type'])],
      ['Landlord', emptyToNull(row['Landlord'])],
      ['Landlord agent', emptyToNull(row["Landlord's Agent"])],
      ['Tenant agent', emptyToNull(row["Tenant's Agent"])],
      ['Headline rent', emptyToNull(row['Headline Rent'])],
      ['Headline rent pa', emptyToNull(row['Headline Rent (pa)'])],
      ['Size', emptyToNull(row['Size'])],
      ['Assignee', emptyToNull(row['Assignee'])],
      ['Source', emptyToNull(row['Source'])],
    ]),
  };
}

export function mapKatoTransactionFiles(input: {
  sales?: Record<string, unknown>[];
  lettings?: Record<string, unknown>[];
}): KatoTransactionImportRow[] {
  const out: KatoTransactionImportRow[] = [];
  for (const row of input.sales ?? []) {
    const mapped = mapKatoSaleRow(row);
    if (mapped) out.push(mapped);
  }
  for (const row of input.lettings ?? []) {
    const mapped = mapKatoLettingRow(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
