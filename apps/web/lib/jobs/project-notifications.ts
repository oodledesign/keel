import 'server-only';

import { createNotificationsApi } from '@kit/notifications/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

function truncate(value: string, max = 120) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

function jobProjectLink(accountSlug: string, jobId: string) {
  return pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId);
}

async function insertInAppNotification(params: {
  accountId: string;
  body: string;
  link: string;
  type?: 'info' | 'warning' | 'error';
}) {
  try {
    const admin = getSupabaseServerAdminClient();
    const notificationsApi = createNotificationsApi(admin);
    await notificationsApi.createNotification({
      account_id: params.accountId,
      type: params.type ?? 'info',
      channel: 'in_app',
      body: truncate(params.body, 5000),
      link: truncate(params.link, 255),
    });
  } catch (error) {
    console.warn('[project-notifications] insert failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyJobTaskAssigned(params: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  jobTitle: string;
  taskTitle: string;
  assigneeUserId: string;
  actorUserId: string;
}) {
  if (params.assigneeUserId === params.actorUserId) return;

  await insertInAppNotification({
    accountId: params.accountId,
    body: `You were assigned “${params.taskTitle}” on ${params.jobTitle}`,
    link: jobProjectLink(params.accountSlug, params.jobId),
  });
}

export async function notifyPhaseCompleted(params: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  jobTitle: string;
  phaseName: string;
}) {
  await insertInAppNotification({
    accountId: params.accountId,
    body: `Phase “${params.phaseName}” marked complete on ${params.jobTitle}`,
    link: jobProjectLink(params.accountSlug, params.jobId),
  });
}

export async function notifyPhaseDueSoon(params: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  jobTitle: string;
  phaseName: string;
  dueDate: string;
}) {
  const dueLabel = new Date(`${params.dueDate}T12:00:00`).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'short' },
  );

  await insertInAppNotification({
    accountId: params.accountId,
    type: 'warning',
    body: `Phase “${params.phaseName}” is due ${dueLabel} on ${params.jobTitle}`,
    link: jobProjectLink(params.accountSlug, params.jobId),
  });
}
