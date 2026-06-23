'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from './clients.service';
import {
  CreateClientSchema,
  CreateContactSchema,
  CreateNoteSchema,
  CreateWorkspaceContactSchema,
  DeleteClientSchema,
  DeleteContactSchema,
  DeleteNoteSchema,
  GetClientSchema,
  GetJobHistorySchema,
  LinkContactSchema,
  ListAccountContactsSchema,
  ListClientInvoicesSchema,
  ListClientsSchema,
  ListContactsSchema,
  ListNotesSchema,
  ListWorkspaceContactsSchema,
  UpdateClientSchema,
} from '../schema/clients.schema';

function getService() {
  return createClientsService(getSupabaseServerClient());
}

export const listClients = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listClients(input);
  },
  { schema: ListClientsSchema },
);

export const listClientsOverview = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listClientsOverview(input);
  },
  {
    schema: ListClientsSchema.extend({
      members: z
        .array(
          z.object({
            user_id: z.string().uuid(),
            name: z.string().nullable(),
            picture_url: z.string().nullable().optional(),
          }),
        )
        .optional(),
    }),
  },
);

export const getClient = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getClient(input);
  },
  { schema: GetClientSchema },
);

export const createClient = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createClient(input);
  },
  { schema: CreateClientSchema },
);

export const updateClient = enhanceAction(
  async (input) => {
    const service = getService();
    return service.updateClient(input);
  },
  { schema: UpdateClientSchema },
);

export const deleteClient = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteClient(input);
  },
  { schema: DeleteClientSchema },
);

export const listNotes = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listNotes(input);
  },
  { schema: ListNotesSchema },
);

export const createNote = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createNote(input);
  },
  { schema: CreateNoteSchema },
);

export const deleteNote = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteNote(input);
  },
  { schema: DeleteNoteSchema },
);

export const getJobHistory = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getJobHistory(input);
  },
  { schema: GetJobHistorySchema },
);

export const listClientInvoices = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listClientInvoices(input);
  },
  { schema: ListClientInvoicesSchema },
);

export const listContacts = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listContacts(input);
  },
  { schema: ListContactsSchema },
);

export const listAccountContacts = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listAccountContacts(input);
  },
  { schema: ListAccountContactsSchema },
);

export const createContact = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createContact(input);
  },
  { schema: CreateContactSchema },
);

export const linkContact = enhanceAction(
  async (input) => {
    const service = getService();
    return service.linkContact(input);
  },
  { schema: LinkContactSchema },
);

export const listWorkspaceContacts = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listWorkspaceContacts(input);
  },
  { schema: ListWorkspaceContactsSchema },
);

export const createWorkspaceContact = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createWorkspaceContact(input);
  },
  { schema: CreateWorkspaceContactSchema },
);

export const deleteContact = enhanceAction(
  async (input) => {
    const service = getService();
    return service.deleteContact(input);
  },
  { schema: DeleteContactSchema },
);

const GetClientPortalStatusSchema = z.object({
  accountSlug: z.string().min(1),
  email: z.string().email(),
});

export const getClientPortalStatus = enhanceAction(
  async (input) => {
    const parsed = GetClientPortalStatusSchema.parse(input);
    const client = getSupabaseServerClient();

    const { data: invitations, error: invError } = await client.rpc(
      'get_account_invitations',
      {
        account_slug: parsed.accountSlug,
      },
    );

    if (invError) throw invError;

    const matchingInvites = (invitations ?? []).filter((invite: any) => {
      return (
        invite.email?.toLowerCase() === parsed.email.toLowerCase() &&
        invite.role === 'client'
      );
    });

    const latestInvite = matchingInvites.sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

    const { data: members, error: membersError } = await client.rpc(
      'get_account_members',
      {
        account_slug: parsed.accountSlug,
      },
    );

    if (membersError) throw membersError;

    const member = (members ?? []).find(
      (m: any) =>
        m.email?.toLowerCase() === parsed.email.toLowerCase() &&
        m.role === 'client',
    );

    let lastLogin: string | null = null;

    try {
      const admin = getSupabaseServerAdminClient();
      const { data: userResult } =
        await admin.auth.admin.getUserByEmail(parsed.email);

      lastLogin = ((userResult as any)?.user as any)?.last_sign_in_at ?? null;
    } catch {
      lastLogin = null;
    }

    const now = new Date();

    let status: 'not_invited' | 'invited' | 'expired' | 'active' =
      'not_invited';

    if (member) {
      status = 'active';
    } else if (latestInvite) {
      const expiresAt = new Date(latestInvite.expires_at);
      status = expiresAt < now ? 'expired' : 'invited';
    }

    return {
      status,
      lastLogin,
      latestInviteCreatedAt: latestInvite?.created_at ?? null,
      latestInviteExpiresAt: latestInvite?.expires_at ?? null,
      isMember: Boolean(member),
    };
  },
  { schema: GetClientPortalStatusSchema },
);
