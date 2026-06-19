import { describe, expect, it } from 'vitest';

import {
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from './account-members';

describe('email assignee resolution', () => {
  const members = [
    { userId: 'user-owner', name: 'Dan', email: 'dan@keelos.so' },
    { userId: 'user-sarah', name: 'Sarah', email: 'sarah@client.com' },
  ];

  it('resolves a matched account member email to user id', () => {
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

  it('returns null when assignee email is missing', () => {
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

  it('drops third-party tasks that do not match account members', () => {
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

  it('keeps ambiguous mailbox-owner tasks', () => {
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
