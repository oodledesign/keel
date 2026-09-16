/**
 * Standardised building-surveyor quote: address, L2 and L3 together,
 * form of appointment, and Terms of Business.
 */

export type SurveyorQuoteLevel = '2' | '3';

export type SurveyorQuoteInput = {
  address: string;
  clientName: string;
  firmName: string;
  levels?: SurveyorQuoteLevel[];
  includeFormOfAppointment?: boolean;
  includeTermsOfBusiness?: boolean;
};

export function surveyorQuoteLevels(
  levels?: SurveyorQuoteLevel[] | null,
): SurveyorQuoteLevel[] {
  const unique = [...new Set(levels ?? ['2', '3'])].filter(
    (level): level is SurveyorQuoteLevel => level === '2' || level === '3',
  );
  return unique.length > 0 ? unique : ['2', '3'];
}

export function surveyorQuoteLevelLabel(
  levels?: SurveyorQuoteLevel[] | null,
): string {
  const next = surveyorQuoteLevels(levels);
  if (next.includes('2') && next.includes('3')) {
    return 'RICS Home Survey Level 2 and Level 3';
  }
  if (next.includes('3')) return 'RICS Home Survey Level 3';
  return 'RICS Home Survey Level 2';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildSurveyorQuoteHtml(input: SurveyorQuoteInput): string {
  const address = escapeHtml(
    input.address.trim() || 'Property address to confirm',
  );
  const client = escapeHtml(input.clientName.trim() || 'Client');
  const firm = escapeHtml(input.firmName.trim() || 'Surveyor');
  const levels = surveyorQuoteLevelLabel(input.levels);
  const includeAppointment = input.includeFormOfAppointment !== false;
  const includeTerms = input.includeTermsOfBusiness !== false;

  return [
    `<h1>Survey quotation</h1>`,
    `<p>Prepared by <strong>${firm}</strong> for <strong>${client}</strong>.</p>`,
    `<h2>Property</h2>`,
    `<p>${address}</p>`,
    `<h2>Survey type</h2>`,
    `<p>${escapeHtml(levels)}. Level 2 and Level 3 are quoted together so the instruction can be confirmed at either level.</p>`,
    includeAppointment
      ? `<h2>Form of appointment</h2><p>This quotation is the form of appointment for the inspection. Instruction is confirmed when you accept this quote and sign the Terms of Business.</p>`
      : '',
    includeTerms
      ? `<h2>Terms of Business</h2><p>The firm&apos;s Terms of Business will be sent for e-signature. Acceptance and a signed Terms of Business move this instruction to Accepted.</p>`
      : '',
    `<p>Please reply to accept, or sign the linked Terms of Business to instruct ${firm}.</p>`,
  ]
    .filter(Boolean)
    .join('\n');
}
