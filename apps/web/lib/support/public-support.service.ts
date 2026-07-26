import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createSupportPublicToken } from '~/lib/support/support-tokens';
import type { SupportAttachmentMeta } from '~/lib/support/support-tokens';
import {
  notifyWorkspaceNewSupportTicket,
  notifyWorkspaceSupportClientReply,
} from '~/lib/support/workspace-support-notifications';

export type PublicSupportContactOption = {
  id: string;
  name: string;
  email: string | null;
};

export type PublicSupportProjectOption = {
  id: string;
  name: string;
};

export type PublicSupportOrgContext = {
  clientOrgId: string;
  clientOrgName: string;
  clientOrgSlug: string;
  accountId: string;
  accountSlug: string;
  accountName: string;
  contacts: PublicSupportContactOption[];
  projects: PublicSupportProjectOption[];
};

export type PublicTicketThread = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ticketNumber: number;
  publicToken: string;
  recordingUrl: string | null;
  externalUrl: string | null;
  projectName: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  accountId: string;
  accountSlug: string;
  clientOrgId: string | null;
  clientOrgSlug: string | null;
  assignedTo: string | null;
  messages: Array<{
    id: string;
    message: string;
    createdAt: string;
    authorName: string | null;
    isInternal: boolean;
    attachments: SupportAttachmentMeta[];
    externalUrl: string | null;
  }>;
};

function admin() {
  return getSupabaseServerAdminClient();
}

async function allocateTicketNumber(accountId: string) {
  const client = admin();
  const { data } = await client
    .from('support_tickets')
    .select('ticket_number')
    .or(`account_id.eq.${accountId},business_id.eq.${accountId}`)
    .order('ticket_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    Number((data as { ticket_number?: number } | null)?.ticket_number ?? 0) + 1
  );
}

