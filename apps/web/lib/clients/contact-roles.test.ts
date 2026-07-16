import { describe, expect, it } from 'vitest';

import {
  composeContactFullName,
  formatContactRoleLabel,
  isFinanceRole,
  normalizeContactRole,
} from './contact-roles';

describe('contact-roles', () => {
  it('normalizes roles to lowercase and maps accountant → finance', () => {
    expect(normalizeContactRole(' Finance ')).toBe('finance');
    expect(normalizeContactRole('Accountant')).toBe('finance');
    expect(normalizeContactRole('')).toBeNull();
  });

  it('detects finance-like roles for invoice recipients', () => {
    expect(isFinanceRole('finance')).toBe(true);
    expect(isFinanceRole('accountant')).toBe(true);
    expect(isFinanceRole('Finance / Bookkeeping')).toBe(true);
    expect(isFinanceRole('founder')).toBe(false);
    expect(isFinanceRole('marketing')).toBe(false);
  });

  it('labels legacy accountant as Finance', () => {
    expect(formatContactRoleLabel('accountant')).toBe('Finance');
    expect(formatContactRoleLabel('marketing')).toBe('Marketing');
  });

  it('composes full names from parts', () => {
    expect(
      composeContactFullName({ firstName: 'Jane', lastName: 'Smith' }),
    ).toBe('Jane Smith');
    expect(composeContactFullName({ fullName: 'Legacy Name' })).toBe(
      'Legacy Name',
    );
  });
});
