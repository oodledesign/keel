import 'server-only';

import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

function getPlatformOpsInbox(): string | null {
  const explicit =
    process.env.SUPPORT_INBOX?.trim() || process.env.CONTACT_EMAIL?.trim();
  if (explicit) return explicit;

  const zepto = process.env.ZEPTOMAIL_FROM_ADDRESS?.trim();
  if (zepto) return zepto;

  const sender = process.env.EMAIL_SENDER?.trim();
  if (!sender) return null;
  const match = sender.match(/<([^>]+)>/);
  return match?.[1]?.trim() || sender;
}

function getEmailConfig() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const sender = resolveTransactionalEmailFrom(productName);

  if (!siteUrl) {
    console.warn(
      '[platform-lifecycle] NEXT_PUBLIC_SITE_URL is not set; skipping email',
    );
    return null;
  }

  if (!sender) {
    console.warn(
      '[platform-lifecycle] No email sender configured; skipping email',
    );
    return null;
  }

  return { sender, siteUrl, productName };
}

/**
 * Notify platform ops when a new auth user signs up (password or OAuth).
 * Failures are logged and never thrown — signup must not be blocked.
 */
export async function notifyPlatformNewSignup(input: {
  email: string;
  userId: string;
  source: 'email_password' | 'oauth' | 'other';
}): Promise<void> {
  try {
    const config = getEmailConfig();
    const inbox = getPlatformOpsInbox();
    if (!config || !inbox) {
      if (!inbox) {
        console.warn(
          '[platform-lifecycle] SUPPORT_INBOX / CONTACT_EMAIL not set; skipping signup email',
        );
      }
      return;
    }

    const adminUrl = new URL('/admin/accounts', config.siteUrl).toString();
    const sourceLabel =
      input.source === 'email_password'
        ? 'Email / password'
        : input.source === 'oauth'
          ? 'OAuth'
          : 'Other';

    await sendPlatformEmail({
      type: 'user_signup',
      mail: {
        to: inbox,
        from: config.sender,
        subject: `[${config.productName}] New signup: ${input.email}`,
        html: wrapNotificationEmail(
          `<p style="margin:0 0 12px;">A new user created an account on ${escapeNotificationHtml(config.productName)}.</p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeNotificationHtml(input.email)}</p>
          <p style="margin:0 0 8px;"><strong>User ID:</strong> ${escapeNotificationHtml(input.userId)}</p>
          <p style="margin:0;"><strong>Source:</strong> ${escapeNotificationHtml(sourceLabel)}</p>`,
          {
            productName: config.productName,
            title: 'New signup',
            heading: 'New user signup',
            preview: `New signup: ${input.email}`,
            cta: { label: 'Open admin', href: adminUrl },
          },
        ),
      },
      metadata: {
        user_id: input.userId,
        email: input.email,
        source: input.source,
      },
    });
  } catch (error) {
    console.error(
      '[platform-lifecycle] Failed to send signup notification:',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Notify platform ops when someone accepts a workspace or admin invite.
 * Failures are logged and never thrown — accept must not be blocked.
 */
export async function notifyPlatformInviteAccepted(input: {
  email: string;
  userId: string;
  inviteKind: 'team' | 'admin_user';
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  role?: string | null;
}): Promise<void> {
  try {
    const config = getEmailConfig();
    const inbox = getPlatformOpsInbox();
    if (!config || !inbox) {
      if (!inbox) {
        console.warn(
          '[platform-lifecycle] SUPPORT_INBOX / CONTACT_EMAIL not set; skipping invite-accepted email',
        );
      }
      return;
    }

    const adminUrl = new URL('/admin/accounts', config.siteUrl).toString();
    const kindLabel =
      input.inviteKind === 'admin_user'
        ? 'Platform user invite'
        : 'Team workspace invite';

    await sendPlatformEmail({
      type: 'invite_accepted',
      accountId: undefined,
      mail: {
        to: inbox,
        from: config.sender,
        subject: `[${config.productName}] Invite accepted: ${input.email}`,
        html: wrapNotificationEmail(
          `<p style="margin:0 0 12px;">Someone accepted an invitation on ${escapeNotificationHtml(config.productName)}.</p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeNotificationHtml(input.email)}</p>
          <p style="margin:0 0 8px;"><strong>User ID:</strong> ${escapeNotificationHtml(input.userId)}</p>
          <p style="margin:0 0 8px;"><strong>Invite type:</strong> ${escapeNotificationHtml(kindLabel)}</p>
          ${
            input.workspaceName
              ? `<p style="margin:0 0 8px;"><strong>Workspace:</strong> ${escapeNotificationHtml(input.workspaceName)}${input.workspaceSlug ? ` (${escapeNotificationHtml(input.workspaceSlug)})` : ''}</p>`
              : ''
          }
          ${
            input.role
              ? `<p style="margin:0;"><strong>Role:</strong> ${escapeNotificationHtml(input.role)}</p>`
              : ''
          }`,
          {
            productName: config.productName,
            title: 'Invite accepted',
            heading: 'Invite accepted',
            preview: `Invite accepted: ${input.email}`,
            cta: { label: 'Open admin', href: adminUrl },
          },
        ),
      },
      metadata: {
        user_id: input.userId,
        email: input.email,
        invite_kind: input.inviteKind,
        workspace_name: input.workspaceName ?? null,
        workspace_slug: input.workspaceSlug ?? null,
        role: input.role ?? null,
      },
    });
  } catch (error) {
    console.error(
      '[platform-lifecycle] Failed to send invite-accepted notification:',
      error instanceof Error ? error.message : error,
    );
  }
}
