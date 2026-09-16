import { describe, expect, it } from 'vitest';

import {
  PUBLIC_FORM_HONEYPOT_FIELD,
  isPublicFormHoneypotFilled,
} from './form-honeypot';

describe('isPublicFormHoneypotFilled', () => {
  it('rejects filled honeypot values', () => {
    expect(isPublicFormHoneypotFilled('https://spam.test')).toBe(true);
    expect(isPublicFormHoneypotFilled('  bot  ')).toBe(true);
  });

  it('allows empty or missing values', () => {
    expect(isPublicFormHoneypotFilled('')).toBe(false);
    expect(isPublicFormHoneypotFilled('   ')).toBe(false);
    expect(isPublicFormHoneypotFilled(undefined)).toBe(false);
    expect(isPublicFormHoneypotFilled(null)).toBe(false);
  });

  it('uses website as the field name', () => {
    expect(PUBLIC_FORM_HONEYPOT_FIELD).toBe('website');
  });
});
