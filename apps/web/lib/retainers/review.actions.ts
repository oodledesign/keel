'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  applyRetainerMatch,
  createProposedRetainerService,
} from './apply-match';
import {
  AddProposedRetainerServiceSchema,
  ApplyRetainerMatchSchema,
  SkipRetainerMatchSchema,
} from './review.schema';

async function requireAccessibleSuggestion(suggestionId: string) {
  const client = getSupabaseServerClient() as any;
  const { data, error } = await client
    .from('retainer_match_suggestions')
    .select('id, account_id')
    .eq('id', suggestionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Match suggestion not found or access denied');
  return data as { id: string; account_id: string };
}

function revalidateReviewPaths(accountSlug?: string) {
  revalidatePath('/home/email');
  revalidatePath('/app/email');
  revalidatePath('/home');
  revalidatePath('/app');
  if (accountSlug) {
    revalidatePath(`/home/${accountSlug}`);
    revalidatePath(`/app/${accountSlug}`);
    revalidatePath(`/home/${accountSlug}/email`);
    revalidatePath(`/app/${accountSlug}/email`);
    revalidatePath(`/home/${accountSlug}/projects`, 'layout');
  }
}

export const applyRetainerMatchAction = enhanceAction(
  async (input, user) => {
    await requireAccessibleSuggestion(input.suggestionId);
    const result = await applyRetainerMatch({
      admin: getSupabaseServerAdminClient(),
      suggestionId: input.suggestionId,
      mode: 'apply',
      actorUserId: user.id,
      serviceId: input.serviceId,
      addServiceToProject: input.addServiceToProject,
    });
    revalidateReviewPaths(input.accountSlug);
    return { ok: true as const, ...result };
  },
  { auth: true, schema: ApplyRetainerMatchSchema },
);

export const skipRetainerMatchAction = enhanceAction(
  async (input, user) => {
    await requireAccessibleSuggestion(input.suggestionId);
    const result = await applyRetainerMatch({
      admin: getSupabaseServerAdminClient(),
      suggestionId: input.suggestionId,
      mode: 'skip',
      actorUserId: user.id,
    });
    revalidateReviewPaths(input.accountSlug);
    return { ok: true as const, ...result };
  },
  { auth: true, schema: SkipRetainerMatchSchema },
);

export const addProposedRetainerServiceAction = enhanceAction(
  async (input, user) => {
    await requireAccessibleSuggestion(input.suggestionId);
    const admin = getSupabaseServerAdminClient();
    const { data: suggestion, error } = await (admin as any)
      .from('retainer_match_suggestions')
      .select('id, account_id, project_id, status')
      .eq('id', input.suggestionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!suggestion || suggestion.status !== 'pending') {
      throw new Error('This match is no longer pending');
    }

    const created = await createProposedRetainerService({
      admin,
      accountId: String(suggestion.account_id),
      name: input.name,
      description: input.description,
      creditCost: input.creditCost,
      addToProjectId: suggestion.project_id
        ? String(suggestion.project_id)
        : null,
    });

    if (!input.applyAfter) {
      await (admin as any)
        .from('retainer_match_suggestions')
        .update({
          service_id: created.serviceId,
          match_kind: 'project_service',
          credit_cost: input.creditCost,
          proposed_name: input.name,
          proposed_description: input.description ?? null,
          proposed_credit_cost: input.creditCost,
        })
        .eq('id', input.suggestionId);
      revalidateReviewPaths(input.accountSlug);
      return { ok: true as const, serviceId: created.serviceId };
    }

    const result = await applyRetainerMatch({
      admin,
      suggestionId: input.suggestionId,
      mode: 'apply',
      actorUserId: user.id,
      serviceId: created.serviceId,
      addServiceToProject: true,
    });
    revalidateReviewPaths(input.accountSlug);
    return { ok: true as const, serviceId: created.serviceId, ...result };
  },
  { auth: true, schema: AddProposedRetainerServiceSchema },
);
