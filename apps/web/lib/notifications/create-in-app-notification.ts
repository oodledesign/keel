import 'server-only';

import { createNotificationsApi } from '@kit/notifications/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

function truncate(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

export async function createInAppNotification(params: {
  accountId: string;
  body: string;
  link?: string;
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
      link: params.link ? truncate(params.link, 255) : undefined,
    });
  } catch (error) {
    console.warn('[in-app-notification] insert failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
