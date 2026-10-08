'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

const UpdateMessageReportStatusSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['open', 'actioned', 'dismissed']),
});

export const updateMessageReportStatusAction = enhanceAction(
  async (input) => {
    await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;

    const { error } = await admin
      .from('chat_message_reports')
      .update({
        status: input.status,
        resolved_at: input.status === 'open' ? null : new Date().toISOString(),
      })
      .eq('id', input.reportId);

    if (error) {
      return { ok: false as const, error: 'Could not update the report' };
    }

    revalidatePath('/admin/message-reports');
    return { ok: true as const };
  },
  { schema: UpdateMessageReportStatusSchema },
);
