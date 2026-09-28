import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isBuildingSurveyorTerminalStage } from '~/lib/building-surveyor/pipeline-stages';

export type SurveyDealOption = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
};

export async function loadSurveyDealOptions(
  accountId: string,
): Promise<SurveyDealOption[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('pipeline_deals')
    .select('id, name, contact_name, company_name, value, stage')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => !isBuildingSurveyorTerminalStage(row.stage ?? ''))
    .map((row) => ({
      id: row.id,
      contactName: row.contact_name?.trim() || row.name?.trim() || '',
      companyName: row.company_name?.trim() || '',
      value: Number(row.value ?? 0),
    }));
}
