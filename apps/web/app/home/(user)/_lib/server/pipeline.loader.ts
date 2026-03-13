import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// ─── Types ───────────────────────────────────────────────────────────

export type PipelineDeal = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
  stage: string;
  nextAction: string;
  nextActionDate: string | null;
  businessId: string;
  businessName: string;
  businessColor: string | null;
};

export type PipelineData = {
  deals: PipelineDeal[];
  businesses: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
};

// ─── Loader ──────────────────────────────────────────────────────────

export const loadPipelineData = cache(async (): Promise<PipelineData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const userId = user.id;

  const [dealsResult, businessesResult] = await Promise.all([
    client
      .from('pipeline_deals')
      .select(
        'id, contact_name, company_name, value, stage, next_action, next_action_date, business_id, businesses(name, colour)',
      )
      .order('created_at', { ascending: false }),

    client.from('businesses').select('id, name, colour').eq('owner_id', userId),
  ]);

  const deals: PipelineDeal[] = (dealsResult.data ?? []).map((row: any) => ({
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    value: row.value ?? 0,
    stage: row.stage ?? 'lead',
    nextAction: row.next_action ?? '',
    nextActionDate: row.next_action_date ?? null,
    businessId: row.business_id ?? '',
    businessName: row.businesses?.name ?? '',
    businessColor: row.businesses?.colour ?? null,
  }));

  const businesses = (businessesResult.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name ?? '',
    color: row.colour ?? null,
  }));

  return { deals, businesses };
});

// ─── Mutation: update deal stage ─────────────────────────────────────

export async function updateDealStage(dealId: string, newStage: string) {
  const client = getSupabaseServerClient();

  const { error } = await client
    .from('pipeline_deals')
    .update({ stage: newStage })
    .eq('id', dealId);

  if (error) throw error;
}
