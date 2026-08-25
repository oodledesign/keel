import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { ACTIONABLE_EMAIL_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';
import { wrapNotificationEmail } from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { isEmailNotificationEnabled } from '~/lib/notifications/email-notification-preferences';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  type StuckThreadDigestItem,
  buildStuckThreadDigestBodyHtml,
} from './stuck-thread-digest-email';

const STUCK_DAYS = 3;
const MAX_THREADS = 8;

function daysSince(iso: string | null): number {
  if (!iso) return STUCK_DAYS;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export async function runStuckThreadDigest(
  admin: SupabaseClient,
): Promise<{ usersNotified: number; emailsSent: number }> {
  const cutoff = new Date(
    Date.now() - STUCK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const origin = getAppSiteOrigin();

  const { data: threads, error } = await admin
    .from('email_threads')
    .select(
      'id, user_id, account_id, subject, last_message_at, client_id, connection_id',
    )
    .in('assistant_category', [...ACTIONABLE_EMAIL_CATEGORIES])
    .lt('last_message_at', cutoff)
    .order('last_message_at', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[stuck-thread-digest] load threads', error.message);
    return { usersNotified: 0, emailsSent: 0 };
  }

  const byUser = new Map<string, typeof threads>();

  for (const row of threads ?? []) {
    const userId = row.user_id as string;
    const list = byUser.get(userId) ?? [];
    list.push(row);
    byUser.set(userId, list);
  }

  let usersNotified = 0;
  let emailsSent = 0;

  for (const [userId, userThreads] of byUser) {
    const top = userThreads.slice(0, MAX_THREADS);
    const accountId = (top[0]?.account_id as string | null) ?? userId;

    const clientIds = [
      ...new Set(
        top
          .map((row) => row.client_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const clientNames = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await admin
        .from('clients')
        .select('id, name')
        .in('id', clientIds);

      for (const client of clients ?? []) {
        clientNames.set(client.id as string, String(client.name ?? '').trim());
      }
    }

    let accountSlug: string | null = null;
    if (accountId && accountId !== userId) {
      const { data: account } = await admin
        .from('accounts')
        .select('slug')
        .eq('id', accountId)
        .maybeSingle();
      accountSlug = (account?.slug as string | null) ?? null;
    }

    const reviewHref = accountSlug
      ? `${origin}${pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)}?filter=action`
      : `${origin}${pathsConfig.app.personalEmailAssistant}?filter=action`;

    const digestItems: StuckThreadDigestItem[] = top.map((row) => {
      const threadHref = accountSlug
        ? `${origin}${pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)}?thread=${row.id}`
        : `${origin}${pathsConfig.app.personalEmailAssistant}?thread=${row.id}`;

      const clientId = row.client_id as string | null;

      return {
        id: row.id as string,
        subject: row.subject as string | null,
        lastMessageAt: row.last_message_at as string | null,
        clientName: clientId ? (clientNames.get(clientId) ?? null) : null,
        href: threadHref,
        ageDays: daysSince(row.last_message_at as string | null),
      };
    });

    await createInAppNotification({
      accountId,
      body: `${userThreads.length} email thread${userThreads.length === 1 ? '' : 's'} still need attention`,
      link: reviewHref,
    });

    usersNotified += 1;

    const { data: userRow } = await admin
      .from('user_settings')
      .select('email_notification_preferences')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email?.trim();

    if (
      !email ||
      !isEmailNotificationEnabled(
        userRow?.email_notification_preferences,
        'email_stuck_thread_digest',
      )
    ) {
      continue;
    }

    const html = wrapNotificationEmail({
      title: 'Stuck email threads',
      bodyHtml: buildStuckThreadDigestBodyHtml({
        threads: digestItems,
        reviewHref,
      }),
    });

    await sendPlatformEmail({
      to: email,
      subject: `${userThreads.length} email thread${userThreads.length === 1 ? '' : 's'} waiting for you`,
      html,
    });

    emailsSent += 1;
  }

  return { usersNotified, emailsSent };
}
