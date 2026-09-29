import { describe, expect, it } from 'vitest';

import {
  formatInvoiceItemsLine,
  summarizeInvoicePurchase,
} from './invoice-purchase-summary';

describe('summarizeInvoicePurchase', () => {
  it('detects credit top-ups with their expiry', () => {
    expect(
      summarizeInvoicePurchase({
        credit_topup_units: 80,
        credit_grant_source: 'topup_purchase',
        credit_topup_expiry_months: 6,
      }),
    ).toEqual({ kind: 'credit_topup', credits: 80, expiryMonths: 6 });
  });

  it('defaults top-up expiry to 6 months', () => {
    expect(summarizeInvoicePurchase({ credit_topup_units: 40 })).toEqual({
      kind: 'credit_topup',
      credits: 40,
      expiryMonths: 6,
    });
  });

  it('detects retainer credit invoices', () => {
    expect(
      summarizeInvoicePurchase({
        credit_grant_source: 'retainer_grant',
        credits_per_cycle: 20,
      }),
    ).toEqual({ kind: 'retainer_credits', credits: 20 });
  });

  it('treats everything else as a standard invoice', () => {
    expect(summarizeInvoicePurchase(null)).toEqual({ kind: 'standard' });
    expect(summarizeInvoicePurchase({ credit_topup_units: 0 })).toEqual({
      kind: 'standard',
    });
  });
});

describe('formatInvoiceItemsLine', () => {
  it('lists up to three items then counts the rest', () => {
    expect(formatInvoiceItemsLine(['A', ' B ', null, 'C', 'D', 'E'])).toBe(
      'A, B, C +2 more',
    );
  });

  it('returns null without descriptions', () => {
    expect(formatInvoiceItemsLine([null, '  '])).toBeNull();
  });
});
