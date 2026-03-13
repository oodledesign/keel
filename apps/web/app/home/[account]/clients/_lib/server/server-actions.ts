'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from './clients.service';
import {
  CreateClientSchema,
  CreateNoteSchema,
  DeleteClientSchema,
  DeleteNoteSchema,
  GetClientSchema,
  GetJobHistorySchema,
  ListClientInvoicesSchema,
  ListClientsSchema,
  ListNotesSchema,
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
