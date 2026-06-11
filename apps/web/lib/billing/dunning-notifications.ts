import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import pathsConfig from '~/config/paths.config';

export type DunningNotificationType = 'payment_reminder_3d' | 'payment_reminder_7d';

type DunningCandidate = {
  subscriptionId: string;
  accountId: string;
  accountName: string;
  accountSlug: string;
  ownerEmail: string;
  notificationType: DunningNotificationType;
  daysPastDue: number;
};

const MS_DAY = 24 * 60 * 60 * 1000;

export async function runBillingDunningReminders(
  admin: SupabaseClient,
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';

  if (!sender || !siteUrl) {
    return {
      sent: 0,
      skipped: 0,
      errors: ['EMAIL_SENDER or NEXT_PUBLIC_SITE_URL not configured'],
    };
  }

  const candidates = await loadDunningCandidates(admin);
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    const alreadySent = await admin
      .from('billing_notification_log')
      .select('id')
      .eq('subscription_id', row.subscriptionId)
      .eq('notification_type', row.notificationType)
      .maybeSingle();

    if (alreadySent.data) {
      skipped++;
      continue;
    }

    const billingUrl = new URL(
      pathsConfig.app.accountBilling.replace('[account]', row.accountSlug),
      siteUrl,
    ).toString();

    const subject =
      row.notificationType === 'payment_reminder_7d'
        ? `Final reminder: payment overdue for ${row.accountName}`
        : `Payment still overdue for ${row.accountName}`;

    const html = wrapEmail(
      `<p>We still could not collect payment for <strong>${escapeHtml(row.accountName)}</strong> on ${escapeHtml(productName)} (${row.daysPastDue} days overdue).</p>
      <p>Update your payment method to avoid losing access to this workspace.</p>
      <p><a href="${billingUrl}">Manage billing</a></p>`,
    );

    try {
      await sendPlatformEmail({
        type: 'billing',
        accountId: row.accountId,
        mail: {
          to: row.ownerEmail,
          from: sender,
          subject,
          html,
        },
        metadata: {
          notification_type: row.notificationType,
          subscription_id: row.subscriptionId,
        },
      });

      await admin.from('billing_notification_log').insert({
        account_id: row.accountId,
        subscription_id: row.subscriptionId,
        notification_type: row.notificationType,
      });

      sent++;
    } catch (err) {
      errors.push(
        `${row.subscriptionId}: ${err instanceof Error ? err.message : 'send failed'}`,
      );
    }
  }

  return { sent, skipped, errors };
}

async function loadDunningCandidates(
  admin: SupabaseClient,
): Promise<DunningCandidate[]> {
  const { data: subs, error } = await admin
    .from('subscriptions')
    .select(
      'id, account_id, status, updated_at, accounts!inner(id, name, slug)',
    )
    .in('status', ['past_due', 'unpaid']);

  if (error || !subs?.length) {
    return [];
  }

  const now = Date.now();
  const results: DunningCandidate[] = [];

  for (const sub of subs) {
    const updatedAt = new Date((sub as { updated_at: string }).updated_at).getTime();
    const daysPastDue = Math.floor((now - updatedAt) / MS_DAY);

    let notificationType: DunningNotificationType | null = null;
    if (daysPastDue >= 7) {
      notificationType = 'payment_reminder_7d';
    } else if (daysPastDue >= 3) {
      notificationType = 'payment_reminder_3d';
    }

    if (!notificationType) continue;

    const account = (sub as {
      accounts: { id: string; name: string | null; slug: string | null };
    }).accounts;
    const accountId = (sub as { account_id: string }).account_id;
    const slug = account.slug;
    if (!slug) continue;

    const ownerEmail = await loadWorkspaceOwnerEmail(admin, accountId);
    if (!ownerEmail) continue;

    results.push({
      subscriptionId: (sub as { id: string }).id,
      accountId,
      accountName: account.name ?? slug,
      accountSlug: slug,
      ownerEmail,
      notificationType,
      daysPastDue,
    });
  }

  return results;
}

async function loadWorkspaceOwnerEmail(
  admin: SupabaseClient,
  accountId: string,
): Promise<string | null> {
  const { data: membership } = await admin
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId)
    .eq('account_role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const userId = (membership as { user_id?: string } | null)?.user_id;
  if (!userId) return null;

  const { data: userResult, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userResult.user?.email) return null;

  return userResult.user.email;
}

function wrapEmail(body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">${body}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
