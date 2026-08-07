'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '../_lib/pipeline-constants';

function parseWorkspaceDealBusinessId(businessId: string): {
  accountId: string | null;
  businessId: string | null;
} {
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
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      return { success: false as const, error: 'Not authenticated' };
    }

    const { data: dealRow } = await client
      .from('pipeline_deals')
      .select('account_id')
      .eq('id', dealId)
      .maybeSingle();
    const dealAccountId = (
      dealRow as { account_id?: string | null } | null
    )?.account_id;

    if (dealAccountId) {
      try {
        const { assertCommercialBillableMember } = await import(
          '~/lib/commercial/commercial-seat-access'
        );
        await assertCommercialBillableMember({
          client,
          accountId: dealAccountId,
          userId: user.id,
          action: 'change instruction stages',
        });
      } catch (seatError) {
        return {
          success: false as const,
          error:
            seatError instanceof Error
              ? seatError.message
              : 'Support seats cannot change instruction stages',
        };
      }
    }

    const updates: Record<string, unknown> = { stage: newStage };
    if (
      newStage === 'completed' ||
      newStage === 'signed' ||
      newStage === 'completed_exchanged'
    ) {
      updates.completed_at = new Date().toISOString();
    } else if (
      newStage === 'fell_through' ||
      newStage === 'discounted' ||
      newStage === 'fallen_through'
    ) {
      updates.completed_at = null;
    }

    const { error } = await client
      .from('pipeline_deals')
      .update(updates)
      .eq('id', dealId);

    if (error) {
      return { success: false as const, error: error.message };
    }

    revalidatePipelinePaths(options?.accountSlug);

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : 'Could not update deal stage',
    };
  }
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
  /** Optional project title when creating an opportunity for an existing client. */
  projectName?: string | null;
  /** Optional project / opportunity brief. */
  description?: string | null;
  /** When creating from a known workspace (optional; also derived from businesses.account_id). */
  accountId?: string | null;
  /** Revalidate team routes after mutation */
  accountSlug?: string | null;
  /** Commercial disposal link (agency workspaces). */
  commercialListingId?: string | null;
};

