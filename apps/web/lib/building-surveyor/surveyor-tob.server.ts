import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createContractsService } from '~/home/[account]/contracts/_lib/server/contracts.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { resolveTradingOrAccountName } from '~/lib/brand/trading-name';

import { isBuildingSurveyorAccount } from './surveyor-pipeline-sync';
import {
  type SurveyorTobLeadContext,
  type SurveyorTobSurveyType,
  SURVEYOR_TOB_SURVEY_TYPES,
  applyLeadSmartFields,
  buildSurveyorLeadSmartFields,
  defaultSurveyorTobHtml,
  surveyorTobTemplateName,
} from './surveyor-tob-content';

export type { SurveyorTobLeadContext };
export { applyLeadSmartFields, buildSurveyorLeadSmartFields };

// Newer surveyor columns may lag generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

function normalizeTobSurveyType(
  value: string | null | undefined,
): SurveyorTobSurveyType {
  if (value === 'rics_hss_l2' || value === 'commercial_condition') {
    return value;
  }
  return 'rics_hss_l3';
}

export async function ensureSurveyorTobTemplates(
  accountId: string,
  client?: AnyClient,
) {
  if (!(await isBuildingSurveyorAccount(accountId))) {
    throw new Error(
      'Terms of business are only for building-surveyor workspaces',
    );
  }
  const db = client ?? getSupabaseServerAdminClient();

  for (const surveyType of SURVEYOR_TOB_SURVEY_TYPES) {
    const { data: existing } = await db
      .from('contract_templates')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_terms_of_business', true)
      .eq('survey_type', surveyType)
      .maybeSingle();
    if (existing?.id) continue;

    const { error } = await db.from('contract_templates').insert({
      account_id: accountId,
      name: surveyorTobTemplateName(surveyType),
      content_html: defaultSurveyorTobHtml(surveyType),
      default_title: surveyorTobTemplateName(surveyType),
      is_terms_of_business: true,
      survey_type: surveyType,
    });
    if (error) throw new Error(error.message);
  }
}

export async function loadSurveyorTobSettings(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('survey_account_settings')
    .select(
      'tob_signatory_name, tob_signatory_title, tob_signature_type, tob_signature_data, quote_templates',
    )
    .eq('account_id', accountId)
    .maybeSingle();
  return {
    tobSignatoryName:
      (data as { tob_signatory_name?: string | null } | null)
        ?.tob_signatory_name ?? null,
    tobSignatoryTitle:
      (data as { tob_signatory_title?: string | null } | null)
        ?.tob_signatory_title ?? null,
    tobSignatureType:
      (data as { tob_signature_type?: string | null } | null)
        ?.tob_signature_type ?? null,
    tobSignatureData:
      (data as { tob_signature_data?: string | null } | null)
        ?.tob_signature_data ?? null,
    quoteTemplates:
      (data as { quote_templates?: Record<string, string> | null } | null)
        ?.quote_templates ?? {},
  };
}

/**
 * Create a ToB contract for a lead via the contracts service, apply the saved
 * firm signature, and send it to the client email.
 */
export async function sendSurveyorTermsForDeal(input: {
  accountId: string;
  dealId: string;
  /** Authenticated Supabase client (RLS + permission checks). */
  client: AnyClient;
}) {
  if (!(await isBuildingSurveyorAccount(input.accountId))) {
    throw new Error(
      'Terms of business are only for building-surveyor workspaces',
    );
  }

  const admin = getSupabaseServerAdminClient();
  await ensureSurveyorTobTemplates(input.accountId, admin);

  const { data: lead, error: leadError } = await input.client
    .from('pipeline_deals')
    .select(
      'id, name, contact_name, contact_email, contact_phone, client_address, survey_type, inspection_at, value, address_line1, address_line2, town, postcode',
    )
    .eq('id', input.dealId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  if (leadError || !lead) throw new Error('Lead not found');

  const settings = await loadSurveyorTobSettings(input.accountId);
  if (!settings.tobSignatureData?.trim() || !settings.tobSignatoryName?.trim()) {
    throw new Error(
      'Save a Terms of business signature in Surveyor profile settings first',
    );
  }

  const email = (lead as { contact_email?: string | null }).contact_email?.trim();
  if (!email) {
    throw new Error('Add a client email on the lead before sending terms');
  }

  const surveyType = normalizeTobSurveyType(
    (lead as { survey_type?: string | null }).survey_type,
  );
  const { data: template } = await admin
    .from('contract_templates')
    .select('id, content_html, default_title')
    .eq('account_id', input.accountId)
    .eq('is_terms_of_business', true)
    .eq('survey_type', surveyType)
    .maybeSingle();
  if (!template?.id) throw new Error('Terms of business template missing');

  const brand = await loadAccountBrandResolved(input.accountId);
  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', input.accountId)
    .maybeSingle();
  const accountName = resolveTradingOrAccountName({
    tradingName: brand.trading_name,
    accountName: account?.name,
  });

  const leadCtx: SurveyorTobLeadContext = {
    dealId: input.dealId,
    contactName: (lead as { contact_name?: string | null }).contact_name ?? null,
    contactEmail: email,
    contactPhone:
      (lead as { contact_phone?: string | null }).contact_phone ?? null,
    clientAddress:
      (lead as { client_address?: string | null }).client_address ?? null,
    surveyType: (lead as { survey_type?: string | null }).survey_type ?? null,
    inspectionAt:
      (lead as { inspection_at?: string | null }).inspection_at ?? null,
    value: (lead as { value?: number | null }).value ?? null,
    addressLine1:
      (lead as { address_line1?: string | null }).address_line1 ?? null,
    addressLine2:
      (lead as { address_line2?: string | null }).address_line2 ?? null,
    town: (lead as { town?: string | null }).town ?? null,
    postcode: (lead as { postcode?: string | null }).postcode ?? null,
    name: (lead as { name?: string | null }).name ?? null,
  };

  const fields = buildSurveyorLeadSmartFields({
    lead: leadCtx,
    accountName,
    signatoryName: settings.tobSignatoryName,
    signatoryTitle: settings.tobSignatoryTitle,
  });
  const contentHtml = applyLeadSmartFields(
    String(template.content_html ?? ''),
    fields,
  );
  const title =
    String(template.default_title ?? '').trim() ||
    surveyorTobTemplateName(surveyType);

  const service = createContractsService(input.client);
  const contract = await service.createContract({
    accountId: input.accountId,
    deal_id: input.dealId,
    title,
    content_html: contentHtml,
    recipient_email: email,
    recipient_name: leadCtx.contactName,
    recipient_type: 'individual',
    total_pence: 0,
    currency: 'gbp',
    payment_plan: [],
    auto_send_on_approval: false,
  });

  await admin
    .from('contracts')
    .update({ is_terms_of_business: true } as never)
    .eq('id', contract.id)
    .eq('account_id', input.accountId);

  await service.signAuthor({
    accountId: input.accountId,
    contractId: contract.id as string,
    author_type: 'individual',
    author_name: settings.tobSignatoryName,
    author_company: accountName,
    author_signature_type:
      settings.tobSignatureType === 'typed' ? 'typed' : 'drawn',
    author_signature_data: settings.tobSignatureData,
    send_after_sign: true,
    sent_to_email: email,
  });

  await input.client
    .from('pipeline_deals')
    .update({ stage: 'tob_sent' } as never)
    .eq('id', input.dealId)
    .eq('account_id', input.accountId);

  return { contractId: contract.id as string };
}
