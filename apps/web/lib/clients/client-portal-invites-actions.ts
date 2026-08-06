'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import {
  acceptClientPortalInvite,
  createClientPortalInvite,
  inviteAllClientContactsToPortal,
  listContactPortalAccess,
  revokeClientPortalInvite,
} from '~/lib/clients/client-portal-invites.service';

const contactEmailSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().email().nullable(),
);

const InviteContactSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  clientId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  email: z.string().email(),
});

const InviteAllContactsSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  clientId: z.string().uuid(),
  contacts: z
    .array(
      z.object({
        id: z.string().uuid(),
        email: contactEmailSchema,
        emails: z
          .array(
            z.object({
              email: z.string().email(),
              is_primary: z.boolean(),
            }),
          )
          .optional()
          .nullable(),
      }),
    )
    .max(100),
});

const ListAccessSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contacts: z
    .array(
      z.object({
        id: z.string().uuid(),
        email: contactEmailSchema,
        emails: z
          .array(
            z.object({
              email: z.string().email(),
              is_primary: z.boolean(),
            }),
          )
          .optional()
          .nullable(),
        is_primary: z.boolean().optional(),
      }),
    )
    .max(100),
});

const RevokeSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

const AcceptSchema = z.object({
  token: z.string().min(16),
});

function revalidateClientPaths(accountSlug: string, clientId: string) {
  revalidatePath(
    pathsConfig.app.accountClients.replace('[account]', accountSlug),
  );
  revalidatePath(`/app/${accountSlug}/clients/${clientId}`);
}

export const inviteContactToPortalAction = enhanceAction(
  async (data) => {
    const result = await createClientPortalInvite({
      accountId: data.accountId,
      accountSlug: data.accountSlug,
      clientId: data.clientId,
      contactId: data.contactId,
      email: data.email,
    });

    revalidateClientPaths(data.accountSlug, data.clientId);
    return result;
  },
  { auth: true, schema: InviteContactSchema },
);

export const inviteAllContactsToPortalAction = enhanceAction(
  async (data) => {
    const result = await inviteAllClientContactsToPortal(data);
    revalidateClientPaths(data.accountSlug, data.clientId);
    return result;
  },
  { auth: true, schema: InviteAllContactsSchema },
);

export const listContactPortalAccessAction = enhanceAction(
  async (data) => {
    return listContactPortalAccess(data);
  },
  { auth: true, schema: ListAccessSchema },
);

export const revokeClientPortalInviteAction = enhanceAction(
  async (data) => {
    await revokeClientPortalInvite(data);
    return { ok: true as const };
  },
  { auth: true, schema: RevokeSchema },
);

export const acceptClientPortalInviteAction = enhanceAction(
  async (data) => {
    return acceptClientPortalInvite(data.token);
  },
  { auth: true, schema: AcceptSchema },
);
