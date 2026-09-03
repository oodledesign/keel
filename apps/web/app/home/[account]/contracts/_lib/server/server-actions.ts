'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  ArchiveContractSchema,
  CreateContractSchema,
  CreateContractTemplateSchema,
  CreateContractVersionSchema,
  DeclineRecipientSchema,
  DeleteContractSchema,
  DeleteContractTemplateSchema,
  DuplicateContractSchema,
  GenerateInvoicesFromPaymentPlanSchema,
  GetContractForPortalSchema,
  GetContractPortalLinkSchema,
  GetContractSchema,
  ListContractEventsSchema,
  ListContractTemplatesSchema,
  ListContractsSchema,
  RevokeContractPortalLinkSchema,
  SaveContractAsTemplateSchema,
  SendContractReminderSchema,
  SendContractSchema,
  SetContractPortalLinkExpirySchema,
  SetContractStatusSchema,
  SignAuthorSchema,
  SignRecipientSchema,
  UpdateContractSchema,
  UpdateContractTemplateSchema,
  UpsertContractSignersSchema,
} from '../schema/contracts.schema';
import {
  declineContractRecipientByToken,
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

export const archiveContract = enhanceAction(
  async (input) => getService().archiveContract(input),
  { schema: ArchiveContractSchema },
);

export const duplicateContract = enhanceAction(
  async (input) => getService().duplicateContract(input),
  { schema: DuplicateContractSchema },
);

export const sendContractReminder = enhanceAction(
  async (input) => getService().sendContractReminder(input),
  { schema: SendContractReminderSchema },
);

export const setContractPortalLinkExpiry = enhanceAction(
  async (input) => getService().setContractPortalLinkExpiry(input),
  { schema: SetContractPortalLinkExpirySchema },
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

export const revokeContractPortalLink = enhanceAction(
  async (input) => getService().revokeContractPortalLink(input),
  { schema: RevokeContractPortalLinkSchema },
);

export const listContractEvents = enhanceAction(
  async (input) => getService().listContractEvents(input),
  { schema: ListContractEventsSchema },
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
  { schema: GetContractForPortalSchema, auth: false, verifyEmail: false },
);

export const declineContractRecipientByTokenAction = enhanceAction(
  async (input) =>
    declineContractRecipientByToken(input.token, input.reason ?? null),
  { schema: DeclineRecipientSchema, auth: false, verifyEmail: false },
);

export const signContractRecipientByTokenAction = enhanceAction(
  async (input) =>
    signContractRecipientByToken(input.token, {
      recipient_type: input.recipient_type,
      recipient_name: input.recipient_name,
      recipient_company: input.recipient_company ?? null,
      recipient_signature_type: input.recipient_signature_type,
      recipient_signature_data: input.recipient_signature_data,
      version_id: input.version_id,
      content_hash: input.content_hash,
      signer_id: input.signer_id,
    }),
  { schema: SignRecipientSchema, auth: false, verifyEmail: false },
);

export const listContractTemplates = enhanceAction(
  async (input) => getService().listContractTemplates(input),
  { schema: ListContractTemplatesSchema },
);

export const createContractTemplate = enhanceAction(
  async (input) => getService().createContractTemplate(input),
  { schema: CreateContractTemplateSchema },
);

export const updateContractTemplate = enhanceAction(
  async (input) => getService().updateContractTemplate(input),
  { schema: UpdateContractTemplateSchema },
);

export const deleteContractTemplate = enhanceAction(
  async (input) => getService().deleteContractTemplate(input),
  { schema: DeleteContractTemplateSchema },
);

export const saveContractAsTemplate = enhanceAction(
  async (input) => getService().saveContractAsTemplate(input),
  { schema: SaveContractAsTemplateSchema },
);

export const createContractVersion = enhanceAction(
  async (input) => getService().createNewVersion(input),
  { schema: CreateContractVersionSchema },
);

export const upsertContractSigners = enhanceAction(
  async (input) => getService().upsertAdditionalSigners(input),
  { schema: UpsertContractSignersSchema },
);
