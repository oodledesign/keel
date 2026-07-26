'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import {
  type ShareCapabilities,
  acceptShareInvite,
  createShareInvite,
  getShareByToken,
  listAcceptableWorkspacesForUser,
  listActiveSharesForGuest,
  listSharesForOwner,
  revokeShare,
  updateShareCapabilities,
} from '~/lib/clients/client-workspace-shares.service';

const CapabilitiesSchema = z.object({
  canSupport: z.boolean(),
  canContacts: z.boolean(),
  canProjects: z.boolean(),
  canDocs: z.boolean(),
  canFinance: z.boolean(),
  canPortal: z.boolean(),
});

function revalidateOwner(accountSlug: string) {
  revalidatePath(
    pathsConfig.app.accountClients.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountSupport.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountSharedClients.replace('[account]', accountSlug),
  );
}

export const listClientWorkspaceSharesAction = enhanceAction(
  async (input: { accountId: string; clientOrgId: string }) => {
    return listSharesForOwner(input.accountId, input.clientOrgId);
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientOrgId: z.string().uuid(),
    }),
  },
);

export const createClientWorkspaceShareAction = enhanceAction(
  async (input: {
    accountId: string;
    accountSlug: string;
    clientOrgId: string;
    clientId?: string | null;
    invitedEmail?: string | null;
    capabilities: ShareCapabilities;
  }) => {
    const result = await createShareInvite({
      ownerAccountId: input.accountId,
      clientOrgId: input.clientOrgId,
      clientId: input.clientId,
      invitedEmail: input.invitedEmail,
      capabilities: input.capabilities,
      accountSlug: input.accountSlug,
    });
    revalidateOwner(input.accountSlug);
    return result;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      clientOrgId: z.string().uuid(),
      clientId: z.string().uuid().nullable().optional(),
      invitedEmail: z
        .union([z.string().email(), z.literal('')])
        .nullable()
        .optional(),
      capabilities: CapabilitiesSchema,
    }),
  },
);

export const updateClientWorkspaceShareAction = enhanceAction(
  async (input: {
    accountId: string;
    accountSlug: string;
    shareId: string;
    capabilities: ShareCapabilities;
  }) => {
    const share = await updateShareCapabilities({
      ownerAccountId: input.accountId,
      shareId: input.shareId,
      capabilities: input.capabilities,
    });
    revalidateOwner(input.accountSlug);
    return share;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      shareId: z.string().uuid(),
      capabilities: CapabilitiesSchema,
    }),
  },
);

export const revokeClientWorkspaceShareAction = enhanceAction(
  async (input: {
    accountId: string;
    accountSlug: string;
    shareId: string;
  }) => {
    await revokeShare({
      ownerAccountId: input.accountId,
      shareId: input.shareId,
    });
    revalidateOwner(input.accountSlug);
    return { ok: true as const };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      shareId: z.string().uuid(),
    }),
  },
);

export const getClientShareInviteAction = enhanceAction(
  async (input: { token: string }) => {
    const share = await getShareByToken(input.token);
    if (!share) throw new Error('Invite not found');
    return {
      id: share.id,
      status: share.status,
      expiresAt: share.expiresAt,
      ownerAccountName: share.ownerAccountName,
      clientOrgName: share.clientOrgName,
      clientDisplayName: share.clientDisplayName,
      capabilities: share.capabilities,
      invitedEmail: share.invitedEmail,
    };
  },
  {
    schema: z.object({
      token: z.string().min(16).max(128),
    }),
  },
);

export const listAcceptableWorkspacesAction = enhanceAction(
  async () => listAcceptableWorkspacesForUser(),
  { schema: z.object({}) },
);

export const acceptClientWorkspaceShareAction = enhanceAction(
  async (input: { token: string; guestAccountId: string }) => {
    const share = await acceptShareInvite(input);
    if (share.guestAccountSlug) {
      revalidatePath(
        pathsConfig.app.accountSharedClients.replace(
          '[account]',
          share.guestAccountSlug,
        ),
      );
      revalidatePath(
        pathsConfig.app.accountPartnerSupport.replace(
          '[account]',
          share.guestAccountSlug,
        ),
      );
    }
    return share;
  },
  {
    schema: z.object({
      token: z.string().min(16).max(128),
      guestAccountId: z.string().uuid(),
    }),
  },
);

export const listGuestSharedClientsAction = enhanceAction(
  async (input: { accountId: string }) => {
    return listActiveSharesForGuest(input.accountId);
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
    }),
  },
);