export async function createDeal(input: CreateDealInput) {
  const client = getSupabaseServerClient();
  await requireUserInServerComponent();

  const parsed = parseWorkspaceDealBusinessId(input.businessId);
  const resolvedAccountId =
    input.accountId?.trim() ||
    parsed.accountId ||
    (await resolveAccountIdForBusiness(client, parsed.businessId));

  const projectName = input.projectName?.trim() || '';
  const description = input.description?.trim() || '';
  const dealName =
    projectName ||
    (input.companyName ?? '').trim() ||
    (input.contactName ?? '').trim();

  const { data, error } = await client
    .from('pipeline_deals')
    .insert({
      name: dealName,
      contact_name: input.contactName,
      company_name: projectName || input.companyName || '',
      notes: description || null,
      value: input.value,
      stage: input.stage,
      next_action: input.nextAction || null,
      next_action_date: input.nextActionDate || null,
      business_id: parsed.businessId,
      account_id: resolvedAccountId,
      client_id: input.clientId || null,
      commercial_listing_id: input.commercialListingId || null,
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
  projectName?: string | null;
  description?: string | null;
  /** Set to a client id to link, or null to unlink (back to a new lead). */
  clientId?: string | null;
  accountSlug?: string | null;
  commercialListingId?: string | null;
  hotsRentPsf?: number | null;
  hotsSizeSqft?: number | null;
  hotsLeaseYears?: number | null;
  hotsIncentives?: string | null;
  hotsSolicitorName?: string | null;
  hotsTargetExchangeDate?: string | null;
  hotsNotes?: string | null;
};

export async function updateDeal(dealId: string, input: UpdateDealInput) {
  await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const updates: Record<string, unknown> = {};
  if (input.contactName !== undefined) updates.contact_name = input.contactName;
  if (input.companyName !== undefined) updates.company_name = input.companyName;
  if (input.value !== undefined) updates.value = input.value;
  if (input.stage !== undefined) updates.stage = input.stage;
  if (input.nextAction !== undefined)
    updates.next_action = input.nextAction || null;
  if (input.nextActionDate !== undefined)
    updates.next_action_date = input.nextActionDate || null;
  if (input.clientId !== undefined) updates.client_id = input.clientId || null;
  if (input.commercialListingId !== undefined) {
    updates.commercial_listing_id = input.commercialListingId || null;
  }
  if (input.hotsRentPsf !== undefined) {
    updates.hots_rent_psf = input.hotsRentPsf;
  }
  if (input.hotsSizeSqft !== undefined) {
    updates.hots_size_sqft = input.hotsSizeSqft;
  }
  if (input.hotsLeaseYears !== undefined) {
    updates.hots_lease_years = input.hotsLeaseYears;
  }
  if (input.hotsIncentives !== undefined) {
    updates.hots_incentives = input.hotsIncentives?.trim() || null;
  }
  if (input.hotsSolicitorName !== undefined) {
    updates.hots_solicitor_name = input.hotsSolicitorName?.trim() || null;
  }
  if (input.hotsTargetExchangeDate !== undefined) {
    updates.hots_target_exchange_date = input.hotsTargetExchangeDate || null;
  }
  if (input.hotsNotes !== undefined) {
    updates.hots_notes = input.hotsNotes?.trim() || null;
  }
  if (
    input.stage === 'completed' ||
    input.stage === 'signed' ||
    input.stage === 'completed_exchanged'
  ) {
    updates.completed_at = new Date().toISOString();
  } else if (
    input.stage === 'fell_through' ||
    input.stage === 'discounted' ||
    input.stage === 'fallen_through'
  ) {
    updates.completed_at = null;
  }
  if (input.description !== undefined)
    updates.notes = input.description?.trim() || null;

  if (input.businessId !== undefined) {
    const parsed = parseWorkspaceDealBusinessId(input.businessId);
    updates.business_id = parsed.businessId;
    updates.account_id =
      parsed.accountId ??
      (await resolveAccountIdForBusiness(client, parsed.businessId));
  }

  if (input.projectName !== undefined) {
    const projectName = input.projectName?.trim() || '';
    updates.name =
      projectName ||
      (input.companyName ?? '').trim() ||
      (input.contactName ?? '').trim();
    if (input.clientId) {
      // Existing-client opportunities: keep company_name aligned with the
      // optional project title (clear it when the title is cleared).
      updates.company_name = projectName || null;
    } else if (projectName && input.companyName === undefined) {
      updates.company_name = projectName;
    }
  } else if (
    input.contactName !== undefined ||
    input.companyName !== undefined
  ) {
    updates.name =
      (input.companyName ?? '').trim() || (input.contactName ?? '').trim();
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
export async function getDefaultAccountSlug(): Promise<{
  accountSlug: string;
} | null> {
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
      'id, account_id, client_id, name, company_name, contact_name, notes, value, clients(display_name)',
    )
    .eq('id', dealId)
    .maybeSingle();

  if (error) {
    return { kind: 'error', error: error.message };
  }

  const row = deal as {
    account_id?: string | null;
    client_id?: string | null;
    name?: string | null;
    company_name?: string | null;
    contact_name?: string | null;
    notes?: string | null;
    value?: number | null;
    clients?: { display_name?: string | null } | null;
  } | null;

  if (!row?.client_id || !row.account_id) {
    return { kind: 'lead' };
  }

  const accountId = row.account_id;
  const clientName = row.clients?.display_name?.trim() || null;
  const title =
    row.name?.trim() ||
    row.company_name?.trim() ||
    clientName ||
    row.contact_name?.trim() ||
    'New project';
  const description = row.notes?.trim() || undefined;
  const valuePence =
    row.value != null && !Number.isNaN(Number(row.value))
      ? Math.round(Number(row.value) * 100)
      : undefined;

  try {
    const { createJobsService } =
      await import('~/home/[account]/projects/_lib/server/jobs.service');
    const service = createJobsService(client);
    const project = await service.createJob({
      accountId,
      client_id: row.client_id,
      title,
      description,
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
