export type InvoiceQuantityLabel = 'quantity' | 'hours';
export type InvoiceLineType = InvoiceQuantityLabel;

export function normalizeInvoiceQuantityLabel(
  value: string | null | undefined,
): InvoiceQuantityLabel {
  return value === 'hours' ? 'hours' : 'quantity';
}

export function normalizeInvoiceLineType(
  value: string | null | undefined,
): InvoiceLineType {
  return normalizeInvoiceQuantityLabel(value);
}

export function invoiceQuantityColumnLabel(
  label: InvoiceQuantityLabel,
): string {
  return label === 'hours' ? 'Hours' : 'Quantity';
}

export function invoiceLineQuantityColumnLabel(
  lineType: InvoiceLineType,
): string {
  return invoiceQuantityColumnLabel(lineType);
}

export function invoiceQuantityColumnHeaderPdf(
  label: InvoiceQuantityLabel,
): string {
  return label === 'hours' ? 'HOURS' : 'QTY';
}

export function invoiceLineShowsUnitPrice(lineType: InvoiceLineType): boolean {
  return lineType !== 'hours';
}

export function invoiceItemsQuantityHeader(
  items: Array<{ line_type?: string | null }>,
): string {
  const hasHours = items.some(
    (item) => normalizeInvoiceLineType(item.line_type) === 'hours',
  );
  const hasQuantity = items.some(
    (item) => normalizeInvoiceLineType(item.line_type) !== 'hours',
  );

  if (hasHours && hasQuantity) return 'Qty / Hours';
  if (hasHours) return 'Hours';
  return 'Quantity';
}

export function invoiceItemsShowUnitPriceColumn(
  items: Array<{ line_type?: string | null }>,
): boolean {
  return items.some((item) => invoiceLineShowsUnitPrice(item.line_type));
}

/** Coerce Postgres / JSON numeric values to whole pence. */
export function normalizePence(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
}

/** Hours lines bill using the workspace hourly rate when no explicit rate is set. */
export function resolveHoursLineUnitPricePence(
  unitPricePence: number,
  defaultHourlyRatePence: number | null | undefined,
): number {
  const explicit = normalizePence(unitPricePence) ?? 0;
  if (explicit > 0) return explicit;
  return normalizePence(defaultHourlyRatePence) ?? 0;
}

export function resolveInvoiceLineUnitPricePence(input: {
  lineType: InvoiceLineType;
  unitPricePence: number;
  defaultHourlyRatePence?: number | null;
}): number {
  if (input.lineType === 'hours') {
    return resolveHoursLineUnitPricePence(
      input.unitPricePence,
      input.defaultHourlyRatePence,
    );
  }
  return normalizePence(input.unitPricePence) ?? 0;
}

/** Clamp and round quantity to two decimal places. */
export function normalizeInvoiceQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 100) / 100;
}

export function parseInvoiceQuantityInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return normalizeInvoiceQuantity(parsed);
}

/** Display quantity with up to two decimal places. */
export function formatInvoiceQuantity(value: number): string {
  const normalized = normalizeInvoiceQuantity(value);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

export function calculateInvoiceLineTotalPence(
  quantity: number,
  unitPricePence: number,
): number {
  return Math.round(normalizeInvoiceQuantity(quantity) * unitPricePence);
}
