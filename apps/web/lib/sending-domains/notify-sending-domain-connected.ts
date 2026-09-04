import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import type { SendingDomainRecord } from './types';

async function loadCreatedByEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  const admin = getSupabaseServerAdminClient();

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      return null;
    }
    return data.user.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

async function loadOwnerAdminEmails(accountId: string): Promise<{
  emails: string[];
  accountSlug: string | null;
  accountName: string | null;
}> {
  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('slug, name')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    return { emails: [], accountSlug: null, accountName: null };
  }

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });

  const emails = Array.from(
    new Set(
      (members ?? [])
        .filter((member: { role?: string | null; email?: string | null }) => {
          return (
            (member.role === 'owner' || member.role === 'admin') &&
            Boolean(member.email)
          );
        })
        .map((member: { email?: string | null }) =>
          member.email!.trim().toLowerCase(),
        ),
    ),
  ) as string[];

  return {
    emails,
    accountSlug: account.slug as string,
    accountName: (account.name as string | null) ?? null,
  };
}

/**
 * One-shot notifications when a sending domain first becomes verified.
 * Never throws — notification failure must not fail status refresh.
 */
export async function notifySendingDomainConnected(params: {
  domain: SendingDomainRecord;
}): Promise<void> {
  try {
    const sender = process.env.EMAIL_SENDER;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
    const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
    const sendingHost = params.domain.sending_host;
    const accountId = params.domain.account_id;

    const [{ emails: ownerEmails, accountSlug, accountName }, createdByEmail] =
      await Promise.all([
        loadOwnerAdminEmails(accountId),
        loadCreatedByEmail(params.domain.created_by),
      ]);

    const settingsPath = accountSlug
      ? pathsConfig.app.accountSendingDomainSettings.replace(
          '[account]',
          accountSlug,
        )
      : null;

    const workspaceLabel = accountName?.trim() || sendingHost;

    await createInAppNotification({
      accountId,
      type: 'info',
      body: `Sending domain ${sendingHost} is connected. Campaigns and circulation can send from it.`,
      link: settingsPath ?? undefined,
    });

    if (!sender || !siteUrl) {
      console.warn(
        '[sending-domain-connected] EMAIL_SENDER or NEXT_PUBLIC_SITE_URL missing; skipped email',
      );
      return;
    }

    const recipients = Array.from(
      new Set(
        [...ownerEmails, createdByEmail].filter(
          (email): email is string => Boolean(email),
        ),
      ),
    );

    if (recipients.length === 0) {
      return;
    }

    const settingsUrl = settingsPath
      ? new URL(settingsPath, siteUrl).toString()
      : siteUrl;

    const subject = 'Your sending domain is connected';
    const html = wrapNotificationEmail(
      `<p style="margin:0 0 12px;">Good news — <strong>${escapeNotificationHtml(sendingHost)}</strong> is connected for <strong>${escapeNotificationHtml(workspaceLabel)}</strong>.</p>
<p style="margin:0 0 12px;">Campaigns and circulation can now send from this domain.</p>
<p style="margin:0;">Open Sending domain settings to send a test or choose a From address.</p>`,
      {
        title: subject,
        heading: 'Sending domain connected',
        preview: `${sendingHost} is ready to send.`,
        cta: { label: 'Open sending domain settings', href: settingsUrl },
        footerNote: `You're receiving this because you own or manage ${escapeNotificationHtml(workspaceLabel)} on ${escapeNotificationHtml(productName)}.`,
        productName,
      },
    );

    await Promise.allSettled(
      recipients.map((to) =>
        sendPlatformEmail({
          type: 'sending_domain',
          accountId,
          mail: {
            from: sender,
            to,
            subject,
            html,
          },
          metadata: {
            event: 'sending_domain_connected',
            sending_host: sendingHost,
            domain: params.domain.domain,
          },
        }),
      ),
    );
  } catch (error) {
    console.warn('[sending-domain-connected] notify failed', {
      accountId: params.domain.account_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
