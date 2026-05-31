'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddPortalTicketMessageSchema,
  CreatePortalTicketSchema,
  GetPortalTicketSchema,
} from '../schema/portal.schema';
import { createClientPortalService } from './client-portal.service';

function getService() {
  return createClientPortalService(getSupabaseServerClient());
}

export const createPortalTicket = enhanceAction(
  async (input) => getService().createTicket(input),
  { schema: CreatePortalTicketSchema },
);

export const addPortalTicketMessage = enhanceAction(
  async (input) => getService().addTicketMessage(input),
  { schema: AddPortalTicketMessageSchema },
);

export const getPortalTicketMessages = enhanceAction(
  async (input) =>
    getService().listTicketMessages(input.clientOrgId, input.ticketId),
  { schema: GetPortalTicketSchema },
);
