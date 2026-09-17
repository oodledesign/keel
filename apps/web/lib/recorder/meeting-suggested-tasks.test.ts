import { describe, expect, it, vi } from 'vitest';

import {
  MEETING_SUGGESTED_TASK_PENDING_STATUS,
  MEETING_VISIBLE_SUGGESTED_TASK_STATUSES,
  insertPendingMeetingSuggestedTasks,
  isDuplicateSuggestedTaskTitle,
  listPendingMeetingSuggestedTasks,
  meetingHasPendingSuggestedTasks,
  mergeNewMeetingSuggestedTasks,
  normalizeSuggestedTaskTitle,
} from './meeting-suggested-tasks';

const accountId = '11111111-1111-4111-8111-111111111111';
const meetingId = '22222222-2222-4222-8222-222222222222';

function pendingRow(title = 'Send proposal') {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    meeting_transcript_id: meetingId,
    suggested_title: title,
    suggested_description: 'Follow up with the deck',
    suggested_due_date: '2026-09-20',
    suggested_duration_minutes: 30,
    suggested_assignee_id: null,
    assignee_confidence: 0.4,
    source_excerpt: 'Dan will send the proposal',
    status: MEETING_SUGGESTED_TASK_PENDING_STATUS,
    planner_task_id: null,
    created_at: '2026-09-17T10:00:00Z',
  };
}

describe('suggested task title matching', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeSuggestedTaskTitle('  Send   Proposal ')).toBe(
      'send proposal',
    );
  });

  it('detects duplicate titles against the existing pool', () => {
    expect(
      isDuplicateSuggestedTaskTitle('Send proposal', ['Send  Proposal']),
    ).toBe(true);
    expect(
      isDuplicateSuggestedTaskTitle('Book follow-up', ['Send proposal']),
    ).toBe(false);
  });
});

describe('listPendingMeetingSuggestedTasks', () => {
  it('queries the shared pending-review pool for a meeting', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [pendingRow()],
        error: null,
      }),
    };
    const client = {
      from: vi.fn(() => query),
    };

    const rows = await listPendingMeetingSuggestedTasks(client as never, {
      accountId,
      meetingTranscriptId: meetingId,
    });

    expect(client.from).toHaveBeenCalledWith('meeting_action_items');
    expect(query.eq).toHaveBeenCalledWith('account_id', accountId);
    expect(query.in).toHaveBeenCalledWith('status', [
      MEETING_SUGGESTED_TASK_PENDING_STATUS,
    ]);
    expect(query.eq).toHaveBeenCalledWith('meeting_transcript_id', meetingId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.suggested_title).toBe('Send proposal');
    expect(rows[0]?.status).toBe(MEETING_SUGGESTED_TASK_PENDING_STATUS);
  });
});

describe('meetingHasPendingSuggestedTasks', () => {
  it('is true when the meeting already has pending-review rows', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const countResult = Promise.resolve({ count: 2, error: null });
    query.eq.mockReturnValue({
      ...query,
      then: countResult.then.bind(countResult),
    });

    const client = { from: vi.fn(() => query) };
    await expect(
      meetingHasPendingSuggestedTasks(client as never, {
        accountId,
        meetingTranscriptId: meetingId,
      }),
    ).resolves.toBe(true);
    expect(query.eq).toHaveBeenCalledWith(
      'status',
      MEETING_SUGGESTED_TASK_PENDING_STATUS,
    );
  });
});

describe('insertPendingMeetingSuggestedTasks', () => {
  it('writes suggested tasks as pending_review', async () => {
    const inserted = pendingRow();
    const query = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [inserted],
        error: null,
      }),
    };
    const client = { from: vi.fn(() => query) };

    const rows = await insertPendingMeetingSuggestedTasks(client as never, {
      accountId,
      meetingTranscriptId: meetingId,
      items: [
        {
          suggestedTitle: 'Send proposal',
          suggestedDescription: 'Follow up with the deck',
          suggestedDueDate: '2026-09-20',
          suggestedDurationMinutes: 30,
          suggestedAssigneeId: null,
          sourceExcerpt: 'Dan will send the proposal',
        },
      ],
    });

    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        account_id: accountId,
        meeting_transcript_id: meetingId,
        suggested_title: 'Send proposal',
        status: MEETING_SUGGESTED_TASK_PENDING_STATUS,
      }),
    ]);
    expect(rows[0]?.id).toBe(inserted.id);
  });
});

describe('mergeNewMeetingSuggestedTasks', () => {
  it('skips titles that already exist in the shared pool', async () => {
    const listQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [pendingRow('Send proposal')],
        error: null,
      }),
    };
    const client = { from: vi.fn(() => listQuery) };

    const result = await mergeNewMeetingSuggestedTasks(client as never, {
      accountId,
      meetingTranscriptId: meetingId,
      items: [
        {
          suggestedTitle: 'Send proposal',
          suggestedDescription: null,
          suggestedDueDate: null,
          suggestedDurationMinutes: null,
          suggestedAssigneeId: null,
        },
      ],
    });

    expect(result.inserted).toEqual([]);
    expect(result.skippedDuplicates).toBe(1);
    expect(listQuery.in).toHaveBeenCalledWith('status', [
      ...MEETING_VISIBLE_SUGGESTED_TASK_STATUSES,
    ]);
  });
});
