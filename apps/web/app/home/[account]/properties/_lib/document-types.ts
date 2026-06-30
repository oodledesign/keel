export const PROPERTY_DOCUMENT_TYPES = [
  'contract',
  'lease',
  'insurance',
  'inspection',
  'title_deed',
  'mortgage',
  'tax',
  'utility',
  'photo',
  'other',
] as const;

export type PropertyDocumentType = (typeof PROPERTY_DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<PropertyDocumentType, string> = {
  contract: 'Contract',
  lease: 'Lease',
  insurance: 'Insurance',
  inspection: 'Inspection',
  title_deed: 'Title Deed',
  mortgage: 'Mortgage',
  tax: 'Tax',
  utility: 'Utility',
  photo: 'Photo',
  other: 'Other',
};

/**
 * UK tax/financial year runs 6 April – 5 April. Returns labels like "2024/25",
 * most recent first (covering `yearsForward` years ahead and `yearsBack` behind
 * the current financial year).
 */
export function generateFinancialYearOptions(
  yearsBack = 8,
  yearsForward = 1,
): string[] {
  const now = new Date();
  const currentFyStartYear =
    now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6)
      ? now.getFullYear()
      : now.getFullYear() - 1;

  const options: string[] = [];
  for (let offset = yearsForward; offset >= -yearsBack; offset--) {
    const startYear = currentFyStartYear + offset;
    const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
    options.push(`${startYear}/${endYearShort}`);
  }
  return options;
}
