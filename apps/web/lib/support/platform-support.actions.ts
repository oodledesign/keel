'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  loadTicketAccountName,
  notifySupportTeamNewTicket,
  notifySupportTeamUserReply,
  notifyUserSupportReply,
} from './platform-support-notifications';
import type { SupportAttachmentMeta } from './support-attachment.types';

const AttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number(),
});

const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(10000),
  category: z
    .enum([
      'bug',
      'feedback',
      'feature_request',
      'question',
      'billing',
      'other',
    ])
    .default('question'),
  accountId: z.string().uuid().optional().nullable(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

export const createPlatformSupportTicketAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    if (input.accountId) {
      const { data: membership } = await client
        .from('accounts_memberships')
        .select('account_id')
        .eq('account_id', input.accountId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        throw new Error('You are not a member of that workspace');
      }
    }

    // category column added by migration; generated types may lag until typegen.
     
    const { data, error } = await (
      client.from('platform_support_tickets') as any
    )
      .insert({
        user_id: user.id,
        account_id: input.accountId ?? null,
        subject: input.subject.trim(),
        body: input.body.trim(),
        category: input.category,
        attachments: (input.attachments ?? []) as SupportAttachmentMeta[],
      })
      .select('id, ticket_number, subject, body, category')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const admin = getSupabaseServerAdminClient();
    const accountName = await loadTicketAccountName(
      admin,
      input.accountId ?? null,
    );

    await notifySupportTeamNewTicket(admin, {
      ticketId: data.id as string,
      ticketNumber: data.ticket_number as number,
      subject: data.subject as string,
      body: data.body as string,
      category: (data.category as string | undefined) ?? input.category,
      attachments: input.attachments ?? [],
      userId: user.id,
      accountName,
    }).catch(() => undefined);

    revalidatePath('/app/support');
    return { id: data.id as string };
  },
  { schema: createTicketSchema },
);

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

export const replyPlatformSupportTicketAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    const { data: ticket, error: ticketError } = await client
      .from('platform_support_tickets')
      .select('id, user_id, subject, ticket_number, status')
      .eq('id', input.ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    if ((ticket as { user_id: string }).user_id !== user.id) {
      throw new Error('You cannot reply to this ticket');
    }

    const body = input.body.trim();
     
    const { error } = await (
      client.from('platform_support_messages') as any
    ).insert({
      ticket_id: input.ticketId,
      author_user_id: user.id,
      body,
      is_internal_note: false,
      attachments: input.attachments ?? [],
    });

    if (error) {
      throw new Error(error.message);
    }

    await client
      .from('platform_support_tickets')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.ticketId);

    const admin = getSupabaseServerAdminClient();
    await notifySupportTeamUserReply(admin, {
      ticketId: input.ticketId,
      ticketNumber: (ticket as { ticket_number: number }).ticket_number,
      subject: (ticket as { subject: string }).subject,
      userId: user.id,
      replyBody: body,
      attachments: input.attachments ?? [],
    }).catch(() => undefined);

    revalidatePath('/app/support');
    revalidatePath(`/app/support/${input.ticketId}`);
    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${input.ticketId}`);
    return { success: true };
  },
  { schema: replySchema },
);

const updateTicketSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z
    .enum([
      'bug',
      'feedback',
      'feature_request',
      'question',
      'billing',
      'other',
    ])
    .optional(),
  adminNotes: z.string().max(10000).optional().nullable(),
});

export const adminUpdatePlatformSupportTicketAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    if (!(await isSuperAdmin(client))) {
      throw new Error('Super admin access required');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from('platform_support_tickets') as any)
      .update({
        status: input.status,
        priority: input.priority,
        category: input.category,
        admin_notes: input.adminNotes ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.ticketId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${input.ticketId}`);
    revalidatePath('/app/support');
    return { success: true };
  },
  { schema: updateTicketSchema },
);

const adminReplySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  isInternalNote: z.boolean().optional(),
  attachments: z.array(AttachmentSchema).max(5).optional(),
  status: z
    .enum(['open', 'in_progress', 'waiting', 'resolved', 'closed'])
    .optional(),
});

export const adminReplyPlatformSupportTicketAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    if (!(await isSuperAdmin(client))) {
      throw new Error('Super admin access required');
    }

    const { data: ticket, error: ticketError } = await client
      .from('platform_support_tickets')
      .select('id, user_id, subject, ticket_number')
      .eq('id', input.ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    const body = input.body.trim();
    const isInternal = input.isInternalNote ?? false;

     
    const { error } = await (
      client.from('platform_support_messages') as any
    ).insert({
      ticket_id: input.ticketId,
      author_user_id: user.id,
      body,
      is_internal_note: isInternal,
      attachments: input.attachments ?? [],
    });

    if (error) {
      throw new Error(error.message);
    }

    const nextStatus =
      input.status ?? (isInternal ? undefined : ('waiting' as const));

    if (nextStatus) {
      await client
        .from('platform_support_tickets')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.ticketId);
    } else {
      await client
        .from('platform_support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.ticketId);
    }

    if (!isInternal) {
      const admin = getSupabaseServerAdminClient();
      await notifyUserSupportReply(admin, {
        ticketId: input.ticketId,
        ticketNumber: (ticket as { ticket_number: number }).ticket_number,
        subject: (ticket as { subject: string }).subject,
        userId: (ticket as { user_id: string }).user_id,
        replyBody: body,
        attachments: input.attachments ?? [],
      }).catch(() => undefined);
    }

    revalidatePath('/admin/support');
    revalidatePath(`/admin/support/${input.ticketId}`);
    revalidatePath('/app/support');
    revalidatePath(`/app/support/${input.ticketId}`);
    return { success: true };
  },
  { schema: adminReplySchema },
);
