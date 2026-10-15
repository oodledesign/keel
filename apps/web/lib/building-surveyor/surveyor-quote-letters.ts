/**
 * Built-in quote letter HTML per survey type (Ben's letter structure).
 * Overrides live in survey_account_settings.quote_templates.
 */
import {
  SURVEYOR_TOB_SURVEY_TYPES,
  type SurveyorTobSurveyType,
  surveyTypeLabelForTob,
} from './surveyor-tob-content';

export { SURVEYOR_TOB_SURVEY_TYPES as SURVEYOR_QUOTE_SURVEY_TYPES };
export type SurveyorQuoteSurveyType = SurveyorTobSurveyType;

export function surveyorQuoteLetterName(surveyType: SurveyorQuoteSurveyType) {
  switch (surveyType) {
    case 'rics_hss_l2':
      return 'Quote letter — Level 2';
    case 'rics_hss_l3':
      return 'Quote letter — Level 3';
    case 'commercial_condition':
      return 'Quote letter — Commercial';
  }
}

export function defaultSurveyorQuoteLetterHtml(
  surveyType: SurveyorQuoteSurveyType,
) {
  const level = surveyTypeLabelForTob(surveyType);
  return [
    `<h1>Survey quotation</h1>`,
    `<p>{{lead.clientName}}</p>`,
    `<p>{{lead.clientAddress}}</p>`,
    `<p>Date: {{lead.today}}</p>`,
    `<p>Reference: {{lead.reference}}</p>`,
    `<p><strong>RE: {{lead.propertyAddress}} – ${level}</strong></p>`,
    `<p>Thank you for inviting {{account.name}} to quote for the ${level} at the above property.</p>`,
    `<h2>Fee</h2>`,
    `<p>Our fee is <strong>{{lead.feeIncVat}}</strong> ({{lead.feeExVat}} plus VAT).</p>`,
    `<h2>Programme</h2>`,
    `<p>Proposed site inspection: <strong>{{lead.inspectionAt}}</strong>. The report will normally follow within 5–10 working days of the inspection.</p>`,
    `<h2>Access</h2>`,
    `<p>Access contact: {{lead.accessContact}}. Please confirm keys and any accompanying arrangements.</p>`,
    `<p>Yours sincerely,</p>`,
    `<p>{{lead.surveyorName}}<br/>{{account.name}}</p>`,
  ].join('\n');
}

export function resolveQuoteLetterHtml(input: {
  surveyType: string | null | undefined;
  overrides?: Record<string, string> | null;
}): string {
  const key: SurveyorQuoteSurveyType =
    input.surveyType === 'rics_hss_l2' ||
    input.surveyType === 'commercial_condition'
      ? input.surveyType
      : 'rics_hss_l3';
  const override = input.overrides?.[key]?.trim();
  if (override) return override;
  return defaultSurveyorQuoteLetterHtml(key);
}
