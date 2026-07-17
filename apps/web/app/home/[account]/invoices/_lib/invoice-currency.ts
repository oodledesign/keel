import { z } from 'zod';

import { formatPence } from './invoice-totals';

/** Stripe-friendly invoice currencies supported in the UI. */
export const SUPPORTED_INVOICE_CURRENCIES = [
  'gbp',
  'usd',
  'eur',
  'aud',
  'cad',
  'nzd',
  'chf',
] as const;

export type InvoiceCurrency = (typeof SUPPORTED_INVOICE_CURRENCIES)[number];

export const InvoiceCurrencySchema = z.enum(SUPPORTED_INVOICE_CURRENCIES);

export const INVOICE_CURRENCY_OPTIONS: Array<{
  value: InvoiceCurrency;
  label: string;
}> = [
  { value: 'gbp', label: 'GBP (£)' },
  { value: 'usd', label: 'USD ($)' },
  { value: 'eur', label: 'EUR (€)' },
  { value: 'aud', label: 'AUD (A$)' },
  { value: 'cad', label: 'CAD (CA$)' },
  { value: 'nzd', label: 'NZD (NZ$)' },
  { value: 'chf', label: 'CHF' },
];

const SUPPORTED_SET = new Set<string>(SUPPORTED_INVOICE_CURRENCIES);

export function isSupportedInvoiceCurrency(
  code: string | null | undefined,
): code is InvoiceCurrency {
  if (!code) return false;
  return SUPPORTED_SET.has(code.trim().toLowerCase());
}

/** Normalize to lowercase storage form; falls back to gbp if unsupported. */
export function normalizeInvoiceCurrency(
  code: string | null | undefined,
  fallback: InvoiceCurrency = 'gbp',
): InvoiceCurrency {
  if (!code) return fallback;
  const normalized = code.trim().toLowerCase();
  return isSupportedInvoiceCurrency(normalized) ? normalized : fallback;
}

export function formatInvoiceMoney(
  pence: number,
  currency: string | null | undefined = 'gbp',
): string {
  return formatPence(pence, normalizeInvoiceCurrency(currency));
}

const INVOICE_CURRENCY_SYMBOLS: Record<InvoiceCurrency, string> = {
  gbp: '£',
  usd: '$',
  eur: '€',
  aud: 'A$',
  cad: 'CA$',
  nzd: 'NZ$',
  chf: 'CHF',
};

/** Short symbol for UI labels (e.g. Fixed (£)). */
export function invoiceCurrencySymbol(
  currency: string | null | undefined,
): string {
  return INVOICE_CURRENCY_SYMBOLS[normalizeInvoiceCurrency(currency)];
}
