import { describe, expect, it } from 'vitest';

import {
  addBusinessDaysYmd,
  resolveExtractedDueDate,
} from './workspace-task-extract';

describe('addBusinessDaysYmd', () => {
  it('skips weekends', () => {
    // Friday + 1 business day = Monday
    expect(addBusinessDaysYmd('2026-06-12', 1)).toBe('2026-06-15');
    // Wednesday + 2 = Friday
    expect(addBusinessDaysYmd('2026-06-10', 2)).toBe('2026-06-12');
  });
});

describe('resolveExtractedDueDate', () => {
  it('keeps AI deadlines when present', () => {
    expect(
      resolveExtractedDueDate({
        aiDueDate: '2026-07-01',
        meetingDateYmd: '2026-06-10',
      }),
    ).toBe('2026-07-01');
  });

  it('defaults to two business days after the meeting', () => {
    expect(
      resolveExtractedDueDate({
        aiDueDate: null,
        meetingDateYmd: '2026-06-10', // Wednesday
      }),
    ).toBe('2026-06-12');
  });
});
