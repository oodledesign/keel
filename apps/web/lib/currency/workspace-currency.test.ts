import { describe, expect, it } from 'vitest';

import { formatInvoiceMoney } from '~/home/[account]/invoices/_lib/invoice-currency';

import { formatWorkspaceMoney } from './workspace-currency';

describe('formatWorkspaceMoney', () => {
  it('formats each supported invoice currency from the stored code', () => {
    expect(formatWorkspaceMoney(19500, 'gbp')).toBe('£195.00');
    expect(formatWorkspaceMoney(19500, 'cad')).toBe('CA$195.00');
    expect(formatWorkspaceMoney(19500, 'usd')).toBe('US$195.00');
    expect(formatWorkspaceMoney(19500, 'eur')).toBe('€195.00');
    expect(formatWorkspaceMoney(19500, 'aud')).toBe('A$195.00');
    expect(formatWorkspaceMoney(19500, 'nzd')).toBe('NZ$195.00');
  });

  it('accepts uppercase currency codes stored on an invoice', () => {
    expect(formatWorkspaceMoney(19500, 'CAD')).toBe('CA$195.00');
  });

  it('is the formatter used for invoice email totals', () => {
    expect(formatInvoiceMoney(19500, 'cad')).toBe(
      formatWorkspaceMoney(19500, 'cad'),
    );
    expect(formatInvoiceMoney(19500, 'gbp')).toBe('£195.00');
  });
});
