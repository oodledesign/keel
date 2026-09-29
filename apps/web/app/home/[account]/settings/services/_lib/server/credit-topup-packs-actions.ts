'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { UpdateCreditTopupPacksSchema } from '../schema/credit-topup-packs.schema';
import { createCreditTopupPacksService } from './credit-topup-packs.service';

export const updateCreditTopupPacksAction = enhanceAction(
  async (input) => {
    const result = await createCreditTopupPacksService(
      getSupabaseServerClient(),
    ).update(input.accountId, input.packs);
    revalidatePath('/home/[account]/settings/services', 'page');
    return result;
  },
  { schema: UpdateCreditTopupPacksSchema },
);
