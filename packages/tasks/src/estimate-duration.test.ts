import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ESTIMATED_DURATION_MINUTES,
  estimateTaskDurationMinutes,
} from './estimate-duration';

describe('estimateTaskDurationMinutes', () => {
  it('parses an explicit duration from the title', () => {
    expect(estimateTaskDurationMinutes({ title: 'Prep deck 1h 30m' })).toBe(90);
    expect(
      estimateTaskDurationMinutes({ title: 'Call client for 45 minutes' }),
    ).toBe(45);
  });

  it('parses an explicit duration from notes when the title has none', () => {
    expect(
      estimateTaskDurationMinutes({
        title: 'Write homepage',
        notes: 'about 2 hours',
      }),
    ).toBe(120);
  });

  it('uses the email/quick/admin band when no duration phrase is present', () => {
    expect(estimateTaskDurationMinutes({ title: 'Send email to Dan' })).toBe(
      15,
    );
    expect(estimateTaskDurationMinutes({ title: 'Quick admin tidy' })).toBe(15);
  });

  it('uses the review band when no duration phrase is present', () => {
    expect(
      estimateTaskDurationMinutes({ title: 'Review the brand deck' }),
    ).toBe(45);
  });

  it('uses the design/write band when no duration phrase is present', () => {
    expect(estimateTaskDurationMinutes({ title: 'Write homepage copy' })).toBe(
      60,
    );
    expect(estimateTaskDurationMinutes({ title: 'Design shopfront' })).toBe(60);
  });

  it('prefers a parsed duration over keyword bands', () => {
    expect(
      estimateTaskDurationMinutes({ title: 'Quick email — 2 hours' }),
    ).toBe(120);
  });

  it('prefers the heavier keyword band when several match', () => {
    expect(estimateTaskDurationMinutes({ title: 'Quick design review' })).toBe(
      60,
    );
  });

  it('defaults to 30 minutes when nothing matches', () => {
    expect(estimateTaskDurationMinutes({ title: 'Catch up with Oodle' })).toBe(
      DEFAULT_ESTIMATED_DURATION_MINUTES,
    );
    expect(estimateTaskDurationMinutes({ title: '' })).toBe(
      DEFAULT_ESTIMATED_DURATION_MINUTES,
    );
  });
});
