import { describe, expect, it } from 'vitest';

import { sanitizePdfText } from './pdf-text';

describe('sanitizePdfText', () => {
  it('replaces arrows and multiplication signs', () => {
    expect(sanitizePdfText('6 videos → Ozer')).toBe('6 videos -> Ozer');
    expect(sanitizePdfText('3 fields × 2 forms')).toBe('3 fields x 2 forms');
  });

  it('replaces dashes and ellipsis', () => {
    expect(sanitizePdfText('—')).toBe('-');
    expect(sanitizePdfText('Wait…')).toBe('Wait...');
  });
});
