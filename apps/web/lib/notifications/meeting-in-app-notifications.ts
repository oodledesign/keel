import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

function fallbackMeetingTitle(title?: string | null) {
  const trimmed = title?.trim();
  return trimmed || 'Meeting transcript';
}

export function meetingTranscriptDetailPath(
  accountSlug: string,
  meetingTranscriptId: string,
) {
  return pathsConfig.app.accountMeetingDetail
    .replace('[account]', accountSlug)
    .replace('[transcriptId]', meetingTranscriptId);
}

export function meetingTasksReviewPath(
  accountSlug: string,
  meetingTranscriptId: string,
) {
  return `${pathsConfig.app.accountTasksReview.replace('[account]', accountSlug)}?meeting=${encodeURIComponent(meetingTranscriptId)}`;
}

export function meetingTranscriptSyncedBody(title?: string | null) {
  return `Meeting transcript synced: ${fallbackMeetingTitle(title)}`;
}

export function meetingTasksReadyForReviewBody(
  taskCount: number,
  title?: string | null,
) {
  const meetingTitle = fallbackMeetingTitle(title);
  if (taskCount === 1) {
    return `1 task ready for review from ${meetingTitle}`;
  }
  return `${taskCount} tasks ready for review from ${meetingTitle}`;
}

async function resolveAccountSlug(
  accountId: string,
  accountSlug?: string | null,
): Promise<string | null> {
  const trimmed = accountSlug?.trim();
  if (trimmed) return trimmed;

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    console.warn('[meeting-in-app-notification] slug lookup failed', {
      accountId,
      error: error.message,
    });
    return null;
  }

  const slug = (data as { slug?: string | null } | null)?.slug?.trim();
  return slug || null;
}

async function notificationExistsForLink(
  accountId: string,
  link: string,
): Promise<boolean> {
  try {
    const admin = getSupabaseServerAdminClient();
    const { data, error } = await admin
      .from('notifications')
      .select('id')
      .eq('account_id', accountId)
      .eq('link', link)
      .limit(1)
      .maybeSingle();

    if (error) {
      return false;
    }

    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Workspace in-app notification when a meeting transcript first lands.
 * Always-on (no mute preference yet — add a key later if needed).
 */
export async function notifyMeetingTranscriptSyncedInApp(params: {
  accountId: string;
  meetingTranscriptId: string;
  meetingTitle?: string | null;
  accountSlug?: string | null;
}): Promise<boolean> {
  try {
    const slug = await resolveAccountSlug(params.accountId, params.accountSlug);
    if (!slug) {
      // Canonical deep-link is required for idempotency; skip rather than
      // insert an un-deduplicated linkless notification.
      return false;
    }

    const link = meetingTranscriptDetailPath(slug, params.meetingTranscriptId);

    if (await notificationExistsForLink(params.accountId, link)) {
      return false;
    }

    await createInAppNotification({
      accountId: params.accountId,
      body: meetingTranscriptSyncedBody(params.meetingTitle),
      link,
    });
    return true;
  } catch (error) {
    console.warn(
      '[meeting-in-app-notification] transcript sync notify failed',
      {
        accountId: params.accountId,
        meetingTranscriptId: params.meetingTranscriptId,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return false;
  }
}

/**
 * Workspace in-app notification when suggested meeting tasks land for review.
 * One notification per meeting (link includes the transcript id). Always-on.
 */
export async function notifyMeetingTasksReadyForReviewInApp(params: {
  accountId: string;
  meetingTranscriptId: string;
  taskCount: number;
  meetingTitle?: string | null;
  accountSlug?: string | null;
}): Promise<boolean> {
  if (params.taskCount < 1) {
    return false;
  }

  try {
    const slug = await resolveAccountSlug(params.accountId, params.accountSlug);
    if (!slug) {
      return false;
    }

    const link = meetingTasksReviewPath(slug, params.meetingTranscriptId);

    if (await notificationExistsForLink(params.accountId, link)) {
      return false;
    }

    await createInAppNotification({
      accountId: params.accountId,
      body: meetingTasksReadyForReviewBody(
        params.taskCount,
        params.meetingTitle,
      ),
      link,
    });
    return true;
  } catch (error) {
    console.warn('[meeting-in-app-notification] task review notify failed', {
      accountId: params.accountId,
      meetingTranscriptId: params.meetingTranscriptId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
