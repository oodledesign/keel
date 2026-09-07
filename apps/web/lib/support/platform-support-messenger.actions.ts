'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  type PlatformSupportTicketDetail,
  loadUserPlatformSupportTicket,
} from '~/lib/support/load-platform-support-ticket';
import { formatPlatformSupportCategory } from '~/lib/support/platform-support.types';

export type PlatformSupportMessengerTicketSummary = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  category: string;
  categoryLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSupportMessengerProfile = {
  firstName: string;
  email: string | null;
};

export type PlatformSupportMessengerInboxItem = {
  threadId: string;
  title: string;
  preview: string | null;
  href: string;
  updatedAt: string;
};

export type PlatformSupportMessengerBootstrap = {
  profile: PlatformSupportMessengerProfile;
  tickets: PlatformSupportMessengerTicketSummary[];
  inbox: PlatformSupportMessengerInboxItem[];
  inboxHref: string | null;
};

export const loadPlatformSupportMessengerBootstrap = enhanceAction(
  async (input, user): Promise<PlatformSupportMessengerBootstrap> => {
    const client = getSupabaseServerClient();
    const defaultAccountId =
      typeof input.accountId === 'string' ? input.accountId : null;

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const fullName =
      (typeof meta?.full_name === 'string' && meta.full_name) ||
      (typeof meta?.name === 'string' && meta.name) ||
      '';
    const firstName =
      fullName.trim().split(/\s+/)[0] || user.email?.split('@')[0] || 'there';

    const { data: tickets } = await client
      .from('platform_support_tickets')
      .select(
        'id, ticket_number, subject, status, category, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(30);

    let inbox: PlatformSupportMessengerInboxItem[] = [];
    let inboxHref: string | null = null;
    if (defaultAccountId) {
      try {
        const { createMessagesService } =
          await import('~/home/[account]/messages/_lib/server/messages.service');
        const { data: account } = await client
          .from('accounts')
          .select('slug')
          .eq('id', defaultAccountId)
          .maybeSingle();
        const slug = (account as { slug?: string | null } | null)?.slug;
        if (slug) {
          inboxHref = pathsConfig.app.accountMessages.replace(
            '[account]',
            slug,
          );
          const threads = await createMessagesService().listThreads({
            accountId: defaultAccountId,
            userId: user.id,
            limit: 8,
          });
          inbox = threads.map((thread) => ({
            threadId: thread.id,
            title:
              thread.title?.trim() ||
              thread.participants
                .map((p) => p.display_name)
                .filter(Boolean)
                .slice(0, 3)
                .join(', ') ||
              'Conversation',
            preview: thread.last_message_preview,
            href: `${inboxHref}?thread=${thread.id}`,
            updatedAt: thread.last_message_at,
          }));
        }
      } catch {
        inbox = [];
      }
    }

    return {
      profile: {
        firstName,
        email: user.email ?? null,
      },
      inbox,
      inboxHref,
      tickets: (tickets ?? []).map((ticket) => {
        const category =
          String(
            (ticket as { category?: string | null }).category ?? 'question',
          ) || 'question';
        return {
          id: String(ticket.id),
          ticketNumber: Number(ticket.ticket_number ?? 0),
          subject: String(ticket.subject ?? 'Support request'),
          status: String(ticket.status ?? 'open'),
          category,
          categoryLabel: formatPlatformSupportCategory(category),
          createdAt: String(ticket.created_at ?? new Date().toISOString()),
          updatedAt: String(
            ticket.updated_at ?? ticket.created_at ?? new Date().toISOString(),
          ),
        };
      }),
    };
  },
  { schema: z.object({ accountId: z.string().uuid().optional().nullable() }) },
);

export const loadPlatformSupportMessengerTicketAction = enhanceAction(
  async (input, user): Promise<PlatformSupportTicketDetail> => {
    const detail = await loadUserPlatformSupportTicket(input.ticketId, user.id);
    if (!detail) {
      throw new Error('Ticket not found');
    }
    return detail;
  },
  {
    schema: z.object({
      ticketId: z.string().uuid(),
    }),
  },
);
