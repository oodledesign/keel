import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { ACTIONABLE_EMAIL_CATEGORIES } from '~/lib/email-assistant/email-thread-categories';
import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { isEmailNotificationEnabled } from '~/lib/notifications/email-notification-preferences';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

export async function runEmailFollowUpReminders(
  admin: SupabaseClient,
): Promise<{ usersNotified: number; emailsSent: number }> {
  const now = new Date().toISOString();
  const origin = getAppSiteOrigin();

  const { data: threads, error } = await admin
    .from('email_threads')
    .select('id, user_id, account_id, subject, follow_up_note')
    .not('follow_up_at', 'is', null)
    .lte('follow_up_at', now)
    .in('assistant_category', [...ACTIONABLE_EMAIL_CATEGORIES])
    .limit(500);

  if (error) {
    console.error('[email-follow-up] load', error.message);
    return { usersNotified: 0, emailsSent: 0 };
  }

  const byUser = new Map<string, Array<(typeof threads)[number]>>();

  for (const row of threads ?? []) {
    const userId = row.user_id as string;
    const list = byUser.get(userId) ?? [];
    list.push(row);
    byUser.set(userId, list);
  }

  let usersNotified = 0;
  let emailsSent = 0;

  for (const [userId, userThreads] of byUser) {
    const accountId = (userThreads[0]?.account_id as string | null) ?? userId;
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
      ? `${origin}${pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)}?filter=follow_up`
      : `${origin}${pathsConfig.app.personalEmailAssistant}?filter=follow_up`;

    const lines = userThreads
      .slice(0, 6)
      .map((row) => {
        const subject = escapeEmailHtml(row.subject?.trim() || '(no subject)');
        const note = row.follow_up_note
          ? `<div style="font-size:13px;color:#6B5560;margin-top:2px;">${escapeEmailHtml(String(row.follow_up_note))}</div>`
          : '';
        return `<li style="margin:0 0 10px;">${subject}${note}</li>`;
      })
      .join('');

    await createInAppNotification({
      accountId,
      body: `${userThreads.length} email follow-up${userThreads.length === 1 ? '' : 's'} due`,
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
        'email_follow_up_reminders',
      )
    ) {
      continue;
    }

    const html = renderOzerTransactionalEmail({
      title: 'Email follow-ups due',
      bodyHtml: `<p style="margin:0 0 12px;">You asked to be reminded about these threads:</p><ul style="margin:0;padding-left:18px;">${lines}</ul><p style="margin:16px 0 0;"><a href="${escapeEmailHtml(reviewHref)}" style="color:#41606F;font-weight:600;">Open inbox</a></p>`,
    });

    await sendPlatformEmail({
      to: email,
      subject: `${userThreads.length} email follow-up${userThreads.length === 1 ? '' : 's'} due`,
      html,
    });

    emailsSent += 1;
  }

  return { usersNotified, emailsSent };
}
