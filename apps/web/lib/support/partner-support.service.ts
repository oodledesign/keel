import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  countSupportSharesForGuest,
  listSupportSharedOrgIds,
} from '~/lib/clients/client-workspace-shares.service';
import { resolveClientOrgAccountId } from '~/lib/support/resolve-client-org-account';
import type { SupportAttachmentMeta } from '~/lib/support/support-attachment.types';
import { createSupportPublicToken } from '~/lib/support/support-tokens';
import {
  notifyWorkspaceNewSupportTicket,
  notifyWorkspaceSupportClientReply,
} from '~/lib/support/workspace-support-notifications';

export type PartnerLinkedOrg = {
  clientOrgId: string;
  clientOrgName: string;
  clientOrgSlug: string;
  providerAccountId: string;
  providerAccountSlug: string;
  providerAccountName: string;
};

export type PartnerTicket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  ticketNumber: number;
  createdAt: string;
  clientOrgId: string;
  clientOrgName: string;
  providerAccountName: string;
};

export type PartnerTicketDetail = PartnerTicket & {
  description: string | null;
  providerAccountId: string;
  providerAccountSlug: string;
};

export type PartnerTicketMessage = {
  id: string;
  ticketId: string;
  message: string;
  createdAt: string;
  authorName: string | null;
  attachments: SupportAttachmentMeta[];
  externalUrl: string | null;
};

async function assertLinkedAccountMember(linkedAccountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', linkedAccountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    throw new Error('Permission denied');
  }

  return user;
}

