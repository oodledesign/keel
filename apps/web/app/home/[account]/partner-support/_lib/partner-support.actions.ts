'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import {
  addPartnerTicketReply,
  createPartnerTicket,
  getPartnerTicket,
  listPartnerLinkedOrgs,
  listPartnerTicketMessages,
  listPartnerTickets,
} from '~/lib/support/partner-support.service';

const LinkedAccountSchema = z.object({
  linkedAccountId: z.string().uuid(),
});

const TicketAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number(),
});

export const listPartnerLinkedOrgsAction = enhanceAction(
  async (input) => listPartnerLinkedOrgs(input.linkedAccountId),
  { schema: LinkedAccountSchema },
);

export const listPartnerTicketsAction = enhanceAction(
  async (input) => listPartnerTickets(input.linkedAccountId),
  { schema: LinkedAccountSchema },
);

export const getPartnerTicketAction = enhanceAction(
  async (input) => getPartnerTicket(input.linkedAccountId, input.ticketId),
  {
    schema: LinkedAccountSchema.extend({
      ticketId: z.string().uuid(),
    }),
  },
);

export const listPartnerTicketMessagesAction = enhanceAction(
  async (input) =>
    listPartnerTicketMessages(input.linkedAccountId, input.ticketId),
  {
    schema: LinkedAccountSchema.extend({
      ticketId: z.string().uuid(),
    }),
  },
);

export const createPartnerTicketAction = enhanceAction(
  async (input) =>
    createPartnerTicket({
      linkedAccountId: input.linkedAccountId,
      clientOrgId: input.clientOrgId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      recordingUrl: input.recording_url,
      externalUrl: input.external_url,
      attachments: input.attachments,
    }),
  {
    schema: LinkedAccountSchema.extend({
      clientOrgId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      recording_url: z.string().url().nullable().optional().or(z.literal('')),
      external_url: z.string().url().nullable().optional().or(z.literal('')),
      attachments: z.array(TicketAttachmentSchema).max(5).optional(),
    }),
  },
);

export const addPartnerTicketReplyAction = enhanceAction(
  async (input) =>
    addPartnerTicketReply({
      linkedAccountId: input.linkedAccountId,
      ticketId: input.ticketId,
      message: input.message,
      attachments: input.attachments,
      externalUrl: input.external_url,
      reopen: input.reopen,
    }),
  {
    schema: LinkedAccountSchema.extend({
      ticketId: z.string().uuid(),
      message: z.string().min(1),
      attachments: z.array(TicketAttachmentSchema).max(5).optional(),
      external_url: z.string().url().nullable().optional().or(z.literal('')),
      reopen: z.boolean().optional(),
    }),
  },
);
