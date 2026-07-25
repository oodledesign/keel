import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { createSupportPublicToken } from '~/lib/support/support-tokens';

function getEmailConfig() {
  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!sender || !siteUrl) {
    return null;
  }

  return { sender, siteUrl, productName };
}

function formatTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(4, '0')}`;
}

async function loadWorkspaceNotifyEmails(
  admin: SupabaseClient,
  accountId: string,
  assignedTo: string | null,
): Promise<string[]> {
  const emails = new Set<string>();

  if (assignedTo) {
    const { data } = await admin.auth.admin.getUserById(assignedTo);
    if (data.user?.email) {
      emails.add(data.user.email.toLowerCase());
    }
  }

  const { data: memberships } = await admin
    .from('accounts_memberships')
    .select('user_id, account_role')
    .eq('account_id', accountId)
    .in('account_role', ['owner', 'admin']);

  for (const row of memberships ?? []) {
    const userId = (row as { user_id?: string }).user_id;
    if (!userId) continue;
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.email) {
      emails.add(data.user.email.toLowerCase());
    }
  }

  return [...emails];
}

async function loadClientNotifyEmails(
  admin: SupabaseClient,
  input: {
    clientOrgId: string | null;
    submitterEmail: string | null;
  },
): Promise<string[]> {
  const emails = new Set<string>();
  if (input.submitterEmail?.trim()) {
    emails.add(input.submitterEmail.trim().toLowerCase());
  }

  if (!input.clientOrgId) {
    return [...emails];
  }

  const { data: members } = await admin
    .from('client_members')
    .select('user_id')
    .eq('client_org_id', input.clientOrgId);

  for (const row of members ?? []) {
    const userId = (row as { user_id?: string }).user_id;
    if (!userId) continue;
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data.user?.email) {
      emails.add(data.user.email.toLowerCase());
    }
  }

  return [...emails];
}

async function ensureTicketPublicToken(
  admin: SupabaseClient,
  ticketId: string,
  existing: string | null | undefined,
): Promise<string> {
  if (existing) return existing;
  const token = createSupportPublicToken();
  await admin
    .from('support_tickets')
    .update({ public_token: token })
    .eq('id', ticketId);
  return token;
}

export async function notifyWorkspaceNewSupportTicket(
  admin: SupabaseClient,
  input: {
    accountId: string;
    accountSlug: string;
    ticketId: string;
    ticketNumber: number;
    title: string;
    description: string;
    submitterName: string | null;
    submitterEmail: string | null;
    assignedTo: string | null;
    clientOrgSlug: string | null;
    publicToken: string | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadWorkspaceNotifyEmails(
    admin,
    input.accountId,
    input.assignedTo,
  );
  if (recipients.length === 0) return;

  const label = formatTicketNumber(input.ticketNumber);
  const agencyUrl = new URL(
    pathsConfig.app.accountSupportDetail
      .replace('[account]', input.accountSlug)
      .replace('[id]', input.ticketId),
    config.siteUrl,
  ).toString();

  const who = input.submitterName
    ? `${input.submitterName}${input.submitterEmail ? ` (${input.submitterEmail})` : ''}`
    : (input.submitterEmail ?? 'A client');

  const html = wrapNotificationEmail(
    `<p>New support ticket ${escapeNotificationHtml(label)} on ${escapeNotificationHtml(config.productName)}.</p>
    <p><strong>From:</strong> ${escapeNotificationHtml(who)}</p>
    <p><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="white-space:pre-wrap">${escapeNotificationHtml(input.description)}</p>
    <p><a href="${agencyUrl}">View ticket</a></p>`,
  );

  await Promise.all(
    recipients.map((to) =>
      sendPlatformEmail({
        type: 'support_ticket',
        accountId: input.accountId,
        mail: {
          to,
          from: config.sender,
          subject: `[Support] ${label} ${input.title}`,
          html,
        },
        metadata: {
          ticket_id: input.ticketId,
          ticket_number: input.ticketNumber,
          kind: 'workspace_new_ticket',
        },
      }),
    ),
  );
}

export async function notifyWorkspaceSupportClientReply(
  admin: SupabaseClient,
  input: {
    accountId: string;
    accountSlug: string;
    ticketId: string;
    ticketNumber: number;
    title: string;
    replyBody: string;
    assignedTo: string | null;
    authorName: string | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadWorkspaceNotifyEmails(
    admin,
    input.accountId,
    input.assignedTo,
  );
  if (recipients.length === 0) return;

  const label = formatTicketNumber(input.ticketNumber);
  const agencyUrl = new URL(
    pathsConfig.app.accountSupportDetail
      .replace('[account]', input.accountSlug)
      .replace('[id]', input.ticketId),
    config.siteUrl,
  ).toString();

  const html = wrapNotificationEmail(
    `<p>${escapeNotificationHtml(input.authorName ?? 'A client')} replied on support ticket ${escapeNotificationHtml(label)}.</p>
    <p><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="white-space:pre-wrap">${escapeNotificationHtml(input.replyBody)}</p>
    <p><a href="${agencyUrl}">View ticket</a></p>`,
  );

  await Promise.all(
    recipients.map((to) =>
      sendPlatformEmail({
        type: 'support_ticket',
        accountId: input.accountId,
        mail: {
          to,
          from: config.sender,
          subject: `Re: ${label} ${input.title}`,
          html,
        },
        metadata: {
          ticket_id: input.ticketId,
          kind: 'workspace_client_reply',
        },
      }),
    ),
  );
}

export async function notifyWorkspaceSupportAgencyReply(
  admin: SupabaseClient,
  input: {
    accountId: string;
    accountSlug: string;
    ticketId: string;
    ticketNumber: number;
    title: string;
    replyBody: string;
    clientOrgId: string | null;
    clientOrgSlug: string | null;
    submitterEmail: string | null;
    publicToken: string | null;
  },
): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadClientNotifyEmails(admin, {
    clientOrgId: input.clientOrgId,
    submitterEmail: input.submitterEmail,
  });
  if (recipients.length === 0) return;

  const label = formatTicketNumber(input.ticketNumber);
  const token = await ensureTicketPublicToken(
    admin,
    input.ticketId,
    input.publicToken,
  );

  let ticketUrl: string;
  if (input.clientOrgSlug) {
    ticketUrl = new URL(
      pathsConfig.app.clientPortalSupportDetail
        .replace('[clientSlug]', input.clientOrgSlug)
        .replace('[id]', input.ticketId),
      config.siteUrl,
    ).toString();
  } else {
    ticketUrl = new URL(
      `/portal/support/ticket/${token}`,
      config.siteUrl,
    ).toString();
  }

  const html = wrapNotificationEmail(
    `<p>You have a new reply on support ticket ${escapeNotificationHtml(label)}.</p>
    <p><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="white-space:pre-wrap">${escapeNotificationHtml(input.replyBody)}</p>
    <p><a href="${ticketUrl}">View ticket</a></p>`,
  );

  await Promise.all(
    recipients.map((to) =>
      sendPlatformEmail({
        type: 'support_ticket',
        accountId: input.accountId,
        mail: {
          to,
          from: config.sender,
          subject: `Re: ${label} ${input.title}`,
          html,
        },
        metadata: {
          ticket_id: input.ticketId,
          kind: 'workspace_agency_reply',
        },
      }),
    ),
  );
}
