import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type PlatformSupportMessage = {
  id: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  authorEmail: string | null;
  authorIsCurrentUser: boolean;
};

export type PlatformSupportTicketDetail = {
  id: string;
  ticketNumber: number;
  subject: string;
  body: string;
  status: string;
  priority: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userEmail: string | null;
  accountId: string | null;
  accountName: string | null;
  messages: PlatformSupportMessage[];
};

export const loadUserPlatformSupportTicket = cache(
  async (
    ticketId: string,
    userId: string,
  ): Promise<PlatformSupportTicketDetail | null> => {
    const client = getSupabaseServerClient();

    const { data: ticket, error } = await client
      .from('platform_support_tickets')
      .select(
        'id, ticket_number, subject, body, status, priority, admin_notes, created_at, updated_at, user_id, account_id',
      )
      .eq('id', ticketId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !ticket) {
      return null;
    }

    return loadTicketDetail(client, ticket, userId, false);
  },
);

export const loadAdminPlatformSupportTicket = cache(
  async (ticketId: string): Promise<PlatformSupportTicketDetail | null> => {
    const client = getSupabaseServerClient();

    const { data: ticket, error } = await client
      .from('platform_support_tickets')
      .select(
        'id, ticket_number, subject, body, status, priority, admin_notes, created_at, updated_at, user_id, account_id',
      )
      .eq('id', ticketId)
      .maybeSingle();

    if (error || !ticket) {
      return null;
    }

    return loadTicketDetail(client, ticket, null, true);
  },
);

async function loadTicketDetail(
  client: ReturnType<typeof getSupabaseServerClient>,
  ticket: Record<string, unknown>,
  viewerUserId: string | null,
  includeInternalNotes: boolean,
): Promise<PlatformSupportTicketDetail> {
  const ticketId = ticket.id as string;
  const userId = ticket.user_id as string;

  let messagesQuery = client
    .from('platform_support_messages')
    .select('id, body, is_internal_note, created_at, author_user_id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (!includeInternalNotes) {
    messagesQuery = messagesQuery.eq('is_internal_note', false);
  }

  const [messagesResult, accountResult] = await Promise.all([
    messagesQuery,
    ticket.account_id
      ? client
          .from('accounts')
          .select('name, slug')
          .eq('id', ticket.account_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const admin = getSupabaseServerAdminClient();
  const authorIds = [
    ...new Set(
      (messagesResult.data ?? []).map(
        (m) => (m as { author_user_id: string }).author_user_id,
      ),
    ),
    userId,
  ];

  const authorEmails = new Map<string, string | null>();
  await Promise.all(
    authorIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      authorEmails.set(id, data.user?.email ?? null);
    }),
  );

  const account = accountResult.data as {
    name?: string | null;
    slug?: string | null;
  } | null;

  return {
    id: ticketId,
    ticketNumber: ticket.ticket_number as number,
    subject: ticket.subject as string,
    body: ticket.body as string,
    status: ticket.status as string,
    priority: ticket.priority as string,
    adminNotes: (ticket.admin_notes as string | null) ?? null,
    createdAt: ticket.created_at as string,
    updatedAt: ticket.updated_at as string,
    userId,
    userEmail: authorEmails.get(userId) ?? null,
    accountId: (ticket.account_id as string | null) ?? null,
    accountName: account?.name ?? account?.slug ?? null,
    messages: (messagesResult.data ?? []).map((row) => {
      const authorId = (row as { author_user_id: string }).author_user_id;
      return {
        id: (row as { id: string }).id,
        body: (row as { body: string }).body,
        isInternalNote: (row as { is_internal_note: boolean }).is_internal_note,
        createdAt: (row as { created_at: string }).created_at,
        authorEmail: authorEmails.get(authorId) ?? null,
        authorIsCurrentUser: viewerUserId
          ? authorId === viewerUserId
          : false,
      };
    }),
  };
}
