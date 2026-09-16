import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  meetingTasksReadyForReviewBody,
  meetingTasksReviewPath,
  meetingTranscriptDetailPath,
  meetingTranscriptSyncedBody,
  notifyMeetingTasksReadyForReviewInApp,
  notifyMeetingTranscriptSyncedInApp,
} from './meeting-in-app-notifications';

const { createInAppNotification, adminFrom } = vi.hoisted(() => ({
  createInAppNotification: vi.fn().mockResolvedValue(undefined),
  adminFrom: vi.fn(),
}));

vi.mock('~/lib/notifications/create-in-app-notification', () => ({
  createInAppNotification,
}));

vi.mock('@kit/supabase/server-admin-client', () => ({
  getSupabaseServerAdminClient: () => ({ from: adminFrom }),
}));

const accountId = '11111111-1111-4111-8111-111111111111';
const meetingId = '22222222-2222-4222-8222-222222222222';

function mockLookup(options: {
  table: 'accounts' | 'notifications';
  data: unknown;
  error?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.data,
    error: options.error ?? null,
  });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  return chain;
}

describe('meeting in-app notification copy', () => {
  it('uses concise British English for a synced transcript', () => {
    expect(meetingTranscriptSyncedBody('Site visit')).toBe(
      'Meeting transcript synced: Site visit',
    );
    expect(meetingTranscriptSyncedBody('  ')).toBe(
      'Meeting transcript synced: Meeting transcript',
    );
  });

  it('batches task-review copy for one or many tasks', () => {
    expect(meetingTasksReadyForReviewBody(1, 'Kick-off')).toBe(
      '1 task ready for review from Kick-off',
    );
    expect(meetingTasksReadyForReviewBody(3, 'Kick-off')).toBe(
      '3 tasks ready for review from Kick-off',
    );
  });

  it('builds account-scoped deep links', () => {
    expect(meetingTranscriptDetailPath('oodle', meetingId)).toBe(
      `/app/oodle/meetings/${meetingId}`,
    );
    expect(meetingTasksReviewPath('oodle', meetingId)).toBe(
      `/app/oodle/tasks/review?meeting=${meetingId}`,
    );
  });
});

describe('notifyMeetingTranscriptSyncedInApp', () => {
  beforeEach(() => {
    createInAppNotification.mockReset().mockResolvedValue(undefined);
    adminFrom.mockReset();
  });

  it('notifies the workspace once with a meeting detail link', async () => {
    const notifications = mockLookup({ table: 'notifications', data: null });
    adminFrom.mockImplementation((table: string) => {
      expect(table).toBe('notifications');
      return notifications;
    });

    const fired = await notifyMeetingTranscriptSyncedInApp({
      accountId,
      accountSlug: 'oodle',
      meetingTranscriptId: meetingId,
      meetingTitle: 'Site visit',
    });

    expect(fired).toBe(true);
    expect(adminFrom).toHaveBeenCalledWith('notifications');
    expect(adminFrom).not.toHaveBeenCalledWith('accounts');
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification).toHaveBeenCalledWith({
      accountId,
      body: 'Meeting transcript synced: Site visit',
      link: `/app/oodle/meetings/${meetingId}`,
    });
  });

  it('does not re-notify the same transcript sync', async () => {
    const notifications = mockLookup({
      table: 'notifications',
      data: { id: 9 },
    });
    adminFrom.mockReturnValue(notifications);

    const fired = await notifyMeetingTranscriptSyncedInApp({
      accountId,
      accountSlug: 'oodle',
      meetingTranscriptId: meetingId,
      meetingTitle: 'Site visit',
    });

    expect(fired).toBe(false);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  it('skips rather than insert a linkless notification when the slug is unknown', async () => {
    const accounts = mockLookup({ table: 'accounts', data: { slug: null } });
    adminFrom.mockReturnValue(accounts);

    const fired = await notifyMeetingTranscriptSyncedInApp({
      accountId,
      meetingTranscriptId: meetingId,
      meetingTitle: 'Weekly review',
    });

    expect(fired).toBe(false);
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(adminFrom).not.toHaveBeenCalledWith('notifications');
  });

  it('looks up the workspace slug when the caller omits it', async () => {
    const accounts = mockLookup({
      table: 'accounts',
      data: { slug: 'oodle' },
    });
    const notifications = mockLookup({ table: 'notifications', data: null });
    adminFrom.mockImplementation((table: string) =>
      table === 'accounts' ? accounts : notifications,
    );

    await notifyMeetingTranscriptSyncedInApp({
      accountId,
      meetingTranscriptId: meetingId,
      meetingTitle: 'Weekly review',
    });

    expect(adminFrom).toHaveBeenCalledWith('accounts');
    expect(createInAppNotification).toHaveBeenCalledWith({
      accountId,
      body: 'Meeting transcript synced: Weekly review',
      link: `/app/oodle/meetings/${meetingId}`,
    });
  });
});

describe('notifyMeetingTasksReadyForReviewInApp', () => {
  beforeEach(() => {
    createInAppNotification.mockReset().mockResolvedValue(undefined);
    adminFrom.mockReset();
  });

  it('does not fire when no tasks were inserted', async () => {
    const fired = await notifyMeetingTasksReadyForReviewInApp({
      accountId,
      accountSlug: 'oodle',
      meetingTranscriptId: meetingId,
      meetingTitle: 'Kick-off',
      taskCount: 0,
    });

    expect(fired).toBe(false);
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it('skips when the workspace slug cannot be resolved', async () => {
    adminFrom.mockReturnValue(
      mockLookup({ table: 'accounts', data: { slug: null } }),
    );

    const fired = await notifyMeetingTasksReadyForReviewInApp({
      accountId,
      meetingTranscriptId: meetingId,
      meetingTitle: 'Kick-off',
      taskCount: 2,
    });

    expect(fired).toBe(false);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  it('notifies once with a batched body and task-review deep link', async () => {
    const notifications = mockLookup({ table: 'notifications', data: null });
    adminFrom.mockReturnValue(notifications);

    const fired = await notifyMeetingTasksReadyForReviewInApp({
      accountId,
      accountSlug: 'oodle',
      meetingTranscriptId: meetingId,
      meetingTitle: 'Kick-off',
      taskCount: 3,
    });

    expect(fired).toBe(true);
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification).toHaveBeenCalledWith({
      accountId,
      body: '3 tasks ready for review from Kick-off',
      link: `/app/oodle/tasks/review?meeting=${meetingId}`,
    });
  });

  it('does not re-notify the same meeting task batch', async () => {
    adminFrom.mockReturnValue(
      mockLookup({ table: 'notifications', data: { id: 12 } }),
    );

    const fired = await notifyMeetingTasksReadyForReviewInApp({
      accountId,
      accountSlug: 'oodle',
      meetingTranscriptId: meetingId,
      meetingTitle: 'Kick-off',
      taskCount: 2,
    });

    expect(fired).toBe(false);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});
