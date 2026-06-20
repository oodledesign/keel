import { describe, expect, it } from 'vitest';

import {
  HIGH_CONFIDENCE_ASSIGNEE_THRESHOLD,
  isHighConfidenceMeetingSuggestion,
} from './meeting-task-confidence';

describe('meeting task publish helpers', () => {
  it('treats high-confidence assigned suggestions as bulk-approvable', () => {
    expect(
      isHighConfidenceMeetingSuggestion({
        assigneeConfidence: HIGH_CONFIDENCE_ASSIGNEE_THRESHOLD,
        suggestedAssigneeId: 'user-1',
      }),
    ).toBe(true);
  });

  it('excludes ambiguous or unassigned suggestions from bulk approve', () => {
    expect(
      isHighConfidenceMeetingSuggestion({
        assigneeConfidence: 0.9,
        suggestedAssigneeId: null,
      }),
    ).toBe(false);

    expect(
      isHighConfidenceMeetingSuggestion({
        assigneeConfidence: 0.6,
        suggestedAssigneeId: 'user-1',
      }),
    ).toBe(false);
  });
});
