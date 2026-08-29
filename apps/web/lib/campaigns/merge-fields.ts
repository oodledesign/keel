export const CAMPAIGN_MERGE_FIELDS = [
  { token: '{{name}}', label: 'Name', description: 'Full display name' },
  { token: '{{first_name}}', label: 'First name', description: 'First word of name' },
  { token: '{{email}}', label: 'Email', description: 'Recipient address' },
] as const;

export type CampaignMergeValues = {
  name: string;
  firstName: string;
  email: string;
};

export function firstNameFromDisplay(displayName: string | null, email: string) {
  const source = displayName?.trim() || email.split('@')[0] || 'there';
  return source.split(/\s+/)[0] ?? 'there';
}

export function mergeValuesForRecipient(input: {
  displayName: string | null;
  email: string;
}): CampaignMergeValues {
  const name = input.displayName?.trim() || input.email;
  return {
    name,
    firstName: firstNameFromDisplay(input.displayName, input.email),
    email: input.email,
  };
}

export function applyCampaignMergeFields(
  html: string,
  values: CampaignMergeValues,
): string {
  return html
    .replaceAll('{{name}}', escapeHtml(values.name))
    .replaceAll('{{first_name}}', escapeHtml(values.firstName))
    .replaceAll('{{email}}', escapeHtml(values.email));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
