import 'server-only';

import { getLogger } from '@kit/shared/logger';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

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

function resolveFromAddress(productName: string): string | null {
  const zepto = process.env.ZEPTOMAIL_FROM_ADDRESS?.trim();
  if (zepto) {
    const name = process.env.ZEPTOMAIL_FROM_NAME?.trim() || productName;
    return `${name} <${zepto}>`;
  }
  return process.env.EMAIL_SENDER?.trim() || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Notify platform ops when a team invite is accepted.
 * Uses the same SUPPORT_INBOX / CONTACT_EMAIL pattern as apps/web lifecycle emails.
 */
export async function notifyPlatformTeamInviteAccepted(input: {
  email: string;
  userId: string;
  accountId: string;
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  role?: string | null;
}): Promise<void> {
  const logger = await getLogger();
  const inbox = getPlatformOpsInbox();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const from = resolveFromAddress(productName);

  if (!inbox || !from || !siteUrl) {
    logger.warn(
      {
        hasInbox: Boolean(inbox),
        hasFrom: Boolean(from),
        hasSiteUrl: Boolean(siteUrl),
      },
      'Skipping invite-accepted ops email (missing config)',
    );
    return;
  }

  const subject = `[${productName}] Invite accepted: ${input.email}`;
  const adminUrl = new URL('/admin/accounts', siteUrl).toString();
  const html = `<div style="font-family:sans-serif;line-height:1.5;color:#351E28">
  <h2 style="margin:0 0 12px;">Invite accepted</h2>
  <p style="margin:0 0 12px;">Someone accepted a team invitation on ${escapeHtml(productName)}.</p>
  <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
  <p style="margin:0 0 8px;"><strong>User ID:</strong> ${escapeHtml(input.userId)}</p>
  ${
    input.workspaceName
      ? `<p style="margin:0 0 8px;"><strong>Workspace:</strong> ${escapeHtml(input.workspaceName)}${input.workspaceSlug ? ` (${escapeHtml(input.workspaceSlug)})` : ''}</p>`
      : ''
  }
  ${
    input.role
      ? `<p style="margin:0 0 8px;"><strong>Role:</strong> ${escapeHtml(input.role)}</p>`
      : ''
  }
  <p style="margin:16px 0 0;"><a href="${escapeHtml(adminUrl)}">Open admin</a></p>
</div>`;

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  try {
    const { getMailer } = await import('@kit/mailers');
    const mailer = await getMailer();
    await mailer.sendEmail({
      to: inbox,
      from,
      subject,
      html,
    });
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage, email: input.email },
      'Failed to send invite-accepted ops email',
    );
  } finally {
    await insertPlatformEmailLog({
      emailType: 'invite_accepted',
      accountId: input.accountId,
      recipientEmail: inbox,
      senderEmail: from,
      subject,
      status,
      errorMessage,
      htmlBody: html,
      metadata: {
        user_id: input.userId,
        email: input.email,
        invite_kind: 'team',
        workspace_name: input.workspaceName ?? null,
        workspace_slug: input.workspaceSlug ?? null,
        role: input.role ?? null,
      },
    });
  }
}
