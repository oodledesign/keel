import { describe, expect, it } from 'vitest';

import {
  composeContactFullName,
  isAccountantRole,
  normalizeContactRole,
} from './contact-roles';

describe('contact-roles', () => {
  it('normalizes roles to lowercase', () => {
    expect(normalizeContactRole(' Accountant ')).toBe('accountant');
    expect(normalizeContactRole('')).toBeNull();
  });

  it('detects accountant-like roles', () => {
    expect(isAccountantRole('accountant')).toBe(true);
    expect(isAccountantRole('Finance / Bookkeeping')).toBe(true);
    expect(isAccountantRole('founder')).toBe(false);
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