async function loadContactsForOrg(clientOrgId: string) {
  const client = admin();
  const { data: clients } = await client
    .from('clients')
    .select('id')
    .eq('client_org_id', clientOrgId);

  const clientIds = (clients ?? []).map((row) => (row as { id: string }).id);
  if (clientIds.length === 0) return [] as PublicSupportContactOption[];

  const { data } = await client
    .from('client_contacts')
    .select('contacts ( id, full_name, first_name, last_name, email )')
    .in('client_id', clientIds);

  const seen = new Set<string>();
  const contacts: PublicSupportContactOption[] = [];

  for (const row of data ?? []) {
    const contact = (
      row as {
        contacts?: {
          id?: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
        } | null;
      }
    ).contacts;
    if (!contact?.id || seen.has(contact.id)) continue;
    seen.add(contact.id);
    const name =
      contact.full_name?.trim() ||
      [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      contact.email ||
      'Contact';
    contacts.push({
      id: contact.id,
      name,
      email: contact.email?.trim() || null,
    });
  }

  return contacts.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadProjectsForOrg(accountId: string, clientOrgId: string) {
  const client = admin();
  const { data: clients } = await client
    .from('clients')
    .select('id')
    .eq('client_org_id', clientOrgId);

  const clientIds = (clients ?? []).map((row) => (row as { id: string }).id);
  if (clientIds.length === 0) return [] as PublicSupportProjectOption[];

  const { data } = await client
    .from('projects')
    .select('id, name, title')
    .eq('account_id', accountId)
    .in('client_id', clientIds)
    .order('updated_at', { ascending: false })
    .limit(50);

  return (
    (data ?? []) as Array<{
      id: string;
      name?: string | null;
      title?: string | null;
    }>
  ).map((row) => ({
    id: row.id,
    name: row.name?.trim() || row.title?.trim() || 'Project',
  }));
}

export async function loadPublicSupportOrgByToken(
  token: string,
): Promise<PublicSupportOrgContext | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const client = admin();
  const { data: org, error } = await client
    .from('client_orgs')
    .select('id, name, slug, business_id, support_public_token')
    .eq('support_public_token', trimmed)
    .maybeSingle();

  if (error || !org) return null;

  const businessId = (org as { business_id?: string | null }).business_id;
  let accountId: string | null = null;

  if (businessId) {
    const { data: business } = await client
      .from('businesses')
      .select('account_id')
      .eq('id', businessId)
      .maybeSingle();
    accountId =
      (business as { account_id?: string | null } | null)?.account_id ??
      businessId;
  }

  if (!accountId) return null;

  const { data: account } = await client
    .from('accounts')
    .select('id, name, slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) return null;

  const [contacts, projects] = await Promise.all([
    loadContactsForOrg((org as { id: string }).id),
    loadProjectsForOrg(accountId, (org as { id: string }).id),
  ]);

  return {
    clientOrgId: (org as { id: string }).id,
    clientOrgName:
      (org as { name?: string | null }).name?.trim() ||
      (org as { slug: string }).slug,
    clientOrgSlug: (org as { slug: string }).slug,
    accountId,
    accountSlug: account.slug as string,
    accountName:
      (account as { name?: string | null }).name?.trim() ||
      (account.slug as string),
    contacts,
    projects,
  };
}

export async function createPublicSupportTicket(input: {
  token: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  submitterContactId: string | null;
  submitterName: string;
  submitterEmail: string;
  projectId: string | null;
  recordingUrl: string | null;
  externalUrl: string | null;
  attachments?: SupportAttachmentMeta[];
}): Promise<{ ticketId: string; publicToken: string; ticketNumber: number }> {
  const ctx = await loadPublicSupportOrgByToken(input.token);
  if (!ctx) {
    throw new Error('Support link is invalid or has been rotated');
  }

  if (input.projectId) {
    const allowed = ctx.projects.some(
      (project) => project.id === input.projectId,
    );
    if (!allowed) {
      throw new Error('Invalid project for this client');
    }
  }

  let submitterName = input.submitterName.trim();
  let submitterEmail = input.submitterEmail.trim().toLowerCase();
  const submitterContactId = input.submitterContactId;

  if (submitterContactId) {
    const contact = ctx.contacts.find((row) => row.id === submitterContactId);
    if (!contact) {
      throw new Error('Invalid contact');
    }
    submitterName = contact.name;
    submitterEmail = (contact.email ?? submitterEmail).toLowerCase();
  }

  if (!submitterName || !submitterEmail) {
    throw new Error('Submitter name and email are required');
  }

  const client = admin();
  const ticketNumber = await allocateTicketNumber(ctx.accountId);
  const publicToken = createSupportPublicToken();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('support_tickets')
    .insert({
      account_id: ctx.accountId,
      business_id: ctx.accountId,
      client_org_id: ctx.clientOrgId,
      project_id: input.projectId,
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: 'open',
      ticket_number: ticketNumber,
      public_token: publicToken,
      submitter_contact_id: submitterContactId,
      submitter_name: submitterName,
      submitter_email: submitterEmail,
      recording_url: input.recordingUrl?.trim() || null,
      external_url: input.externalUrl?.trim() || null,
      last_activity_at: now,
    })
    .select('id, ticket_number, public_token')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create ticket');
  }

  const { error: messageError } = await client.from('ticket_messages').insert({
    ticket_id: data.id,
    user_id: null,
    message: input.description.trim(),
    is_internal: false,
    author_name: submitterName,
    author_email: submitterEmail,
    attachments: input.attachments ?? [],
    external_url: input.externalUrl?.trim() || null,
  });

  if (messageError) {
    console.error(
      '[public-support] opening message insert failed:',
      messageError.message,
    );
    throw new Error(
      messageError.message || 'Failed to save opening ticket message',
    );
  }

  void notifyWorkspaceNewSupportTicket(client, {
    accountId: ctx.accountId,
    accountSlug: ctx.accountSlug,
    ticketId: data.id as string,
    ticketNumber: Number(data.ticket_number),
    title: input.title.trim(),
    description: input.description.trim(),
    submitterName,
    submitterEmail,
    assignedTo: null,
    clientOrgSlug: ctx.clientOrgSlug,
    publicToken: data.public_token as string,
    attachments: input.attachments ?? [],
  }).catch((err) => {
    console.error('[public-support] notify new ticket failed', err);
  });

  return {
    ticketId: data.id as string,
    publicToken: data.public_token as string,
    ticketNumber: Number(data.ticket_number),
  };
}

export async function loadPublicSupportTicketByToken(
  token: string,
): Promise<PublicTicketThread | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const client = admin();
  const { data: ticket, error } = await client
    .from('support_tickets')
    .select(
      'id, title, description, status, priority, ticket_number, public_token, recording_url, external_url, submitter_name, submitter_email, account_id, business_id, client_org_id, assigned_to, project_id, created_at, projects(name, title), client_orgs(slug)',
    )
    .eq('public_token', trimmed)
    .maybeSingle();

  if (error || !ticket) return null;

  const accountId =
    (ticket as { account_id?: string | null }).account_id ??
    (ticket as { business_id?: string | null }).business_id;
  if (!accountId) return null;

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  const { data: messages } = await client
    .from('ticket_messages')
    .select(
      'id, message, created_at, is_internal, author_name, author_email, attachments, external_url, user_id',
    )
    .eq('ticket_id', (ticket as { id: string }).id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });

  const userIds = [
    ...new Set(
      ((messages ?? []) as Array<{ user_id?: string | null }>)
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const authorNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await client
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    for (const profile of profiles ?? []) {
      const row = profile as { id: string; full_name?: string | null };
      if (row.full_name) authorNames.set(row.id, row.full_name);
    }
  }

  const project = (
    ticket as {
      projects?:
        | { name?: string | null; title?: string | null }
        | Array<{ name?: string | null; title?: string | null }>
        | null;
    }
  ).projects;
  const projectRow = Array.isArray(project) ? project[0] : project;
  const org = (
    ticket as {
      client_orgs?:
        | { slug?: string | null }
        | Array<{ slug?: string | null }>
        | null;
    }
  ).client_orgs;
  const orgRow = Array.isArray(org) ? org[0] : org;

  return {
    id: (ticket as { id: string }).id,
    title: (ticket as { title?: string | null }).title ?? 'Untitled',
    description:
      (ticket as { description?: string | null }).description ?? null,
    status: (ticket as { status?: string | null }).status ?? 'open',
    priority: (ticket as { priority?: string | null }).priority ?? 'medium',
    ticketNumber: Number(
      (ticket as { ticket_number?: number }).ticket_number ?? 0,
    ),
    publicToken: (ticket as { public_token: string }).public_token,
    recordingUrl:
      (ticket as { recording_url?: string | null }).recording_url ?? null,
    externalUrl:
      (ticket as { external_url?: string | null }).external_url ?? null,
    projectName: projectRow?.name?.trim() || projectRow?.title?.trim() || null,
    submitterName:
      (ticket as { submitter_name?: string | null }).submitter_name ?? null,
    submitterEmail:
      (ticket as { submitter_email?: string | null }).submitter_email ?? null,
    accountId,
    accountSlug: (account as { slug?: string } | null)?.slug ?? '',
    clientOrgId:
      (ticket as { client_org_id?: string | null }).client_org_id ?? null,
    clientOrgSlug: orgRow?.slug ?? null,
    assignedTo: (ticket as { assigned_to?: string | null }).assigned_to ?? null,
    messages: (() => {
      const mapped = ((messages ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const userId = row.user_id as string | null;
          return {
            id: String(row.id),
            message: String(row.message ?? ''),
            createdAt: String(row.created_at),
            authorName:
              (row.author_name as string | null) ||
              (userId ? (authorNames.get(userId) ?? null) : null) ||
              ((ticket as { submitter_name?: string | null }).submitter_name ??
                null) ||
              'Support',
            isInternal: Boolean(row.is_internal),
            attachments: Array.isArray(row.attachments)
              ? (row.attachments as SupportAttachmentMeta[])
              : [],
            externalUrl: (row.external_url as string | null) ?? null,
          };
        })
        .filter((row) => row.message.trim());

      const description =
        (ticket as { description?: string | null }).description?.trim() ?? '';
      if (mapped.length === 0 && description) {
        return [
          {
            id: `opening-${(ticket as { id: string }).id}`,
            message: description,
            createdAt: String(
              (ticket as { created_at?: string | null }).created_at ??
                new Date().toISOString(),
            ),
            authorName:
              (ticket as { submitter_name?: string | null }).submitter_name ??
              'Client',
            isInternal: false,
            attachments: [] as SupportAttachmentMeta[],
            externalUrl:
              (ticket as { external_url?: string | null }).external_url ?? null,
          },
        ];
      }

      return mapped;
    })(),
  };
}

