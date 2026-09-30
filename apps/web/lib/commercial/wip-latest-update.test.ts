import { describe, expect, it } from 'vitest';

import { cleanWipUpdateText } from './wip-latest-update';

describe('cleanWipUpdateText', () => {
  it('removes the import marker and collapses whitespace', () => {
    expect(
      cleanWipUpdateText(
        '[import_key:abc123]\nSpoke to   landlord\n\nawaiting EPC',
      ),
    ).toBe('Spoke to landlord awaiting EPC');
  });

  it('handles empty input', () => {
    expect(cleanWipUpdateText(null)).toBe('');
    expect(cleanWipUpdateText(undefined)).toBe('');
  });
});
