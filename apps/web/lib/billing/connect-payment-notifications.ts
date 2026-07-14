import 'server-only';

import { createNotificationsApi } from '@kit/notifications/api';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

function truncate(value: string, max = 120) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Workspace in-app notification when a Connect client subscription payment fails.
 * No client-facing dunning email in v1 — the agency owns that conversation.
 */
export async function notifyConnectPaymentFailed(params: {
  accountId: string;
  accountSlug: string | null;
  clientId: string | null;
  websiteId: string | null;
  clientName: string;
  planName: string;
}) {
  try {
    let link = pathsConfig.app.accountClients.replace(
      '[account]',
      params.accountSlug ?? params.accountId,
    );

    if (params.websiteId && params.accountSlug) {
      link = pathsConfig.app.accountWebsiteDetail
        .replace('[account]', params.accountSlug)
        .replace('[id]', params.websiteId);
    } else if (params.clientId && params.accountSlug) {
      link = `${pathsConfig.app.accountClients.replace(
        '[account]',
        params.accountSlug,
      )}/${params.clientId}`;
    }

    const admin = getSupabaseServerAdminClient();
    const notificationsApi = createNotificationsApi(admin);
    await notificationsApi.createNotification({
      account_id: params.accountId,
      type: 'warning',
      channel: 'in_app',
      body: truncate(
        `Payment failed for ${params.clientName} — ${params.planName}`,
        5000,
      ),
      link: truncate(link, 255),
    });
  } catch (error) {
    console.warn('[connect-payment-notifications] insert failed', {
      accountId: params.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