export async function addPublicSupportTicketReply(input: {
  token: string;
  message: string;
  authorName: string;
  authorEmail: string;
  attachments?: SupportAttachmentMeta[];
  externalUrl?: string | null;
}): Promise<void> {
  const ticket = await loadPublicSupportTicketByToken(input.token);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw new Error('This ticket is closed');
  }

  const client = admin();
  const now = new Date().toISOString();
  const nextStatus =
    ticket.status === 'waiting' || ticket.status === 'resolved'
      ? 'open'
      : ticket.status;

  const { error: replyError } = await client.from('ticket_messages').insert({
    ticket_id: ticket.id,
    user_id: null,
    message: input.message.trim(),
    is_internal: false,
    author_name: input.authorName.trim() || ticket.submitterName,
    author_email:
      input.authorEmail.trim().toLowerCase() || ticket.submitterEmail,
    attachments: input.attachments ?? [],
    external_url: input.externalUrl?.trim() || null,
  });

  if (replyError) {
    throw new Error(replyError.message || 'Failed to send reply');
  }

  await client
    .from('support_tickets')
    .update({
      status: nextStatus,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', ticket.id);

  void notifyWorkspaceSupportClientReply(client, {
    accountId: ticket.accountId,
    accountSlug: ticket.accountSlug,
    ticketId: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    replyBody: input.message.trim(),
    assignedTo: ticket.assignedTo,
    authorName: input.authorName.trim() || ticket.submitterName,
    attachments: input.attachments ?? [],
  }).catch((err) => {
    console.error('[public-support] notify client reply failed', err);
  });
}

export async function ensureClientOrgSupportToken(
  clientOrgId: string,
): Promise<string> {
  const client = admin();
  const { data } = await client
    .from('client_orgs')
    .select('support_public_token')
    .eq('id', clientOrgId)
    .maybeSingle();

  const existing = (data as { support_public_token?: string | null } | null)
    ?.support_public_token;
  if (existing) return existing;

  const token = createSupportPublicToken();
  const { error } = await client
    .from('client_orgs')
    .update({ support_public_token: token })
    .eq('id', clientOrgId);

  if (error) {
    throw new Error(error.message);
  }

  return token;
}

export async function rotateClientOrgSupportToken(
  clientOrgId: string,
): Promise<string> {
  const client = admin();
  const token = createSupportPublicToken();
  const { error } = await client
    .from('client_orgs')
    .update({ support_public_token: token })
    .eq('id', clientOrgId);

  if (error) {
    throw new Error(error.message);
  }

  return token;
}
