'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type CompletedProductTours,
  type ProductTourId,
  isProductTourId,
  parseCompletedProductTours,
} from '~/lib/product-tour/types';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

async function loadCompletedMap(
  userId: string,
): Promise<CompletedProductTours> {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('user_settings')
    .select('completed_product_tours')
    .eq('user_id', userId)
    .maybeSingle();

  // Cast until `pnpm supabase:web:typegen` after migration is applied locally.
  const row = data as { completed_product_tours?: unknown } | null;
  return parseCompletedProductTours(row?.completed_product_tours);
}

async function writeCompletedMap(
  userId: string,
  next: CompletedProductTours,
): Promise<{ error?: string }> {
  const client = getSupabaseServerClient();
  const { error } = await client.from('user_settings').upsert(
    {
      user_id: userId,
      completed_product_tours: next,
      updated_at: new Date().toISOString(),
    } as never, // same: column pending typegen
    { onConflict: 'user_id' },
  );

  if (error) return { error: error.message };
  return {};
}

export async function loadCompletedProductTours(): Promise<CompletedProductTours> {
  const user = await requireUserInServerComponent();
  return loadCompletedMap(user.id);
}

export const markProductTourCompletedAction = enhanceAction(
  async (input) => {
    const user = await requireUserInServerComponent();
    const current = await loadCompletedMap(user.id);
    const next: CompletedProductTours = {
      ...current,
      [input.tourId]: new Date().toISOString(),
    };
    const result = await writeCompletedMap(user.id, next);
    if (result.error) {
      throw new Error(result.error);
    }
    revalidatePath('/', 'layout');
    return { success: true as const };
  },
  {
    schema: z.object({
      tourId: z.string().refine(isProductTourId),
    }),
  },
);

export const resetProductTourAction = enhanceAction(
  async (input) => {
    const user = await requireUserInServerComponent();
    const current = await loadCompletedMap(user.id);
    const next: CompletedProductTours = { ...current };
    delete next[input.tourId as ProductTourId];
    const result = await writeCompletedMap(user.id, next);
    if (result.error) {
      throw new Error(result.error);
    }
    revalidatePath('/', 'layout');
    return { success: true as const };
  },
  {
    schema: z.object({
      tourId: z.string().refine(isProductTourId),
    }),
  },
);
