/**
 * Default Terms of business HTML shells per survey type.
 * Built from Ben's quote letter + Form of Appointment + RICS conditions outline.
 * Editable after ensureSurveyorTobTemplates clones them into contract_templates.
 */

export type SurveyorTobSurveyType =
  | 'rics_hss_l2'
  | 'rics_hss_l3'
  | 'commercial_condition';

export const SURVEYOR_TOB_SURVEY_TYPES: SurveyorTobSurveyType[] = [
  'rics_hss_l2',
  'rics_hss_l3',
  'commercial_condition',
];

export function surveyorTobTemplateName(surveyType: SurveyorTobSurveyType) {
  switch (surveyType) {
    case 'rics_hss_l2':
      return 'Terms of business — Level 2';
    case 'rics_hss_l3':
      return 'Terms of business — Level 3';
    case 'commercial_condition':
      return 'Terms of business — Commercial';
  }
}

export function surveyTypeLabelForTob(surveyType: string | null | undefined) {
  switch (surveyType) {
    case 'rics_hss_l2':
      return 'RICS Home Survey Level 2';
    case 'rics_hss_l3':
      return 'RICS Home Survey Level 3';
    case 'commercial_condition':
      return 'Commercial building survey';
    default:
      return 'Building survey';
  }
}

export function defaultSurveyorTobHtml(surveyType: SurveyorTobSurveyType) {
  const level = surveyTypeLabelForTob(surveyType);
  return [
    `<h1>Terms of business</h1>`,
    `<p>{{lead.clientName}}</p>`,
    `<p>{{lead.clientAddress}}</p>`,
    `<p>Date: {{lead.today}}</p>`,
    `<p>Reference: {{lead.reference}}</p>`,
    `<p><strong>RE: {{lead.propertyAddress}} – ${level}</strong></p>`,
    `<p>Thank you for your instruction. Our quote for the ${level} is <strong>{{lead.feeIncVat}}</strong> ({{lead.feeExVat}} plus VAT).</p>`,
    `<h2>Programme</h2>`,
    `<p>Site inspection: <strong>{{lead.inspectionAt}}</strong>. The report will normally follow within 5–10 working days of the inspection.</p>`,
    `<h2>Form of Appointment</h2>`,
    `<p>I confirm my appointment of {{account.name}} to carry out the ${level} at {{lead.propertyAddress}} on the terms set out in this letter and the RICS Conditions of Engagement.</p>`,
    `<p>Client name: {{lead.clientName}}<br/>Email: {{lead.clientEmail}}<br/>Phone: {{lead.clientPhone}}</p>`,
    `<p>Signed: ________________________ &nbsp;&nbsp; Date: ____________</p>`,
    `<h2>RICS Conditions of Engagement</h2>`,
    `<p>The inspection and report are provided under the RICS Home Survey Standard conditions of engagement (as revised). Limitations of the inspection, liability, and payment terms are as set out in those conditions and in this letter.</p>`,
    `<p>Yours sincerely,</p>`,
    `<p>{{lead.signatoryName}}<br/>{{lead.signatoryTitle}}<br/>{{account.name}}</p>`,
  ].join('\n');
}

export type SurveyorTobLeadContext = {
  dealId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  clientAddress: string | null;
  surveyType: string | null;
  inspectionAt: string | null;
  value: number | null;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  name: string | null;
};

function propertyAddress(lead: SurveyorTobLeadContext) {
  return [lead.addressLine1, lead.addressLine2, lead.town, lead.postcode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export function buildSurveyorLeadSmartFields(input: {
  lead: SurveyorTobLeadContext;
  accountName: string;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  reference?: string | null;
}): Record<string, string> {
  const fee =
    input.lead.value != null && input.lead.value > 0 ? input.lead.value : null;
  const feeEx =
    fee != null
      ? new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(fee)
      : '';
  const feeInc =
    fee != null
      ? new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(fee * 1.2)
      : '';
  const inspection = input.lead.inspectionAt
    ? new Date(input.lead.inspectionAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'To be confirmed';

  return {
    '{{account.name}}': input.accountName,
    '{{lead.clientName}}': input.lead.contactName?.trim() || 'Client',
    '{{lead.clientEmail}}': input.lead.contactEmail?.trim() || '',
    '{{lead.clientPhone}}': input.lead.contactPhone?.trim() || '',
    '{{lead.clientAddress}}': input.lead.clientAddress?.trim() || '',
    '{{lead.propertyAddress}}': propertyAddress(input.lead) || 'Property',
    '{{lead.surveyType}}': surveyTypeLabelForTob(input.lead.surveyType),
    '{{lead.feeExVat}}': feeEx,
    '{{lead.feeIncVat}}': feeInc || feeEx,
    '{{lead.inspectionAt}}': inspection,
    '{{lead.signatoryName}}': input.signatoryName?.trim() || '',
    '{{lead.signatoryTitle}}': input.signatoryTitle?.trim() || '',
    '{{lead.surveyorName}}': input.signatoryName?.trim() || input.accountName,
    '{{lead.accessContact}}':
      input.lead.contactName?.trim() ||
      input.lead.contactPhone?.trim() ||
      'To be confirmed',
    '{{lead.reference}}':
      input.reference?.trim() ||
      input.lead.name?.trim() ||
      input.lead.dealId.slice(0, 8),
    '{{lead.today}}': new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

export function applyLeadSmartFields(
  template: string,
  fields: Record<string, string>,
) {
  let output = template;
  for (const [token, value] of Object.entries(fields)) {
    output = output.split(token).join(value);
  }
  return output;
}
