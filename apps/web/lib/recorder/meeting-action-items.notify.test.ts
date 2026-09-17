import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extractAndPersistMeetingActionItems } from './meeting-action-items';

const {
  notifyMeetingTasksReadyForReviewInApp,
  extractMeetingActionItems,
  loadAccountMembersForExtraction,
  shouldIncludeExtractedItem,
  resolveSuggestedAssigneeId,
  loadWorkspaceSchedulingSettingsForUser,
} = vi.hoisted(() => ({
  notifyMeetingTasksReadyForReviewInApp: vi.fn().mockResolvedValue(true),
  extractMeetingActionItems: vi.fn(),
  loadAccountMembersForExtraction: vi.fn(),
  shouldIncludeExtractedItem: vi.fn(),
  resolveSuggestedAssigneeId: vi.fn(),
  loadWorkspaceSchedulingSettingsForUser: vi.fn(),
}));

vi.mock('~/lib/notifications/meeting-in-app-notifications', () => ({
  notifyMeetingTasksReadyForReviewInApp,
}));

vi.mock('~/lib/recorder/meeting-action-items-extract', () => ({
  extractMeetingActionItems,
}));

vi.mock('~/lib/email-assistant/account-members', () => ({
  loadAccountMembersForExtraction,
  shouldIncludeExtractedItem,
  resolveSuggestedAssigneeId,
}));

vi.mock('~/lib/workspace-focus/load-workspace-focus-settings', () => ({
  loadWorkspaceSchedulingSettingsForUser,
}));

vi.mock('~/lib/workspace-focus', () => ({
  snapDueDateYmd: (value: string) => value,
}));

const accountId = '11111111-1111-4111-8111-111111111111';
const meetingId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';

function createAdmin(options: {
  existingCount: number;
  insertError?: { message: string } | null;
}) {
  const actionItems = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({
      error: options.insertError ?? null,
    }),
    eq: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  };
  actionItems.select.mockImplementation(() => actionItems);
  const countResult = Promise.resolve({
    count: options.existingCount,
    error: null,
  });
  // head:true count query ends at eq()
  actionItems.eq.mockReturnValue({
    ...actionItems,
    then: countResult.then.bind(countResult),
  });

  return {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: { email: 'dan@ozer.so', user_metadata: {} } },
          error: null,
        }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'meeting_action_items') return actionItems;
      if (table === 'accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { name: 'Dan', email: 'dan@ozer.so' },
            error: null,
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    _actionItems: actionItems,
  };
}

describe('extractAndPersistMeetingActionItems notifications', () => {
  beforeEach(() => {
    notifyMeetingTasksReadyForReviewInApp.mockReset().mockResolvedValue(true);
    extractMeetingActionItems.mockReset();
    loadAccountMembersForExtraction.mockReset().mockResolvedValue([]);
    shouldIncludeExtractedItem.mockReset().mockReturnValue(true);
    resolveSuggestedAssigneeId.mockReset().mockReturnValue(null);
    loadWorkspaceSchedulingSettingsForUser.mockReset().mockResolvedValue({});
  });

  it('notifies the workspace once after suggested tasks are inserted', async () => {
    extractMeetingActionItems.mockResolvedValue([
      {
        suggestedTitle: 'Send proposal',
        suggestedDescription: null,
        suggestedDueDate: null,
        suggestedDurationMinutes: 30,
        sourceExcerpt: 'Dan will send the proposal',
        taskConfidence: 0.9,
        assigneeConfidence: 0.4,
        suggestedAssigneeEmail: null,
      },
      {
        suggestedTitle: 'Book follow-up',
        suggestedDescription: null,
        suggestedDueDate: null,
        suggestedDurationMinutes: 15,
        sourceExcerpt: 'Book a follow-up',
        taskConfidence: 0.8,
        assigneeConfidence: 0.4,
        suggestedAssigneeEmail: null,
      },
    ]);

    const admin = createAdmin({ existingCount: 0 });
    const inserted = await extractAndPersistMeetingActionItems(admin as never, {
      meetingTranscriptId: meetingId,
      accountId,
      createdByUserId: userId,
      title: 'Kick-off',
      content: 'Dan will send the proposal.',
      summaryText: 'Send the proposal and book a follow-up.',
    });

    expect(inserted).toBe(2);
    expect(admin._actionItems.insert).toHaveBeenCalledTimes(1);
    expect(notifyMeetingTasksReadyForReviewInApp).toHaveBeenCalledTimes(1);
    expect(notifyMeetingTasksReadyForReviewInApp).toHaveBeenCalledWith({
      accountId,
      meetingTranscriptId: meetingId,
      meetingTitle: 'Kick-off',
      taskCount: 2,
    });
  });

  it('does not notify when action items already exist (retry)', async () => {
    const admin = createAdmin({ existingCount: 2 });
    const inserted = await extractAndPersistMeetingActionItems(admin as never, {
      meetingTranscriptId: meetingId,
      accountId,
      createdByUserId: userId,
      title: 'Kick-off',
      content: 'Already extracted',
      summaryText: null,
    });

    expect(inserted).toBe(0);
    expect(extractMeetingActionItems).not.toHaveBeenCalled();
    expect(notifyMeetingTasksReadyForReviewInApp).not.toHaveBeenCalled();
  });

  it('does not notify when extraction yields no reviewable tasks', async () => {
    extractMeetingActionItems.mockResolvedValue([]);
    const admin = createAdmin({ existingCount: 0 });

    const inserted = await extractAndPersistMeetingActionItems(admin as never, {
      meetingTranscriptId: meetingId,
      accountId,
      createdByUserId: userId,
      title: 'Kick-off',
      content: 'No actions',
      summaryText: null,
    });

    expect(inserted).toBe(0);
    expect(admin._actionItems.insert).not.toHaveBeenCalled();
    expect(notifyMeetingTasksReadyForReviewInApp).not.toHaveBeenCalled();
  });
});
