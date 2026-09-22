import { describe, expect, it } from 'vitest';

import {
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from '~/lib/email-assistant/account-members';

import { retainExternalMeetingAssignees } from './meeting-action-items-extract';

describe('meeting action item assignee resolution', () => {
  const members = [
    { userId: 'user-recorder', name: 'Dan', email: 'dan@ozer.so' },
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
        'dan@ozer.so',
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
        'dan@ozer.so',
      ),
    ).toBeNull();
  });

  it('drops raw non-member emails at the shared filter boundary', () => {
    expect(
      shouldIncludeExtractedItem(
        {
          suggestedAssigneeEmail: 'vendor@outside.com',
          assigneeConfidence: 0.95,
        },
        members,
        'dan@ozer.so',
      ),
    ).toBe(false);
  });

  it('keeps client commitments after external-assignee normalization', () => {
    const [normalized] = retainExternalMeetingAssignees(
      [
        {
          suggestedTitle: 'Send brand assets',
          suggestedDescription: 'Client will send assets',
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          sourceExcerpt: null,
          taskConfidence: 0.9,
          assigneeConfidence: 0.95,
          suggestedAssigneeEmail: 'vendor@outside.com',
        },
      ],
      members,
      'dan@ozer.so',
    );

    expect(normalized?.suggestedAssigneeEmail).toBeNull();
    expect(
      shouldIncludeExtractedItem(
        {
          suggestedAssigneeEmail: normalized?.suggestedAssigneeEmail ?? null,
          assigneeConfidence: normalized?.assigneeConfidence ?? null,
        },
        members,
        'dan@ozer.so',
      ),
    ).toBe(true);
  });

  it('keeps ambiguous tasks for review', () => {
    expect(
      shouldIncludeExtractedItem(
        {
          suggestedAssigneeEmail: null,
          assigneeConfidence: 0.4,
        },
        members,
        'dan@ozer.so',
      ),
    ).toBe(true);
  });
});
