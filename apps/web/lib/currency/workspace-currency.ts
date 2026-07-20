import { z } from 'zod';

import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

/** Stripe-friendly workspace currencies supported in the UI. */
export const SUPPORTED_WORKSPACE_CURRENCIES = [
  'gbp',
  'usd',
  'eur',
  'aud',
  'cad',
  'nzd',
  'chf',
] as const;

export type WorkspaceCurrency = (typeof SUPPORTED_WORKSPACE_CURRENCIES)[number];

export const WorkspaceCurrencySchema = z.enum(SUPPORTED_WORKSPACE_CURRENCIES);

export const WORKSPACE_CURRENCY_OPTIONS: Array<{
  value: WorkspaceCurrency;
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

const SUPPORTED_SET = new Set<string>(SUPPORTED_WORKSPACE_CURRENCIES);

export function isSupportedWorkspaceCurrency(
  code: string | null | undefined,
): code is WorkspaceCurrency {
  if (!code) return false;
  return SUPPORTED_SET.has(code.trim().toLowerCase());
}

/** Normalize to lowercase storage form; falls back to gbp if unsupported. */
export function normalizeWorkspaceCurrency(
  code: string | null | undefined,
  fallback: WorkspaceCurrency = 'gbp',
): WorkspaceCurrency {
  if (!code) return fallback;
  const normalized = code.trim().toLowerCase();
  return isSupportedWorkspaceCurrency(normalized) ? normalized : fallback;
}

export function formatWorkspaceMoney(
  pence: number,
  currency: string | null | undefined = 'gbp',
): string {
  return formatPence(pence, normalizeWorkspaceCurrency(currency).toUpperCase());
}

const WORKSPACE_CURRENCY_SYMBOLS: Record<WorkspaceCurrency, string> = {
  gbp: '£',
  usd: '$',
  eur: '€',
  aud: 'A$',
  cad: 'CA$',
  nzd: 'NZ$',
  chf: 'CHF',
};

/** Short symbol for UI labels (e.g. Fixed (£)). */
export function workspaceCurrencySymbol(
  currency: string | null | undefined,
): string {
  return WORKSPACE_CURRENCY_SYMBOLS[normalizeWorkspaceCurrency(currency)];
}

/** Format a whole-unit amount (properties store pence/cents). */
export function formatWorkspaceAmount(
  amountMajor: number,
  currency: string | null | undefined = 'gbp',
  options?: { maximumFractionDigits?: number },
): string {
  const code = normalizeWorkspaceCurrency(currency).toUpperCase();
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(amountMajor);
}
