'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  buildAccessConfigFromInput,
  CreateAdminUserInviteSchema,
} from '~/lib/admin/user-invites.schema';
import {
  createAdminUserInvite,
  fulfillAdminUserInvite,
  resendAdminUserInvite,
  revokeAdminUserInvite,
} from '~/lib/admin/user-invites.service';

async function requireSuperAdminActor() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!(await isSuperAdmin(client))) {
    throw new Error('Super admin access required');
  }

  const { data: profile } = await client
    .from('accounts')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    user,
    inviterName: profile?.name?.trim() || user.email || 'Ozer Admin',
  };
}

export const createAdminUserInviteAction = enhanceAction(
  async (input) => {
    const { user, inviterName } = await requireSuperAdminActor();
    const admin = getSupabaseServerAdminClient();
    const accessConfig = buildAccessConfigFromInput(input);

    await createAdminUserInvite(admin, {
      email: input.email,
      invitedBy: user.id,
      inviterName,
      accessConfig,
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/audit');

    return { success: true };
  },
  { schema: CreateAdminUserInviteSchema },
);

export const revokeAdminUserInviteAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdminActor();
    const admin = getSupabaseServerAdminClient();

    await revokeAdminUserInvite(admin, input.inviteId, user.id);

    revalidatePath('/admin/users');
    revalidatePath('/admin/audit');

    return { success: true };
  },
  {
    schema: z.object({
      inviteId: z.string().uuid(),
    }),
  },
);

export const resendAdminUserInviteAction = enhanceAction(
  async (input) => {
    const { inviterName } = await requireSuperAdminActor();
    const admin = getSupabaseServerAdminClient();

    await resendAdminUserInvite(admin, input.inviteId, inviterName);

    revalidatePath('/admin/users');

    return { success: true };
  },
  {
    schema: z.object({
      inviteId: z.string().uuid(),
    }),
  },
);

export const fulfillAdminUserInviteAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user?.email) {
      throw new Error('Authentication required');
    }

    const admin = getSupabaseServerAdminClient();

    return fulfillAdminUserInvite(
      admin,
      input.inviteToken,
      user.id,
      user.email,
    );
  },
  {
    schema: z.object({
      inviteToken: z.string().min(1),
    }),
  },
);
