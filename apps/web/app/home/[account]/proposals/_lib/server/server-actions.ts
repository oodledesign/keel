'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  AddProposalCommentByTokenSchema,
  AddProposalCommentSchema,
  ApproveProposalByTokenSchema,
  ArchiveProposalSchema,
  CreateProposalSchema,
  DeclineProposalByTokenSchema,
  DeleteProposalSchema,
  DuplicateProposalSchema,
  GetProposalForPortalSchema,
  GetProposalPortalLinkSchema,
  GetProposalSchema,
  ListProposalsSchema,
  ResendProposalSchema,
  SendProposalSchema,
  SetProposalStatusSchema,
  UpdateProposalSchema,
} from '../schema/proposals.schema';
import {
  addProposalCommentByToken,
  approveProposalByToken,
  archiveProposal,
  declineProposalByToken,
  duplicateProposal,
  getProposalTabCounts,
  markProposalReadByToken,
  resendProposal,
} from './proposal-v2.server';
import { createProposalsService } from './proposals.service';

function getService() {
  return createProposalsService(getSupabaseServerClient());
}

export const listProposals = enhanceAction(
  async (input) => getService().listProposals(input),
  { schema: ListProposalsSchema },
);

export const getProposal = enhanceAction(
  async (input) => getService().getProposal(input),
  { schema: GetProposalSchema },
);

export const createProposal = enhanceAction(
  async (input) => getService().createProposal(input),
  { schema: CreateProposalSchema },
);

export const updateProposal = enhanceAction(
  async (input) => getService().updateProposal(input),
  { schema: UpdateProposalSchema },
);

export const deleteProposal = enhanceAction(
  async (input) => getService().deleteProposal(input),
  { schema: DeleteProposalSchema },
);

export const sendProposal = enhanceAction(
  async (input) => getService().sendProposal(input),
  { schema: SendProposalSchema },
);

export const getProposalForPortal = enhanceAction(
  async (input) => getService().getProposalForPortal(input),
  { schema: GetProposalForPortalSchema },
);

export const getProposalPortalLink = enhanceAction(
  async (input) => getService().getProposalPortalLink(input),
  { schema: GetProposalPortalLinkSchema },
);

export const setProposalStatus = enhanceAction(
  async (input) => getService().setProposalStatus(input),
  { schema: SetProposalStatusSchema },
);

export const addProposalComment = enhanceAction(
  async (input) => getService().addProposalComment(input),
  { schema: AddProposalCommentSchema },
);

export const duplicateProposalAction = enhanceAction(
  async (input) => duplicateProposal(input.accountId, input.proposalId),
  { schema: DuplicateProposalSchema },
);

export const archiveProposalAction = enhanceAction(
  async (input) =>
    archiveProposal(input.accountId, input.proposalId, input.archived),
  { schema: ArchiveProposalSchema },
);

export const resendProposalAction = enhanceAction(
  async (input) => resendProposal(input.accountId, input.proposalId),
  { schema: ResendProposalSchema },
);

export const getProposalTabCountsAction = enhanceAction(
  async (input) => getProposalTabCounts(input.accountId),
  { schema: ListProposalsSchema.pick({ accountId: true }) },
);

export const markProposalReadByTokenAction = enhanceAction(
  async (input) => markProposalReadByToken(input.token),
  { schema: GetProposalForPortalSchema },
);

export const addProposalCommentByTokenAction = enhanceAction(
  async (input) => addProposalCommentByToken(input),
  { schema: AddProposalCommentByTokenSchema },
);

export const approveProposalByTokenAction = enhanceAction(
  async (input) => approveProposalByToken(input),
  { schema: ApproveProposalByTokenSchema },
);

export const declineProposalByTokenAction = enhanceAction(
  async (input) => declineProposalByToken(input),
  { schema: DeclineProposalByTokenSchema },
);
