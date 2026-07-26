import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  formatPlatformSupportCategory,
  formatPlatformTicketNumber,
} from './platform-support.types';

function getSupportInbox(): string | null {
  return (
    process.env.SUPPORT_INBOX?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    null
  );
}

function getEmailConfig() {
  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return null;
  }

  return { sender, siteUrl, productName };
}

function attachmentsHtml(
  attachments?: Array<{ name: string; url: string }> | null,
) {
  if (!attachments?.length) return '';
  const items = attachments
    .map(
      (file) =>
        `<li><a href="${escapeNotificationHtml(file.url)}">${escapeNotificationHtml(file.name)}</a></li>`,
    )
    .join('');
  return `<p style="margin:12px 0 0;"><strong>Attachments:</strong></p><ul style="margin:8px 0 0;padding-left:18px;">${items}</ul>`;
}

async function loadUserEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function notifySupportTeamNewTicket(
  admin: SupabaseClient,
  input: {
    ticketId: string;
    ticketNumber: number;
    subject: string;
    body: string;
    category?: string | null;
    attachments?: Array<{ name: string; url: string }> | null;
    userId: string;
    accountName?: string | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  const inbox = getSupportInbox();
  if (!config || !inbox) return;

  const userEmail = await loadUserEmail(admin, input.userId);
  const ticketLabel = formatPlatformTicketNumber(input.ticketNumber);
  const categoryLabel = formatPlatformSupportCategory(input.category);
  const adminUrl = new URL(
    `/admin/support/${input.ticketId}`,
    config.siteUrl,
  ).toString();

  await sendPlatformEmail({
    type: 'support_ticket',
    mail: {
      to: inbox,
      from: config.sender,
      subject: `[${config.productName} support] ${categoryLabel}: ${ticketLabel} ${input.subject}`,
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">New platform support ticket ${escapeNotificationHtml(ticketLabel)}.</p>
      <p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeNotificationHtml(categoryLabel)}</p>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeNotificationHtml(userEmail ?? input.userId)}</p>
      ${
        input.accountName
          ? `<p style="margin:0 0 8px;"><strong>Workspace:</strong> ${escapeNotificationHtml(input.accountName)}</p>`
          : ''
      }
      <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeNotificationHtml(input.subject)}</p>
      <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.body)}</p>
      ${attachmentsHtml(input.attachments)}`,
        {
          productName: config.productName,
          title: `New support ticket ${ticketLabel}`,
          heading: `New support ticket ${ticketLabel}`,
          preview: `${categoryLabel}: ${input.subject}`,
          cta: { label: 'View in admin', href: adminUrl },
        },
      ),
    },
    metadata: { ticket_id: input.ticketId, ticket_number: input.ticketNumber },
  });
}

export async function notifyUserSupportReply(
  admin: SupabaseClient,
  input: {
    ticketId: string;
    ticketNumber: number;
    subject: string;
    userId: string;
    replyBody: string;
    attachments?: Array<{ name: string; url: string }> | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const userEmail = await loadUserEmail(admin, input.userId);
  if (!userEmail) return;

  const ticketLabel = formatPlatformTicketNumber(input.ticketNumber);
  const ticketUrl = new URL(
    `/app/support/${input.ticketId}`,
    config.siteUrl,
  ).toString();

  await sendPlatformEmail({
    type: 'support_ticket',
    mail: {
      to: userEmail,
      from: config.sender,
      subject: `Re: ${ticketLabel} ${input.subject}`,
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">The ${escapeNotificationHtml(config.productName)} team replied to your support ticket ${escapeNotificationHtml(ticketLabel)}.</p>
      <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.replyBody)}</p>
      ${attachmentsHtml(input.attachments)}`,
        {
          productName: config.productName,
          title: `Reply on ${ticketLabel}`,
          heading: `New reply on ${ticketLabel}`,
          preview: `Reply on ${ticketLabel}: ${input.subject}`,
          cta: { label: 'View ticket', href: ticketUrl },
        },
      ),
    },
    metadata: { ticket_id: input.ticketId, ticket_number: input.ticketNumber },
  });
}

export async function notifySupportTeamUserReply(
  admin: SupabaseClient,
  input: {
    ticketId: string;
    ticketNumber: number;
    subject: string;
    userId: string;
    replyBody: string;
    attachments?: Array<{ name: string; url: string }> | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  const inbox = getSupportInbox();
  if (!config || !inbox) return;

  const userEmail = await loadUserEmail(admin, input.userId);
  const ticketLabel = formatPlatformTicketNumber(input.ticketNumber);
  const adminUrl = new URL(
    `/admin/support/${input.ticketId}`,
    config.siteUrl,
  ).toString();

  await sendPlatformEmail({
    type: 'support_ticket',
    mail: {
      to: inbox,
      from: config.sender,
      subject: `[${config.productName} support] User reply on ${ticketLabel}`,
      html: wrapNotificationEmail(
        `<p style="margin:0 0 12px;">${escapeNotificationHtml(userEmail ?? 'A user')} replied on ticket ${escapeNotificationHtml(ticketLabel)}: ${escapeNotificationHtml(input.subject)}</p>
      <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.replyBody)}</p>
      ${attachmentsHtml(input.attachments)}`,
        {
          productName: config.productName,
          title: `User reply on ${ticketLabel}`,
          heading: `User reply on ${ticketLabel}`,
          preview: `Reply on ${ticketLabel}: ${input.subject}`,
          cta: { label: 'View in admin', href: adminUrl },
        },
      ),
    },
    metadata: { ticket_id: input.ticketId, ticket_number: input.ticketNumber },
  });
}

export async function loadTicketAccountName(
  admin: SupabaseClient,
  accountId: string | null,
): Promise<string | null> {
  if (!accountId) return null;

  const { data } = await admin
    .from('accounts')
    .select('name, slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!data) return null;
  return (
    (data as { name?: string | null }).name ??
    (data as { slug?: string | null }).slug ??
    null
  );
}
