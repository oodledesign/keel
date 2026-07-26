import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { listGuestAccountIdsWithSupportAccess } from '~/lib/clients/client-workspace-shares.service';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import {
  notifySupportAgencyReplyInApp,
  notifySupportClientReplyInApp,
  notifySupportNewTicketInApp,
} from '~/lib/support/support-in-app-notifications';
import { createSupportPublicToken } from '~/lib/support/support-tokens';

function getEmailConfig() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const sender = resolveTransactionalEmailFrom(productName);

  if (!siteUrl) {
    console.warn(
      '[support-notifications] NEXT_PUBLIC_SITE_URL is not set; skipping email',
    );
    return null;
  }

  if (!sender) {
    console.warn(
      '[support-notifications] No email sender configured (ZEPTOMAIL_FROM_ADDRESS or EMAIL_SENDER); skipping email',
    );
    return null;
  }

  return { sender, siteUrl, productName };
}

function formatTicketNumber(ticketNumber: number) {
  return `#${String(ticketNumber).padStart(4, '0')}`;
}

/** Active guest workspaces with Support access on this client_org. */
async function loadSupportGuestAccountIds(
  _admin: SupabaseClient,
  clientOrgId: string,
): Promise<string[]> {
  return listGuestAccountIdsWithSupportAccess(clientOrgId);
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
    .in('account_role', ['owner', 'admin', 'staff']);

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

  const linkedAccountIds = await loadSupportGuestAccountIds(
    admin,
    input.clientOrgId,
  );

  for (const linkedAccountId of linkedAccountIds) {
    const { data: memberships } = await admin
      .from('accounts_memberships')
      .select('user_id')
      .eq('account_id', linkedAccountId)
      .in('account_role', ['owner', 'admin', 'staff']);

    for (const row of memberships ?? []) {
      const userId = (row as { user_id?: string }).user_id;
      if (!userId) continue;
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) {
        emails.add(data.user.email.toLowerCase());
      }
    }
  }

  return [...emails];
}

async function notifyGuestWorkspacesInApp(
  admin: SupabaseClient,
  input: {
    clientOrgId: string | null;
    ticketId: string;
    ticketNumber: number;
    title: string;
  },
) {
  if (!input.clientOrgId) return;

  const guestAccountIds = await loadSupportGuestAccountIds(
    admin,
    input.clientOrgId,
  );

  await Promise.all(
    guestAccountIds.map(async (guestAccountId) => {
      const { data: account } = await admin
        .from('accounts')
        .select('slug')
        .eq('id', guestAccountId)
        .maybeSingle();

      const slug = (account as { slug?: string | null } | null)?.slug;
      if (!slug) return;

      await notifySupportAgencyReplyInApp({
        accountId: guestAccountId,
        accountSlug: slug,
        ticketId: input.ticketId,
        ticketNumber: input.ticketNumber,
        title: input.title,
        partnerView: true,
      });
    }),
  );
}

