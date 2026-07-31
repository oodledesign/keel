'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import {
  acceptProjectGuestInvite,
  createProjectGuestInvite,
  listAcceptedGuestsForUser,
  listProjectGuests,
  revokeProjectGuest,
} from '~/lib/projects/project-guests.service';

const PermissionsSchema = z.object({
  comment: z.boolean(),
  create_task: z.boolean(),
  edit_own_task: z.boolean(),
});

function revalidateProject(accountSlug: string, projectId: string) {
  revalidatePath(
    pathsConfig.app.accountJobDetail
      .replace('[account]', accountSlug)
      .replace('[id]', projectId),
  );
}

export const listProjectGuestsAction = enhanceAction(
  async (input: { accountId: string; projectId: string }) => {
    return listProjectGuests(input.accountId, input.projectId);
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      projectId: z.string().uuid(),
    }),
  },
);

export const createProjectGuestInviteAction = enhanceAction(
  async (input: {
    accountId: string;
    accountSlug: string;
    projectId: string;
    email: string;
    permissions?: {
      comment: boolean;
      create_task: boolean;
      edit_own_task: boolean;
    };
  }) => {
    const result = await createProjectGuestInvite(input);
    revalidateProject(input.accountSlug, input.projectId);
    return result;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      projectId: z.string().uuid(),
      email: z.string().email(),
      permissions: PermissionsSchema.optional(),
    }),
  },
);

export const revokeProjectGuestAction = enhanceAction(
  async (input: {
    accountId: string;
    accountSlug: string;
    projectId: string;
    guestId: string;
  }) => {
    await revokeProjectGuest(input);
    revalidateProject(input.accountSlug, input.projectId);
    return { ok: true as const };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      projectId: z.string().uuid(),
      guestId: z.string().uuid(),
    }),
  },
);

export const acceptProjectGuestInviteAction = enhanceAction(
  async (input: { token: string }) => {
    return acceptProjectGuestInvite(input.token);
  },
  {
    schema: z.object({
      token: z.string().min(16),
    }),
  },
);

export const listMyProjectGuestAccessAction = enhanceAction(
  async () => {
    const { getSupabaseServerClient } =
      await import('@kit/supabase/server-client');
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return [];
    return listAcceptedGuestsForUser(user.id);
  },
  { schema: z.object({}) },
);
