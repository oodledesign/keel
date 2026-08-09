'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

const ListingScopeSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional().nullable(),
});

export const listPotentialInstructionsForListing = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // commercial_listing_id may lag generated Database types until typegen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('pipeline_deals')
      .select('id, name, contact_name, company_name, stage')
      .eq('account_id', input.accountId)
      .eq('commercial_listing_id', input.listingId)
      .eq('stage', 'potential');

    if (error) {
      throw new Error(error.message);
    }

    return (
      (data ?? []) as Array<{
        id: string;
        name: string | null;
        contact_name: string | null;
        company_name: string | null;
        stage: string;
      }>
    ).map((row) => ({
      id: row.id,
      name:
        row.name?.trim() ||
        row.company_name?.trim() ||
        row.contact_name?.trim() ||
        'Untitled instruction',
      stage: row.stage,
    }));
  },
  { schema: ListingScopeSchema },
);

export const movePotentialInstructionsToCurrent = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client as any)
      .from('pipeline_deals')
      .update({ stage: 'current', completed_at: null })
      .eq('account_id', input.accountId)
      .eq('commercial_listing_id', input.listingId)
      .eq('stage', 'potential');

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath('/home');
    const slug = input.accountSlug?.trim();
    if (slug) {
      revalidatePath(
        pathsConfig.app.accountPipeline.replace('[account]', slug),
      );
      revalidatePath(
        pathsConfig.app.accountListings.replace('[account]', slug),
      );
    }

    return { ok: true as const };
  },
  { schema: ListingScopeSchema },
);
