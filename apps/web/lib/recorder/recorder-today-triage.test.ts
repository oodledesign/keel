import { describe, expect, it } from 'vitest';

import { buildRecorderTriageSummary } from './recorder-today-triage.shared';

describe('buildRecorderTriageSummary', () => {
  it('joins real counts without inventing extras', () => {
    expect(
      buildRecorderTriageSummary({
        replyNow: 2,
        replyLater: 1,
        suggestedTasks: 4,
        meetingReview: 1,
      }),
    ).toBe(
      '3 emails need a reply · 4 suggested tasks · 1 meeting task to review',
    );
  });

  it('uses singular labels for one of each', () => {
    expect(
      buildRecorderTriageSummary({
        replyNow: 1,
        replyLater: 0,
        suggestedTasks: 1,
        meetingReview: 1,
      }),
    ).toBe(
      '1 email needs a reply · 1 suggested task · 1 meeting task to review',
    );
  });

  it('returns caught up only when every count is zero', () => {
    expect(
      buildRecorderTriageSummary({
        replyNow: 0,
        replyLater: 0,
        suggestedTasks: 0,
        meetingReview: 0,
      }),
    ).toBe('Caught up');
  });
});
