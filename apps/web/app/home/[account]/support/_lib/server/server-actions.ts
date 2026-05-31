'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddTicketMessageSchema,
  CreateTicketSchema,
  GetTicketSchema,
  ListTicketsSchema,
  ListWebsitesForOrgSchema,
  UpdateTicketSchema,
} from '../schema/support-tickets.schema';
import { createSupportTicketsService } from './support-tickets.service';

function getService() {
  return createSupportTicketsService(getSupabaseServerClient());
}

export const listSupportTickets = enhanceAction(
  async (input) => getService().listTickets(input),
  { schema: ListTicketsSchema },
);

export const getSupportTicket = enhanceAction(
  async (input) => getService().getTicket(input),
  { schema: GetTicketSchema },
);

export const listSupportTicketMessages = enhanceAction(
  async (input) =>
    getService().listTicketMessages(input.accountId, input.ticketId),
  { schema: GetTicketSchema },
);

export const listSupportClientOrgs = enhanceAction(
  async (input: { accountId: string }) =>
    getService().listClientOrgs(input.accountId),
  { schema: ListTicketsSchema.pick({ accountId: true }) },
);

export const listSupportWebsitesForOrg = enhanceAction(
  async (input) =>
    getService().listWebsitesForOrg(input.accountId, input.clientOrgId),
  { schema: ListWebsitesForOrgSchema },
);

export const listSupportTeamMembers = enhanceAction(
  async (input: { accountSlug: string }) =>
    getService().listTeamMembers(input.accountSlug),
  { schema: z.object({ accountSlug: z.string().min(1) }) },
);

export const createSupportTicket = enhanceAction(
  async (input) => getService().createTicket(input),
  { schema: CreateTicketSchema },
);

export const updateSupportTicket = enhanceAction(
  async (input) => getService().updateTicket(input),
  { schema: UpdateTicketSchema },
);

export const addSupportTicketMessage = enhanceAction(
  async (input) => getService().addTicketMessage(input),
  { schema: AddTicketMessageSchema },
);
