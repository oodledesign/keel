import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';

import {
  DEFAULT_DRONE_FEE_PENCE,
  type SurveyDrone,
  droneQuoteLine,
  formatDroneFee,
} from './survey-drone';
import { buildSurveyorQuoteHtml } from './survey-quote';
import { leadAddressLine } from './surveyor-lead-draft';

// survey_account_settings is newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

export type QuoteLeadSource = {
  contactName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  /** Fee in pounds (pipeline_deals.value). */
  value: number | null;
};

export async function loadDroneDefaultFeePence(
  client: AnyClient,
  accountId: string,
): Promise<number> {
  const { data } = await client
    .from('survey_account_settings')
    .select('drone_fee_pence')
    .eq('account_id', accountId)
    .maybeSingle();
  const fee = (data as { drone_fee_pence?: unknown } | null)?.drone_fee_pence;
  return typeof fee === 'number' ? fee : DEFAULT_DRONE_FEE_PENCE;
}

/** Quote address: the lead's address, with the postcode when it is not already in it. */
export function quoteAddressForLead(lead: QuoteLeadSource): string {
  const line = leadAddressLine(lead);
  const postcode = lead.postcode?.trim();
  if (!postcode || line.toUpperCase().includes(postcode.toUpperCase())) {
    return line;
  }
  return line ? `${line}, ${postcode}` : postcode;
}

/** The standardised quote body for a lead. Same inputs give the same HTML. */
export async function renderSurveyorQuoteHtml(input: {
  client: AnyClient;
  accountId: string;
  firmName: string;
  lead: QuoteLeadSource;
  /** Overrides the lead address (legacy quotes typed it in). */
  address?: string | null;
  drone: Pick<SurveyDrone, 'used' | 'billing' | 'feePence'>;
  defaultDroneFeePence?: number;
}): Promise<string> {
  const currency = await getWorkspaceCurrencyWithClient(
    input.client,
    input.accountId,
  );
  const defaultFeePence =
    input.defaultDroneFeePence ??
    (input.drone.used
      ? await loadDroneDefaultFeePence(input.client, input.accountId)
      : DEFAULT_DRONE_FEE_PENCE);
  const droneLine = droneQuoteLine({
    currency,
    drone: input.drone,
    defaultFeePence,
  });
  const feePence =
    input.lead.value !== null && input.lead.value > 0
      ? Math.round(input.lead.value * 100)
      : null;

  return buildSurveyorQuoteHtml({
    address: input.address?.trim() || quoteAddressForLead(input.lead),
    clientName: input.lead.contactName?.trim() || 'Client',
    firmName: input.firmName,
    extraLines: droneLine ? [droneLine] : [],
    feeLabel:
      feePence !== null
        ? `${formatDroneFee(feePence, currency)} plus VAT`
        : null,
  });
}
