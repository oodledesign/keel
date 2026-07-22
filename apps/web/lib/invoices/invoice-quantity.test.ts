import { describe, expect, it } from 'vitest';

import {
  calculateInvoiceLineTotalPence,
  formatInvoiceQuantity,
  normalizeInvoiceQuantity,
  parseInvoiceQuantityInput,
} from './invoice-quantity';

describe('invoice quantity', () => {
  it('normalizes to two decimal places', () => {
    expect(normalizeInvoiceQuantity(2.555)).toBe(2.56);
    expect(normalizeInvoiceQuantity(-1)).toBe(0);
  });

  it('parses input strings', () => {
    expect(parseInvoiceQuantityInput('2.5')).toBe(2.5);
    expect(parseInvoiceQuantityInput('')).toBe(0);
  });

  it('formats without trailing zeros', () => {
    expect(formatInvoiceQuantity(2)).toBe('2');
    expect(formatInvoiceQuantity(2.5)).toBe('2.5');
    expect(formatInvoiceQuantity(2.25)).toBe('2.25');
  });

  it('calculates line totals in pence', () => {
    expect(calculateInvoiceLineTotalPence(2.5, 10000)).toBe(25000);
  });
});
