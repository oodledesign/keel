'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

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

export type PlatformSupportMessengerBootstrap = {
  profile: PlatformSupportMessengerProfile;
  tickets: PlatformSupportMessengerTicketSummary[];
};

export const loadPlatformSupportMessengerBootstrap = enhanceAction(
  async (_input, user): Promise<PlatformSupportMessengerBootstrap> => {
    const client = getSupabaseServerClient();

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

    return {
      profile: {
        firstName,
        email: user.email ?? null,
      },
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
  { schema: z.object({}) },
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