async function resolveClientTicketUrl(
  admin: SupabaseClient,
  input: {
    siteUrl: string;
    ticketId: string;
    clientOrgId: string | null;
    clientOrgSlug: string | null;
    publicToken: string | null;
  },
): Promise<string> {
  if (input.clientOrgId) {
    const linkedAccountIds = await loadSupportGuestAccountIds(
      admin,
      input.clientOrgId,
    );

    for (const linkedAccountId of linkedAccountIds) {
      const { data: account } = await admin
        .from('accounts')
        .select('slug')
        .eq('id', linkedAccountId)
        .maybeSingle();

      const slug = (account as { slug?: string | null } | null)?.slug;
      if (slug) {
        return new URL(
          pathsConfig.app.accountPartnerSupportDetail
            .replace('[account]', slug)
            .replace('[id]', input.ticketId),
          input.siteUrl,
        ).toString();
      }
    }
  }

  if (input.clientOrgSlug) {
    return new URL(
      pathsConfig.app.clientPortalSupportDetail
        .replace('[clientSlug]', input.clientOrgSlug)
        .replace('[id]', input.ticketId),
      input.siteUrl,
    ).toString();
  }

  const token = await ensureTicketPublicToken(
    admin,
    input.ticketId,
    input.publicToken,
  );

  return new URL(`/portal/support/ticket/${token}`, input.siteUrl).toString();
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
  const who = input.submitterName
    ? `${input.submitterName}${input.submitterEmail ? ` (${input.submitterEmail})` : ''}`
    : (input.submitterEmail ?? 'A client');

  await notifySupportNewTicketInApp({
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    title: input.title,
    submitterLabel: who,
  });

  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadWorkspaceNotifyEmails(
    admin,
    input.accountId,
    input.assignedTo,
  );
  if (recipients.length === 0) {
    console.warn(
      '[support-notifications] No workspace recipients for new ticket',
      { accountId: input.accountId, ticketId: input.ticketId },
    );
    return;
  }

  const label = formatTicketNumber(input.ticketNumber);
  const agencyUrl = new URL(
    pathsConfig.app.accountSupportDetail
      .replace('[account]', input.accountSlug)
      .replace('[id]', input.ticketId),
    config.siteUrl,
  ).toString();

  const html = wrapNotificationEmail(
    `<p style="margin:0 0 12px;">A new support ticket was opened on your workspace.</p>
    <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeNotificationHtml(who)}</p>
    <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.description)}</p>`,
    {
      productName: config.productName,
      title: `New support ticket ${label}`,
      heading: `New support ticket ${label}`,
      preview: `${who} opened ${label}: ${input.title}`,
      cta: { label: 'View ticket', href: agencyUrl },
      footerNote: `You're receiving this because you're on the support team for this ${escapeNotificationHtml(config.productName)} workspace.`,
    },
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
  const authorName = input.authorName ?? 'A client';

  await notifySupportClientReplyInApp({
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    title: input.title,
    authorName,
  });

  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadWorkspaceNotifyEmails(
    admin,
    input.accountId,
    input.assignedTo,
  );
  if (recipients.length === 0) {
    console.warn(
      '[support-notifications] No workspace recipients for client reply',
      { accountId: input.accountId, ticketId: input.ticketId },
    );
    return;
  }

  const label = formatTicketNumber(input.ticketNumber);
  const agencyUrl = new URL(
    pathsConfig.app.accountSupportDetail
      .replace('[account]', input.accountSlug)
      .replace('[id]', input.ticketId),
    config.siteUrl,
  ).toString();

  const html = wrapNotificationEmail(
    `<p style="margin:0 0 12px;"><strong>${escapeNotificationHtml(authorName)}</strong> replied on support ticket ${escapeNotificationHtml(label)}.</p>
    <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.replyBody)}</p>`,
    {
      productName: config.productName,
      title: `Reply on ${label}`,
      heading: `New reply on ${label}`,
      preview: `${authorName} replied: ${input.title}`,
      cta: { label: 'View ticket', href: agencyUrl },
      footerNote: `You're receiving this because you're on the support team for this ${escapeNotificationHtml(config.productName)} workspace.`,
    },
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
  await notifyGuestWorkspacesInApp(admin, {
    clientOrgId: input.clientOrgId,
    ticketId: input.ticketId,
    ticketNumber: input.ticketNumber,
    title: input.title,
  });

  const config = getEmailConfig();
  if (!config) return;

  const recipients = await loadClientNotifyEmails(admin, {
    clientOrgId: input.clientOrgId,
    submitterEmail: input.submitterEmail,
  });
  if (recipients.length === 0) {
    console.warn(
      '[support-notifications] No client recipients for agency reply',
      { accountId: input.accountId, ticketId: input.ticketId },
    );
    return;
  }

  const label = formatTicketNumber(input.ticketNumber);
  const ticketUrl = await resolveClientTicketUrl(admin, {
    siteUrl: config.siteUrl,
    ticketId: input.ticketId,
    clientOrgId: input.clientOrgId,
    clientOrgSlug: input.clientOrgSlug,
    publicToken: input.publicToken,
  });

  const html = wrapNotificationEmail(
    `<p style="margin:0 0 12px;">You have a new reply on support ticket ${escapeNotificationHtml(label)}.</p>
    <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeNotificationHtml(input.title)}</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeNotificationHtml(input.replyBody)}</p>`,
    {
      productName: config.productName,
      title: `Reply on ${label}`,
      heading: `New reply on ${label}`,
      preview: `New reply on ${label}: ${input.title}`,
      cta: { label: 'View ticket', href: ticketUrl },
      footerNote: `You're receiving this because you submitted or follow this support ticket on ${escapeNotificationHtml(config.productName)}.`,
    },
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
