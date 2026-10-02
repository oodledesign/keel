'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export const deleteWaitlistLeadAction = enhanceAction(
  async (input: { id: string }) => {
    const client = getSupabaseServerClient();
    if (!(await isSuperAdmin(client))) {
      throw new Error('Unauthorized');
    }

    const admin = getSupabaseServerAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from('launch_interest')
      .delete()
      .eq('id', input.id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath('/admin/waiting-list');
    return { success: true };
  },
  {
    schema: z.object({
      id: z.string().uuid(),
    }),
  },
);
