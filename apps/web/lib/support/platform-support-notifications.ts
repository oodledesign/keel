import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { formatPlatformTicketNumber } from './platform-support.types';

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
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';

  if (!sender || !siteUrl) {
    return null;
  }

  return { sender, siteUrl, productName };
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
    userId: string;
    accountName?: string | null;
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
      subject: `[${config.productName} support] ${ticketLabel} ${input.subject}`,
      html: wrapEmail(
        `<p>New platform support ticket ${escapeHtml(ticketLabel)}.</p>
      <p><strong>From:</strong> ${escapeHtml(userEmail ?? input.userId)}</p>
      ${
        input.accountName
          ? `<p><strong>Workspace:</strong> ${escapeHtml(input.accountName)}</p>`
          : ''
      }
      <p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(input.body)}</p>
      <p><a href="${adminUrl}">View in admin</a></p>`,
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
      html: wrapEmail(
        `<p>The ${escapeHtml(config.productName)} team replied to your support ticket ${escapeHtml(ticketLabel)}.</p>
      <p style="white-space:pre-wrap">${escapeHtml(input.replyBody)}</p>
      <p><a href="${ticketUrl}">View ticket</a></p>`,
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
      html: wrapEmail(
        `<p>${escapeHtml(userEmail ?? 'A user')} replied on ticket ${escapeHtml(ticketLabel)}: ${escapeHtml(input.subject)}</p>
      <p style="white-space:pre-wrap">${escapeHtml(input.replyBody)}</p>
      <p><a href="${adminUrl}">View in admin</a></p>`,
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
  return (data as { name?: string | null; slug?: string | null }).name ??
    (data as { slug?: string | null }).slug ??
    null;
}
