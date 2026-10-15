import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type LeadSyncSource,
  type LinkedDocument,
  buildDraftPatchFromLead,
  decideQuoteBody,
  hashQuoteHtml,
  leadPatchFromSurvey,
} from './lead-sync';
import { mapSurveyDrone } from './survey-drone';
import { isBuildingSurveyorAccount } from './surveyor-pipeline-sync';
import {
  loadDroneDefaultFeePence,
  renderSurveyorQuoteHtml,
} from './surveyor-quote-content.server';

// Lead and quote-hash columns are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return getSupabaseServerClient();
}

const LINKED_DOCUMENT_SELECT =
  'id, kind, status, recipient_name, recipient_email, survey_property_address, survey_property_postcode, survey_type, survey_level, total_pence, content_html, quote_html_hash, survey_drone_used, survey_drone_billing, survey_drone_fee_pence';

export async function loadLeadSyncSource(
  accountId: string,
  dealId: string,
): Promise<LeadSyncSource | null> {
  const { data } = await db()
    .from('pipeline_deals')
    .select(
      'name, contact_name, contact_email, contact_phone, client_address, address_line_1, address_line_2, town, postcode, survey_type, value, inspection_at',
    )
    .eq('id', dealId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    name: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    client_address: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    town: string | null;
    postcode: string | null;
    survey_type: string | null;
    value: number | string | null;
    inspection_at: string | null;
  };
  const value = row.value === null ? null : Number(row.value);
  return {
    name: row.name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    clientAddress: row.client_address,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    town: row.town,
    postcode: row.postcode,
    surveyType: row.survey_type,
    value: value !== null && Number.isFinite(value) ? value : null,
    inspectionAt: row.inspection_at,
  };
}

export async function loadFirmName(accountId: string): Promise<string> {
  const { data } = await db()
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();
  return (data as { name?: string | null } | null)?.name?.trim() || 'Surveyor';
}

/**
 * Push lead details into every linked draft quote and survey. Sent documents
 * are left alone. Returns early for accounts that are not building-surveyor.
 */
export async function syncLeadToLinkedDrafts(
  accountId: string,
  dealId: string,
): Promise<{ updated: number; flagged: number }> {
  const result = { updated: 0, flagged: 0 };
  if (!(await isBuildingSurveyorAccount(accountId))) return result;

  const lead = await loadLeadSyncSource(accountId, dealId);
  if (!lead) return result;

  const { data, error } = await db()
    .from('proposals')
    .select(LINKED_DOCUMENT_SELECT)
    .eq('account_id', accountId)
    .eq('deal_id', dealId)
    .eq('status', 'draft');
  if (error) throw new Error(error.message);

  const docs = (data ?? []) as Array<LinkedDocument & Record<string, unknown>>;
  if (docs.length === 0) return result;

  const needsQuote = docs.some(
    (doc) => doc.kind !== 'survey_report' && doc.quote_html_hash,
  );
  const [firmName, defaultDroneFeePence] = needsQuote
    ? await Promise.all([
        loadFirmName(accountId),
        loadDroneDefaultFeePence(db(), accountId),
      ])
    : ['Surveyor', 0];

  for (const doc of docs) {
    const patch: Record<string, unknown> = buildDraftPatchFromLead(lead, doc);

    if (doc.kind !== 'survey_report' && doc.quote_html_hash) {
      const html = await renderSurveyorQuoteHtml({
        client: db(),
        accountId,
        firmName,
        lead,
        drone: mapSurveyDrone(doc),
        defaultDroneFeePence,
      });
      const decision = decideQuoteBody({ doc, regeneratedHtml: html });
      if (decision === 'regenerate') {
        patch.content_html = html;
        patch.quote_html_hash = hashQuoteHtml(html);
        patch.lead_changed_at = null;
      } else if (decision === 'keep_edited') {
        patch.lead_changed_at = new Date().toISOString();
        result.flagged += 1;
      }
    }

    if (Object.keys(patch).length === 0) continue;
    const { error: updateError } = await db()
      .from('proposals')
      .update(patch)
      .eq('id', doc.id)
      .eq('account_id', accountId)
      .eq('status', 'draft');
    if (updateError) {
      console.error('[lead-sync] draft update failed', updateError.message);
      continue;
    }
    result.updated += 1;
  }

  return result;
}

/**
 * Survey Property tab edits (address, level, client) write back to the lead,
 * then flow out to the other drafts. Only draft surveys write through.
 */
export async function writeSurveyBackToLead(input: {
  accountId: string;
  proposalId: string;
}): Promise<boolean> {
  const { data } = await db()
    .from('proposals')
    .select(
      'deal_id, kind, status, survey_property_address, survey_property_postcode, survey_level, recipient_name',
    )
    .eq('id', input.proposalId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  const survey = data as {
    deal_id: string | null;
    kind: string;
    status: string;
    survey_property_address: string | null;
    survey_property_postcode: string | null;
    survey_level: number | null;
    recipient_name: string | null;
  } | null;
  if (
    !survey?.deal_id ||
    survey.kind !== 'survey_report' ||
    survey.status !== 'draft'
  ) {
    return false;
  }
  if (!(await isBuildingSurveyorAccount(input.accountId))) return false;

  const lead = await loadLeadSyncSource(input.accountId, survey.deal_id);
  if (!lead) return false;

  const patch = leadPatchFromSurvey(lead, survey);
  if (Object.keys(patch).length === 0) return false;

  const { error } = await db()
    .from('pipeline_deals')
    .update({ ...patch, last_activity_at: new Date().toISOString() })
    .eq('id', survey.deal_id)
    .eq('account_id', input.accountId);
  if (error) throw new Error(error.message);

  await syncLeadToLinkedDrafts(input.accountId, survey.deal_id);
  return true;
}
