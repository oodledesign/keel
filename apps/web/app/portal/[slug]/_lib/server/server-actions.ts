'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { CreatePortalManagePaymentSessionSchema } from '../schema/portal-billing.schema';
import {
  CreatePortalCreditTopupSchema,
  ListPortalRequestTypesSchema,
} from '../schema/portal-credits.schema';
import {
  AddPortalTaskCommentSchema,
  AddPortalTicketMessageSchema,
  CreatePortalTicketSchema,
  GetPortalTicketSchema,
  ListPortalProjectsSchema,
  SendPortalMessageSchema,
} from '../schema/portal.schema';
import { createClientPortalService } from './client-portal.service';
import { createPortalBillingService } from './portal-billing.service';
import { createPortalCreditsService } from './portal-credits.service';

function getService() {
  return createClientPortalService(getSupabaseServerClient());
}

function getCreditsService() {
  return createPortalCreditsService(getSupabaseServerClient());
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

export const listPortalProjects = enhanceAction(
  async (input) =>
    getService().listProjects(input.clientOrgId, input.accountId),
  { schema: ListPortalProjectsSchema },
);

export const listPortalRequestTypes = enhanceAction(
  async (input) =>
    getCreditsService().listActiveRequestTypes(input.clientOrgId),
  { schema: ListPortalRequestTypesSchema },
);

export const createPortalCreditTopupAction = enhanceAction(
  async (input) => getCreditsService().createTopupInvoice(input),
  { schema: CreatePortalCreditTopupSchema },
);

export const addPortalTaskComment = enhanceAction(
  async (input) =>
    getService().addPortalTaskComment(
      input.clientOrgId,
      input.taskId,
      input.projectId,
      input.body,
    ),
  { schema: AddPortalTaskCommentSchema },
);

export const sendPortalMessage = enhanceAction(
  async (input) =>
    getService().sendPortalMessage(
      input.clientOrgId,
      input.threadId,
      input.body,
    ),
  { schema: SendPortalMessageSchema },
);

export const createPortalManagePaymentSessionAction = enhanceAction(
  async (input) =>
    createPortalBillingService(
      getSupabaseServerClient(),
    ).createManagePaymentSession(input),
  { schema: CreatePortalManagePaymentSessionSchema },
);
