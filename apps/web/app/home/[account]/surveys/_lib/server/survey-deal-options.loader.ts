import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isBuildingSurveyorTerminalStage } from '~/lib/building-surveyor/pipeline-stages';
import {
  type SurveyDrone,
  mapSurveyDrone,
} from '~/lib/building-surveyor/survey-drone';
import { leadAddressLine } from '~/lib/building-surveyor/surveyor-lead-draft';

export type SurveyDealOption = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
  /** Lead details used to pre-fill a new survey. */
  clientId: string | null;
  address: string;
  postcode: string;
  surveyType: string | null;
  /** Drone settings from the lead's latest quote, if any. */
  drone: SurveyDrone | null;
};

type DealRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  company_name: string | null;
  value: number | string | null;
  stage: string | null;
  client_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  survey_type: string | null;
};

export async function loadSurveyDealOptions(
  accountId: string,
): Promise<SurveyDealOption[]> {
  // survey_type is newer than the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabaseServerClient() as any;
  const { data, error } = await client
    .from('pipeline_deals')
    .select(
      'id, name, contact_name, company_name, value, stage, client_id, address_line_1, address_line_2, town, postcode, survey_type',
    )
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as DealRow[]).filter(
    (row) => !isBuildingSurveyorTerminalStage(row.stage ?? ''),
  );

  const droneByDeal = new Map<string, SurveyDrone>();
  if (rows.length > 0) {
    const { data: quotes } = await client
      .from('proposals')
      .select(
        'deal_id, created_at, survey_drone_used, survey_drone_billing, survey_drone_fee_pence',
      )
      .eq('account_id', accountId)
      .eq('kind', 'proposal')
      .in(
        'deal_id',
        rows.map((row) => row.id),
      )
      .order('created_at', { ascending: false });
    for (const quote of (quotes ?? []) as Array<
      Record<string, unknown> & { deal_id: string | null }
    >) {
      if (quote.deal_id && !droneByDeal.has(quote.deal_id)) {
        droneByDeal.set(quote.deal_id, mapSurveyDrone(quote));
      }
    }
  }

  return rows.map((row) => ({
    id: row.id,
    contactName: row.contact_name?.trim() || row.name?.trim() || '',
    companyName: row.company_name?.trim() || '',
    value: Number(row.value ?? 0),
    clientId: row.client_id,
    address: leadAddressLine({
      addressLine1: row.address_line_1,
      addressLine2: row.address_line_2,
      town: row.town,
    }),
    postcode: row.postcode?.trim() || '',
    surveyType: row.survey_type,
    drone: droneByDeal.get(row.id) ?? null,
  }));
}
