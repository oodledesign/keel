'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '../_lib/pipeline-constants';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

function parseWorkspaceDealBusinessId(
  businessId: string,
): { accountId: string | null; businessId: string | null } {
  if (businessId.startsWith(PIPELINE_WORKSPACE_BUSINESS_PREFIX)) {
    return {
      accountId: businessId.slice(PIPELINE_WORKSPACE_BUSINESS_PREFIX.length),
      businessId: null,
    };
  }
  return { accountId: null, businessId };
}

async function resolveAccountIdForBusiness(
  client: ReturnType<typeof getSupabaseServerClient>,
  businessId: string | null,
): Promise<string | null> {
  if (!businessId) return null;
  const { data } = await client
    .from('businesses')
    .select('account_id')
    .eq('id', businessId)
    .maybeSingle();
  return (data as { account_id?: string | null } | null)?.account_id ?? null;
}

function revalidatePipelinePaths(accountSlug?: string | null) {
  revalidatePath('/home/pipeline');
  revalidatePath('/home');
  const slug = accountSlug?.trim();
  if (slug) {
    revalidatePath(pathsConfig.app.accountPipeline.replace('[account]', slug));
    revalidatePath(pathsConfig.app.accountHome.replace('[account]', slug));
  }
}

export async function moveDealToStage(
  dealId: string,
  newStage: string,
  options?: { accountSlug?: string | null },
) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('pipeline_deals')
    .update({ stage: newStage })
    .eq('id', dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePipelinePaths(options?.accountSlug);

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
  /** Link this opportunity to an existing client (null = new lead). */
  clientId?: string | null;
  /** When creating from a known workspace (optional; also derived from businesses.account_id). */
  accountId?: string | null;
  /** Revalidate team routes after mutation */
  accountSlug?: string | null;
};

export async function createDeal(input: CreateDealInput) {
  const client = getSupabaseServerClient();
  await requireUserInServerComponent();

  const parsed = parseWorkspaceDealBusinessId(input.businessId);
  const resolvedAccountId =
    input.accountId?.trim() ||
    parsed.accountId ||
    (await resolveAccountIdForBusiness(client, parsed.businessId));

  const { data, error } = await client
    .from('pipeline_deals')
    .insert({
      name: input.companyName || input.contactName,
      contact_name: input.contactName,
      company_name: input.companyName,
      value: input.value,
      stage: input.stage,
      next_action: input.nextAction || null,
      next_action_date: input.nextActionDate || null,
      business_id: parsed.businessId,
      account_id: resolvedAccountId,
      client_id: input.clientId || null,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message, id: null };
  }

  revalidatePipelinePaths(input.accountSlug);

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
  /** Set to a client id to link, or null to unlink (back to a new lead). */
  clientId?: string | null;
  accountSlug?: string | null;
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
  if (input.clientId !== undefined) updates.client_id = input.clientId || null;

  if (input.businessId !== undefined) {
    const parsed = parseWorkspaceDealBusinessId(input.businessId);
    updates.business_id = parsed.businessId;
    updates.account_id =
      parsed.accountId ??
      (await resolveAccountIdForBusiness(client, parsed.businessId));
  }

  if (input.contactName !== undefined || input.companyName !== undefined) {
    updates.name =
      (input.companyName ?? '').trim() ||
      (input.contactName ?? '').trim();
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

  revalidatePipelinePaths(input.accountSlug);

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

export type ConvertWonDealResult =
  | { kind: 'project'; accountSlug: string; projectId: string }
  | { kind: 'lead' }
  | { kind: 'error'; error: string };

/**
 * When a deal linked to an existing client is Won, spin up a delivery project
 * for that client in the deal's own workspace. Deals without a client fall back
 * to the new-client flow (kind: 'lead').
 */
export async function convertWonDealToProject(
  dealId: string,
): Promise<ConvertWonDealResult> {
  const client = getSupabaseServerClient();
  await requireUserInServerComponent();

  const { data: deal, error } = await client
    .from('pipeline_deals')
    .select(
      'id, account_id, client_id, company_name, contact_name, value, clients(display_name)',
    )
    .eq('id', dealId)
    .maybeSingle();

  if (error) {
    return { kind: 'error', error: error.message };
  }

  const row = deal as
    | {
        account_id?: string | null;
        client_id?: string | null;
        company_name?: string | null;
        contact_name?: string | null;
        value?: number | null;
        clients?: { display_name?: string | null } | null;
      }
    | null;

  if (!row?.client_id || !row.account_id) {
    return { kind: 'lead' };
  }

  const accountId = row.account_id;
  const clientName = row.clients?.display_name?.trim() || null;
  const title =
    row.company_name?.trim() ||
    clientName ||
    row.contact_name?.trim() ||
    'New project';
  const valuePence =
    row.value != null && !Number.isNaN(Number(row.value))
      ? Math.round(Number(row.value) * 100)
      : undefined;

  try {
    const { createJobsService } = await import(
      '~/home/[account]/projects/_lib/server/jobs.service'
    );
    const service = createJobsService(client);
    const project = await service.createJob({
      accountId,
      client_id: row.client_id,
      title,
      value_pence: valuePence,
    });

    const { data: account } = await client
      .from('accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();

    const slug = (account as { slug?: string | null } | null)?.slug ?? null;
    if (!slug) {
      return { kind: 'error', error: 'Workspace not found for this deal.' };
    }

    revalidatePipelinePaths(slug);

    return {
      kind: 'project',
      accountSlug: slug,
      projectId: project.id as string,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not create the project.';
    return { kind: 'error', error: message };
  }
}
