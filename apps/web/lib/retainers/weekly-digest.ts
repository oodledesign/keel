import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import { wrapNotificationEmail } from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { isEmailNotificationEnabled } from '~/lib/notifications/email-notification-preferences';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { RETAINER_TIMEZONE } from './constants';
import { londonWeekRangeUtc, londonWeekStartYmd } from './credit-rules';
import { looseClient } from './loose-client';
import { buildProjectRetainerDigestBodyHtml } from './weekly-digest-email';

function db(client: SupabaseClient) {
  return looseClient(client);
}

export async function runProjectRetainerWeeklyDigest(
  admin: SupabaseClient,
  now = new Date(),
): Promise<{ projects: number; emailsSent: number }> {
  const weekStart = londonWeekStartYmd(now, RETAINER_TIMEZONE);
  const { startIso, endIso } = londonWeekRangeUtc(weekStart);
  const origin = getAppSiteOrigin();

  const sender = process.env.EMAIL_SENDER?.trim();

  const { data: retainers, error } = await db(admin)
    .from('project_retainers')
    .select('project_id, account_id, credit_balance')
    .eq('weekly_digest_enabled', true);

  if (error) {
    console.error('[retainer-digest] load retainers', error.message);
    return { projects: 0, emailsSent: 0 };
  }

  let projects = 0;
  let emailsSent = 0;

  for (const retainer of retainers ?? []) {
    const projectId = String(retainer.project_id);
    const accountId = String(retainer.account_id);

    const { data: already } = await db(admin)
      .from('project_retainer_digest_log')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (already) continue;

    const { data: txRows } = await db(admin)
      .from('project_retainer_transactions')
      .select('id, type, amount, created_at')
      .eq('project_id', projectId)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true });

    const transactions = txRows ?? [];
    if (transactions.length === 0) continue;

    const burns = transactions.filter((row) => row.type === 'burn');
    const undos = transactions.filter((row) => row.type === 'undo');
    const grants = transactions.filter((row) => row.type === 'grant');
    const debits = transactions.filter(
      (row) => row.type === 'debit' || row.type === 'adjust',
    );

    const burned = burns.reduce(
      (sum, row) => sum + Math.abs(Number(row.amount ?? 0)),
      0,
    );
    const restored = undos.reduce(
      (sum, row) => sum + Math.abs(Number(row.amount ?? 0)),
      0,
    );
    const granted = grants.reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );
    const debited = debits.reduce(
      (sum, row) => sum + Math.abs(Number(row.amount ?? 0)),
      0,
    );

    const [{ data: project }, { data: account }] = await Promise.all([
      admin
        .from('projects')
        .select('id, name, title, created_by')
        .eq('id', projectId)
        .maybeSingle(),
      admin
        .from('accounts')
        .select('id, slug, name')
        .eq('id', accountId)
        .maybeSingle(),
    ]);

    if (!project || !account?.slug) continue;

    const { data: assignments } = await admin
      .from('project_assignments')
      .select('user_id')
      .eq('project_id', projectId);

    const recipientIds = [
      ...new Set(
        [
          ...((assignments ?? []) as Array<{ user_id: string }>).map(
            (row) => row.user_id,
          ),
          project.created_by as string | null,
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    if (recipientIds.length === 0) continue;

    const projectTitle =
      String(project.title ?? project.name ?? 'Project').trim() || 'Project';
    const projectHref = `${origin}${pathsConfig.app.accountJobDetail
      .replace('[account]', account.slug)
      .replace('[id]', projectId)}?tab=overview`;

    await createInAppNotification({
      accountId,
      body: `${projectTitle}: ${burned} credit${burned === 1 ? '' : 's'} used this week · balance ${retainer.credit_balance}`,
      link: projectHref,
    });

    for (const userId of recipientIds) {
      const { data: userRow } = await admin
        .from('user_settings')
        .select('email_notification_preferences')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const email = authUser.user?.email?.trim();

      if (
        !email ||
        !sender ||
        !isEmailNotificationEnabled(
          userRow?.email_notification_preferences,
          'project_retainer_digest',
        )
      ) {
        continue;
      }

      const html = wrapNotificationEmail(
        buildProjectRetainerDigestBodyHtml({
          projectTitle,
          balance: Number(retainer.credit_balance ?? 0),
          burned,
          restored,
          granted,
          debited,
          weekStart,
        }),
        {
          title: `Retainer digest — ${projectTitle}`,
          heading: projectTitle,
          cta: { label: 'Open project', href: projectHref },
        },
      );

      await sendPlatformEmail({
        type: 'project_retainer_digest',
        accountId,
        mail: {
          to: email,
          from: sender,
          subject: `${projectTitle}: retainer activity this week`,
          html,
        },
      });
      emailsSent += 1;
    }

    await db(admin).from('project_retainer_digest_log').insert({
      project_id: projectId,
      week_start: weekStart,
    });
    projects += 1;
  }

  return { projects, emailsSent };
}
