export type DiscountType = 'percent' | 'fixed';
export type DepositType = 'percent' | 'fixed';
export type LateFeeType = 'percent' | 'fixed';

export type InvoiceTotalsInput = {
  subtotal_pence: number;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  tax_rate_bp?: number | null;
  late_fee_type?: LateFeeType | null;
  late_fee_value?: number | null;
  deposit_type?: DepositType | null;
  deposit_value?: number | null;
  due_at?: string | null;
  status?: string;
};

export type InvoiceTotalsResult = {
  subtotal_pence: number;
  discount_pence: number;
  tax_pence: number;
  late_fee_pence: number;
  total_pence: number;
  deposit_due_pence: number;
  balance_due_pence: number;
};

function applyAdjustment(
  base: number,
  type: DiscountType | LateFeeType | null | undefined,
  value: number | null | undefined,
): number {
  if (!type || !value || value <= 0) return 0;
  if (type === 'percent') {
    return Math.round((base * value) / 100);
  }
  return value;
}

export function isInvoiceOverdue(input: {
  status: string;
  due_at?: string | null;
}): boolean {
  if (!['sent', 'read'].includes(input.status) || !input.due_at) return false;
  const due = new Date(input.due_at);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotalsResult {
  const subtotal_pence = Math.max(0, input.subtotal_pence ?? 0);
  const discount_pence = applyAdjustment(
    subtotal_pence,
    input.discount_type ?? null,
    input.discount_value ?? 0,
  );
  const afterDiscount = Math.max(0, subtotal_pence - discount_pence);
  const tax_pence = input.tax_rate_bp
    ? Math.round((afterDiscount * input.tax_rate_bp) / 10000)
    : 0;
  let total_pence = afterDiscount + tax_pence;

  const overdue = isInvoiceOverdue({
    status: input.status ?? 'draft',
    due_at: input.due_at,
  });
  const late_fee_pence =
    overdue && input.late_fee_type
      ? applyAdjustment(total_pence, input.late_fee_type, input.late_fee_value ?? 0)
      : 0;
  total_pence += late_fee_pence;

  let deposit_due_pence = 0;
  if (input.deposit_type && (input.deposit_value ?? 0) > 0) {
    deposit_due_pence =
      input.deposit_type === 'percent'
        ? Math.round((total_pence * (input.deposit_value ?? 0)) / 100)
        : Math.min(total_pence, input.deposit_value ?? 0);
  }

  return {
    subtotal_pence,
    discount_pence,
    tax_pence,
    late_fee_pence,
    total_pence,
    deposit_due_pence,
    balance_due_pence: total_pence,
  };
}

export function displayInvoiceStatus(input: {
  status: string;
  due_at?: string | null;
  amount_paid_pence?: number;
  total_pence?: number;
}): string {
  if (input.status === 'sent' || input.status === 'read') {
    if (isInvoiceOverdue(input)) return 'overdue';
    const paid = input.amount_paid_pence ?? 0;
    const total = input.total_pence ?? 0;
    if (paid > 0 && paid < total) return 'partial';
  }
  return input.status;
}

export function formatPence(pence: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}
