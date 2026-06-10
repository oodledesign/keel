'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateContractSchema,
  DeleteContractSchema,
  GenerateInvoicesFromPaymentPlanSchema,
  GetContractForPortalSchema,
  GetContractPortalLinkSchema,
  GetContractSchema,
  ListContractsSchema,
  SendContractSchema,
  SetContractStatusSchema,
  SignAuthorSchema,
  SignRecipientSchema,
  UpdateContractSchema,
} from '../schema/contracts.schema';
import {
  getContractTabCounts,
  markContractReadByToken,
  signContractRecipientByToken,
} from './contract-v2.server';
import { createContractsService } from './contracts.service';

function getService() {
  return createContractsService(getSupabaseServerClient());
}

export const listContracts = enhanceAction(
  async (input) => getService().listContracts(input),
  { schema: ListContractsSchema },
);

export const getContract = enhanceAction(
  async (input) => getService().getContract(input),
  { schema: GetContractSchema },
);

export const createContract = enhanceAction(
  async (input) => getService().createContract(input),
  { schema: CreateContractSchema },
);

export const updateContract = enhanceAction(
  async (input) => getService().updateContract(input),
  { schema: UpdateContractSchema },
);

export const deleteContract = enhanceAction(
  async (input) => getService().deleteContract(input),
  { schema: DeleteContractSchema },
);

export const sendContract = enhanceAction(
  async (input) => getService().sendContract(input),
  { schema: SendContractSchema },
);

export const signAuthor = enhanceAction(
  async (input) => getService().signAuthor(input),
  { schema: SignAuthorSchema },
);

export const signRecipient = enhanceAction(
  async (input) => getService().signRecipient(input),
  { schema: SignRecipientSchema },
);

export const setContractStatus = enhanceAction(
  async (input) => getService().setContractStatus(input),
  { schema: SetContractStatusSchema },
);

export const generateInvoicesFromPaymentPlan = enhanceAction(
  async (input) => getService().generateInvoicesFromPaymentPlan(input),
  { schema: GenerateInvoicesFromPaymentPlanSchema },
);

export const getContractForPortal = enhanceAction(
  async (input) => getService().getContractForPortal(input),
  { schema: GetContractForPortalSchema },
);

export const getContractPortalLink = enhanceAction(
  async (input) => getService().getContractPortalLink(input),
  { schema: GetContractPortalLinkSchema },
);

export const getContractTabCountsAction = enhanceAction(
  async (input) => getContractTabCounts(input.accountId),
  { schema: ListContractsSchema.pick({ accountId: true }) },
);

export const markContractReadByTokenAction = enhanceAction(
  async (input) => {
    await markContractReadByToken(input.token);
    return { ok: true };
  },
  { schema: GetContractForPortalSchema },
);

export const signContractRecipientByTokenAction = enhanceAction(
  async (input) =>
    signContractRecipientByToken(input.token, {
      recipient_type: input.recipient_type,
      recipient_name: input.recipient_name,
      recipient_company: input.recipient_company ?? null,
      recipient_signature_type: input.recipient_signature_type,
      recipient_signature_data: input.recipient_signature_data,
    }),
  { schema: SignRecipientSchema },
);