/** Admin table access for columns not yet in generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminTable(admin: { from: (table: string) => any }, table: string) {
  return admin.from(table);
}

export async function countPartnerSupportLinks(
  linkedAccountId: string,
): Promise<number> {
  return countSupportSharesForGuest(linkedAccountId);
}

export async function listPartnerLinkedOrgs(
  linkedAccountId: string,
): Promise<PartnerLinkedOrg[]> {
  await assertLinkedAccountMember(linkedAccountId);
  const admin = getSupabaseServerAdminClient();
  const orgIds = await listSupportSharedOrgIds(linkedAccountId);
  if (orgIds.length === 0) return [];

  const { data: orgs, error } = await adminTable(admin, 'client_orgs')
    .select('id, name, slug, business_id')
    .in('id', orgIds)
    .order('name');

  if (error) {
    console.error('[partner-support] list orgs:', error.message);
    return [];
  }

  const results: PartnerLinkedOrg[] = [];

  for (const org of orgs ?? []) {
    const row = org as {
      id: string;
      name?: string | null;
      slug: string;
      business_id?: string | null;
    };
    const providerAccountId = await resolveClientOrgAccountId(admin, row);
    if (!providerAccountId) continue;

    const { data: account } = await admin
      .from('accounts')
      .select('slug, name')
      .eq('id', providerAccountId)
      .maybeSingle();

    if (!account?.slug) continue;

    results.push({
      clientOrgId: row.id,
      clientOrgName: row.name?.trim() || row.slug,
      clientOrgSlug: row.slug,
      providerAccountId,
      providerAccountSlug: account.slug as string,
      providerAccountName:
        (account as { name?: string | null }).name?.trim() ||
        (account.slug as string),
    });
  }

  return results;
}

export async function listPartnerTickets(
  linkedAccountId: string,
): Promise<PartnerTicket[]> {
  const orgs = await listPartnerLinkedOrgs(linkedAccountId);
  if (orgs.length === 0) return [];

  const admin = getSupabaseServerAdminClient();
  const orgIds = orgs.map((org) => org.clientOrgId);
  const orgById = new Map(orgs.map((org) => [org.clientOrgId, org]));

  const { data, error } = await adminTable(admin, 'support_tickets')
    .select(
      'id, title, status, priority, ticket_number, created_at, client_org_id',
    )
    .in('client_org_id', orgIds)
    .order('last_activity_at', { ascending: false });

  if (error) {
    console.error('[partner-support] list tickets:', error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const clientOrgId = String(row.client_org_id);
    const org = orgById.get(clientOrgId);
    return {
      id: String(row.id),
      title: String(row.title ?? 'Untitled'),
      status: String(row.status ?? 'open'),
      priority: String(row.priority ?? 'medium'),
      ticketNumber: Number(row.ticket_number ?? 0),
      createdAt: String(row.created_at),
      clientOrgId,
      clientOrgName: org?.clientOrgName ?? 'Client',
      providerAccountName: org?.providerAccountName ?? 'Agency',
    };
  });
}

export async function getPartnerTicket(
  linkedAccountId: string,
  ticketId: string,
): Promise<PartnerTicketDetail | null> {
  const orgs = await listPartnerLinkedOrgs(linkedAccountId);
  const orgIds = new Set(orgs.map((org) => org.clientOrgId));
  if (orgIds.size === 0) return null;

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await adminTable(admin, 'support_tickets')
    .select(
      'id, title, description, status, priority, ticket_number, created_at, client_org_id',
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error || !data) return null;

  const clientOrgId = String(
    (data as { client_org_id?: string }).client_org_id ?? '',
  );
  if (!orgIds.has(clientOrgId)) return null;

  const org = orgs.find((row) => row.clientOrgId === clientOrgId);
  if (!org) return null;

  return {
    id: (data as { id: string }).id,
    title: (data as { title?: string | null }).title ?? 'Untitled',
    description: (data as { description?: string | null }).description ?? null,
    status: (data as { status?: string | null }).status ?? 'open',
    priority: (data as { priority?: string | null }).priority ?? 'medium',
    ticketNumber: Number(
      (data as { ticket_number?: number }).ticket_number ?? 0,
    ),
    createdAt: (data as { created_at: string }).created_at,
    clientOrgId,
    clientOrgName: org.clientOrgName,
    providerAccountName: org.providerAccountName,
    providerAccountId: org.providerAccountId,
    providerAccountSlug: org.providerAccountSlug,
  };
}

export async function listPartnerTicketMessages(
  linkedAccountId: string,
  ticketId: string,
): Promise<PartnerTicketMessage[]> {
  const ticket = await getPartnerTicket(linkedAccountId, ticketId);
  if (!ticket) return [];

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await adminTable(admin, 'ticket_messages')
    .select(
      'id, ticket_id, message, created_at, author_name, attachments, external_url, user_id, is_internal',
    )
    .eq('ticket_id', ticketId)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[partner-support] list messages:', error.message);
    return [];
  }

  const userIds = [
    ...new Set(
      ((data ?? []) as Array<{ user_id?: string | null }>)
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    for (const profile of profiles ?? []) {
      const row = profile as { id: string; full_name?: string | null };
      if (row.full_name) names.set(row.id, row.full_name);
    }
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const userId = row.user_id as string | null;
    return {
      id: String(row.id),
      ticketId: String(row.ticket_id),
      message: String(row.message ?? ''),
      createdAt: String(row.created_at),
      authorName:
        (row.author_name as string | null)?.trim() ||
        (userId ? (names.get(userId) ?? null) : null),
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as SupportAttachmentMeta[])
        : [],
      externalUrl: (row.external_url as string | null) ?? null,
    };
  });
}

async function allocateTicketNumber(providerAccountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await adminTable(admin, 'support_tickets')
    .select('ticket_number')
    .or(
      `account_id.eq.${providerAccountId},business_id.eq.${providerAccountId}`,
    )
    .order('ticket_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    Number((data as { ticket_number?: number } | null)?.ticket_number ?? 0) + 1
  );
}

export async function createPartnerTicket(input: {
  linkedAccountId: string;
  clientOrgId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recordingUrl?: string | null;
  externalUrl?: string | null;
  attachments?: SupportAttachmentMeta[];
}): Promise<PartnerTicketDetail> {
  const user = await assertLinkedAccountMember(input.linkedAccountId);
  const orgs = await listPartnerLinkedOrgs(input.linkedAccountId);
  const org = orgs.find((row) => row.clientOrgId === input.clientOrgId);
  if (!org) throw new Error('Invalid linked client');

  const admin = getSupabaseServerAdminClient();
  const ticketNumber = await allocateTicketNumber(org.providerAccountId);
  const now = new Date().toISOString();
  const publicToken = createSupportPublicToken();

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const submitterName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'Client';
  const submitterEmail = user.email?.toLowerCase() ?? null;

  const { data, error } = await adminTable(admin, 'support_tickets')
    .insert({
      account_id: org.providerAccountId,
      business_id: org.providerAccountId,
      client_org_id: org.clientOrgId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: 'open',
      ticket_number: ticketNumber,
      created_by: user.id,
      public_token: publicToken,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      recording_url: input.recordingUrl?.trim() || null,
      external_url: input.externalUrl?.trim() || null,
      last_activity_at: now,
    })
    .select(
      'id, title, description, status, priority, ticket_number, created_at',
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create ticket');
  }

  await adminTable(admin, 'ticket_messages').insert({
    ticket_id: data.id,
    user_id: user.id,
    message: input.description.trim(),
    is_internal: false,
    author_name: submitterName,
    author_email: submitterEmail,
    attachments: input.attachments ?? [],
    external_url: input.externalUrl?.trim() || null,
  });

  void notifyWorkspaceNewSupportTicket(admin, {
    accountId: org.providerAccountId,
    accountSlug: org.providerAccountSlug,
    ticketId: data.id as string,
    ticketNumber: Number(data.ticket_number),
    title: input.title.trim(),
    description: input.description.trim(),
    submitterName,
    submitterEmail,
    assignedTo: null,
    clientOrgSlug: org.clientOrgSlug,
    publicToken,
  }).catch((err) => {
    console.error('[partner-support] notify new ticket failed', err);
  });

  return {
    id: data.id as string,
    title: (data as { title?: string }).title ?? input.title,
    description: (data as { description?: string | null }).description ?? null,
    status: (data as { status?: string }).status ?? 'open',
    priority: (data as { priority?: string }).priority ?? input.priority,
    ticketNumber: Number(data.ticket_number),
    createdAt: (data as { created_at: string }).created_at,
    clientOrgId: org.clientOrgId,
    clientOrgName: org.clientOrgName,
    providerAccountName: org.providerAccountName,
    providerAccountId: org.providerAccountId,
    providerAccountSlug: org.providerAccountSlug,
  };
}

export async function addPartnerTicketReply(input: {
  linkedAccountId: string;
  ticketId: string;
  message: string;
  attachments?: SupportAttachmentMeta[];
  externalUrl?: string | null;
  reopen?: boolean;
}): Promise<PartnerTicketMessage> {
  const user = await assertLinkedAccountMember(input.linkedAccountId);
  const ticket = await getPartnerTicket(input.linkedAccountId, input.ticketId);
  if (!ticket) throw new Error('Ticket not found');

  const admin = getSupabaseServerAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const authorName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    user.email?.split('@')[0] ||
    'Client';

  const { data, error } = await adminTable(admin, 'ticket_messages')
    .insert({
      ticket_id: input.ticketId,
      user_id: user.id,
      message: input.message.trim(),
      is_internal: false,
      author_name: authorName,
      author_email: user.email?.toLowerCase() ?? null,
      attachments: input.attachments ?? [],
      external_url: input.externalUrl?.trim() || null,
    })
    .select('id, ticket_id, message, created_at, attachments, external_url')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to send message');
  }

  const now = new Date().toISOString();
  let nextStatus = ticket.status;
  if (
    ticket.status === 'waiting' ||
    ticket.status === 'resolved' ||
    ticket.status === 'closed' ||
    input.reopen
  ) {
    nextStatus = 'open';
  }

  await adminTable(admin, 'support_tickets')
    .update({
      status: nextStatus,
      last_activity_at: now,
      updated_at: now,
      ...(nextStatus === 'open' ? { resolved_at: null } : {}),
    })
    .eq('id', input.ticketId);

  const { data: full } = await adminTable(admin, 'support_tickets')
    .select('assigned_to')
    .eq('id', input.ticketId)
    .maybeSingle();

  void notifyWorkspaceSupportClientReply(admin, {
    accountId: ticket.providerAccountId,
    accountSlug: ticket.providerAccountSlug,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    replyBody: input.message.trim(),
    assignedTo:
      (full as { assigned_to?: string | null } | null)?.assigned_to ?? null,
    authorName,
  }).catch((err) => {
    console.error('[partner-support] notify reply failed', err);
  });

  return {
    id: data.id as string,
    ticketId: data.ticket_id as string,
    message: data.message as string,
    createdAt: data.created_at as string,
    authorName,
    attachments: Array.isArray(data.attachments)
      ? (data.attachments as SupportAttachmentMeta[])
      : [],
    externalUrl: (data.external_url as string | null) ?? null,
  };
}
