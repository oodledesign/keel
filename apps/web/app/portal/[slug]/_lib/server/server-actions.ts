'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CreatePortalManagePaymentSessionSchema } from '../schema/portal-billing.schema';
import {
  AddPortalTicketMessageSchema,
  CreatePortalTicketSchema,
  GetPortalTicketSchema,
} from '../schema/portal.schema';
import { createClientPortalService } from './client-portal.service';
import { createPortalBillingService } from './portal-billing.service';

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

export const createPortalManagePaymentSessionAction = enhanceAction(
  async (input) =>
    createPortalBillingService(
      getSupabaseServerClient(),
    ).createManagePaymentSession(input),
  { schema: CreatePortalManagePaymentSessionSchema },
);
