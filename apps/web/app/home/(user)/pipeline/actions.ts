'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export async function moveDealToStage(dealId: string, newStage: string) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('pipeline_deals')
    .update({ stage: newStage })
    .eq('id', dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export type CreateDealInput = {
  contactName: string;
  companyName: string;
  value: number;
  stage: string;
  nextAction?: string;
  nextActionDate?: string;
  businessId: string;
};

export async function createDeal(input: CreateDealInput) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('pipeline_deals')
    .insert({
      // `name` is required by the original schema; fall back gracefully.
      name: input.companyName || input.contactName,
      contact_name: input.contactName,
      company_name: input.companyName,
      value: input.value,
      stage: input.stage,
      next_action: input.nextAction || null,
      next_action_date: input.nextActionDate || null,
      business_id: input.businessId,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message, id: null };
  }

  revalidatePath('/home/pipeline');
  revalidatePath('/home');
  return { success: true, error: null, id: data.id as string };
}

export type UpdateDealInput = {
  contactName?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  nextAction?: string;
  nextActionDate?: string | null;
  businessId?: string;
};

export async function updateDeal(dealId: string, input: UpdateDealInput) {
  const client = getSupabaseServerClient();

  const updates: Record<string, unknown> = {};
  if (input.contactName !== undefined) updates.contact_name = input.contactName;
  if (input.companyName !== undefined) updates.company_name = input.companyName;
  if (input.value !== undefined) updates.value = input.value;
  if (input.stage !== undefined) updates.stage = input.stage;
  if (input.nextAction !== undefined) updates.next_action = input.nextAction || null;
  if (input.nextActionDate !== undefined) updates.next_action_date = input.nextActionDate || null;
  if (input.businessId !== undefined) updates.business_id = input.businessId;
  if (input.contactName !== undefined || input.companyName !== undefined) {
    updates.name = (input.companyName ?? '').trim() || (input.contactName ?? '').trim();
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, error: null };
  }

  const { error } = await client
    .from('pipeline_deals')
    .update(updates)
    .eq('id', dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/home/pipeline');
  revalidatePath('/home');
  return { success: true, error: null };
}

/** Returns the first team account slug for the current user (for redirecting to clients after Won). */
export async function getDefaultAccountSlug(): Promise<{ accountSlug: string } | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', user.id)
    .eq('onboarding_completed', true)
    .limit(1)
    .maybeSingle();

  if (!membership?.account_id) return null;

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', membership.account_id)
    .maybeSingle();

  const slug = account?.slug ?? null;
  return slug ? { accountSlug: slug } : null;
}
