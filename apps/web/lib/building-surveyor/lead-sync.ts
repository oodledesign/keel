/**
 * The lead (pipeline_deals) is the source of truth for draft quotes and
 * surveys. These helpers decide what changes on a linked draft. Anything that
 * has been sent is never touched.
 */
import { createHash } from 'node:crypto';

import { surveyLevelForLeadType } from './surveyor-lead';
import { leadAddressLine } from './surveyor-lead-draft';

export { surveyLevelForLeadType };

export type LeadSyncSource = {
  contactName: string | null;
  contactEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  surveyType: string | null;
  /** Fee in pounds (pipeline_deals.value). */
  value: number | null;
};

export type LinkedDocument = {
  id: string;
  kind: string;
  status: string;
  recipient_name: string | null;
  recipient_email: string | null;
  survey_property_address: string | null;
  survey_property_postcode: string | null;
  survey_type: string | null;
  survey_level: number | null;
  total_pence: number | null;
  content_html: string | null;
  quote_html_hash: string | null;
};

export function isDraftDocument(doc: Pick<LinkedDocument, 'status'>) {
  return doc.status === 'draft';
}

export function hashQuoteHtml(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}

function changed<T>(current: T, next: T) {
  return current !== next;
}

/**
 * Column patch for one linked draft. Returns an empty object for sent
 * documents and when nothing differs.
 */
export function buildDraftPatchFromLead(
  lead: LeadSyncSource,
  doc: LinkedDocument,
): Record<string, string | number | null> {
  if (!isDraftDocument(doc)) return {};
  const patch: Record<string, string | number | null> = {};

  const name = lead.contactName?.trim() || null;
  if (name && changed(doc.recipient_name, name)) patch.recipient_name = name;

  const email = lead.contactEmail?.trim() || null;
  if (email && changed(doc.recipient_email, email)) {
    patch.recipient_email = email;
  }

  const address = leadAddressLine(lead) || null;
  if (address && changed(doc.survey_property_address, address)) {
    patch.survey_property_address = address;
  }
  const postcode = lead.postcode?.trim() || null;
  if (postcode && changed(doc.survey_property_postcode, postcode)) {
    patch.survey_property_postcode = postcode;
  }

  if (doc.kind === 'survey_report') {
    const level = surveyLevelForLeadType(lead.surveyType);
    if (level !== null) {
      if (changed(doc.survey_level, level)) patch.survey_level = level;
      if (changed(doc.survey_type, lead.surveyType)) {
        patch.survey_type = lead.surveyType;
      }
    }
  } else {
    if (lead.surveyType && changed(doc.survey_type, lead.surveyType)) {
      patch.survey_type = lead.surveyType;
    }
    if (lead.value !== null && lead.value > 0) {
      const pence = Math.round(lead.value * 100);
      if (changed(doc.total_pence, pence)) patch.total_pence = pence;
    }
  }

  return patch;
}

export type QuoteBodyDecision = 'unchanged' | 'regenerate' | 'keep_edited';

/**
 * Regenerate a standardised quote body only while it still matches what was
 * last generated. A body someone has edited is kept and flagged instead.
 * `quote_html_hash` is the hash of the last generated body, so a lead change
 * that does not alter the quote leaves it alone.
 */
export function decideQuoteBody(input: {
  doc: Pick<LinkedDocument, 'content_html' | 'quote_html_hash' | 'status'>;
  regeneratedHtml: string;
}): QuoteBodyDecision {
  const { doc, regeneratedHtml } = input;
  if (!isDraftDocument(doc) || !doc.quote_html_hash) return 'unchanged';
  const current = doc.content_html ?? '';
  if (current === regeneratedHtml) return 'unchanged';
  if (hashQuoteHtml(regeneratedHtml) === doc.quote_html_hash) {
    return 'unchanged';
  }
  return hashQuoteHtml(current) === doc.quote_html_hash
    ? 'regenerate'
    : 'keep_edited';
}

/** Lead columns to update from a draft survey's Property tab. */
export function leadPatchFromSurvey(
  lead: LeadSyncSource,
  survey: {
    survey_property_address: string | null;
    survey_property_postcode: string | null;
    survey_level: number | null;
    recipient_name: string | null;
  },
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  const address = survey.survey_property_address?.trim() || '';
  const leadAddress = leadAddressLine(lead);
  if (address && address !== leadAddress) {
    patch.address_line_1 = address;
    patch.address_line_2 = null;
    patch.town = null;
  }
  const postcode = survey.survey_property_postcode?.trim() || '';
  if (postcode && postcode !== (lead.postcode?.trim() || '')) {
    patch.postcode = postcode;
  }
  const level = survey.survey_level;
  const surveyType =
    level === 3 ? 'rics_hss_l3' : level === 2 ? 'rics_hss_l2' : null;
  if (
    surveyType &&
    lead.surveyType !== surveyType &&
    lead.surveyType !== 'commercial_condition'
  ) {
    patch.survey_type = surveyType;
  }
  const name = survey.recipient_name?.trim() || '';
  if (name && name !== (lead.contactName?.trim() || '')) {
    patch.contact_name = name;
  }
  return patch;
}
