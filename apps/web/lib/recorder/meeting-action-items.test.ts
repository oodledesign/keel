import { describe, expect, it } from 'vitest';

import {
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from '~/lib/email-assistant/account-members';

describe('meeting action item assignee resolution', () => {
  const members = [
    { userId: 'user-recorder', name: 'Dan', email: 'dan@keelos.so' },
    { userId: 'user-sarah', name: 'Sarah', email: 'sarah@client.com' },
  ];

  it('resolves explicit account member assignee', () => {
    expect(
      resolveSuggestedAssigneeId(
        {
          suggestedAssigneeEmail: 'sarah@client.com',
          assigneeConfidence: 0.9,
        },
        members,
        'dan@keelos.so',
      ),
    ).toBe('user-sarah');
  });

  it('does not default ambiguous tasks to the recorder', () => {
    expect(
      resolveSuggestedAssigneeId(
        {
          suggestedAssigneeEmail: null,
          assigneeConfidence: 0.4,
        },
        members,
        'dan@keelos.so',
      ),
    ).toBeNull();
  });

  it('drops tasks assigned to non-members', () => {
    expect(
      shouldIncludeExtractedItem(
        {
          suggestedAssigneeEmail: 'vendor@outside.com',
          assigneeConfidence: 0.95,
        },
        members,
        'dan@keelos.so',
      ),
    ).toBe(false);
  });

  it('keeps ambiguous tasks for review', () => {
    expect(
      shouldIncludeExtractedItem(
        {
          suggestedAssigneeEmail: null,
          assigneeConfidence: 0.4,
        },
        members,
        'dan@keelos.so',
      ),
    ).toBe(true);
  });
});
