'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';

const ReorderRequirementsSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  /** Full new order for the moved stage, first item at the top. */
  orderedIds: z.array(z.string().uuid()).min(1).max(5000),
});

/**
 * Persist a manual order for requirements within a WIP stage. Only the
 * position is written: reordering is not an edit, so `updated_at` (which feeds
 * "needs attention" staleness and the Updated column) is left alone.
 */
export const reorderWipRequirements = enhanceAction(
  async (input) => {
    await requireCommercialBillableActor(
      input.accountId,
      'reorder requirements',
    );

    const client = getSupabaseServerClient();
    // reorder_wip_requirements may lag the generated Database types until typegen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = client as any;

    // One SQL statement, so a failure can't leave the stage half-renumbered.
    const { error } = await db.rpc('reorder_wip_requirements', {
      p_account_id: input.accountId,
      p_ids: input.orderedIds,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/home/pipeline');
    const slug = input.accountSlug?.trim();
    if (slug) {
      revalidatePath(
        pathsConfig.app.accountPipeline.replace('[account]', slug),
      );
      revalidatePath(
        pathsConfig.app.accountRequirements.replace('[account]', slug),
      );
    }

    return { success: true as const };
  },
  { schema: ReorderRequirementsSchema },
);
