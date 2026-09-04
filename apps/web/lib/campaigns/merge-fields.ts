export const CAMPAIGN_MERGE_FIELDS = [
  { token: '{{name}}', label: 'Name', description: 'Full display name' },
  { token: '{{first_name}}', label: 'First name', description: 'First word of name' },
  { token: '{{email}}', label: 'Email', description: 'Recipient address' },
  {
    token: '{{form_url}}',
    label: 'Form link',
    description: 'Linked workspace form URL (per recipient)',
  },
] as const;

export type CampaignMergeValues = {
  name: string;
  firstName: string;
  email: string;
  formUrl?: string;
};

export function firstNameFromDisplay(displayName: string | null, email: string) {
  const source = displayName?.trim() || email.split('@')[0] || 'there';
  return source.split(/\s+/)[0] ?? 'there';
}

export function mergeValuesForRecipient(input: {
  displayName: string | null;
  email: string;
  formUrl?: string | null;
}): CampaignMergeValues {
  const name = input.displayName?.trim() || input.email;
  return {
    name,
    firstName: firstNameFromDisplay(input.displayName, input.email),
    email: input.email,
    formUrl: input.formUrl?.trim() || '',
  };
}

export function applyCampaignMergeFields(
  html: string,
  values: CampaignMergeValues,
): string {
  return html
    .replaceAll('{{name}}', escapeHtml(values.name))
    .replaceAll('{{first_name}}', escapeHtml(values.firstName))
    .replaceAll('{{email}}', escapeHtml(values.email))
    .replaceAll('{{form_url}}', escapeHtml(values.formUrl ?? ''));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
