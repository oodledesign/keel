export const CAMPAIGN_MERGE_FIELDS = [
  { token: '{{name}}', label: 'Name', description: 'Full display name' },
  {
    token: '{{first_name}}',
    label: 'First name',
    description: 'First word of name',
  },
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
  /** Contact custom field values keyed by field key (`{{custom.key}}`). */
  custom?: Record<string, string>;
};

export const CUSTOM_MERGE_PREFIX = 'custom.';

const CUSTOM_TOKEN_RE = /\{\{custom\.([a-z][a-z0-9_]*)\}\}/g;

export type CampaignMergeFieldOption = {
  token: string;
  label: string;
  description: string;
};

export function customMergeFieldOptions(
  definitions: Array<{ key: string; label: string }>,
): CampaignMergeFieldOption[] {
  return definitions.map((definition) => ({
    token: `{{${CUSTOM_MERGE_PREFIX}${definition.key}}}`,
    label: definition.label,
    description: 'Custom contact field',
  }));
}

function customValueToText(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LEADING_OR_TRAILING_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

function localPartFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? '';
  return local || 'there';
}

function looksLikeEmail(value: string): boolean {
  return value.includes('@') && !value.includes(' ');
}

/**
 * A stored name is usable when it has a letter or digit and is not just the
 * recipient's email (common when CRM rows have no first/last name).
 */
function usablePersonName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (looksLikeEmail(trimmed)) return null;
  if (!HAS_LETTER_OR_DIGIT.test(trimmed)) return null;
  return trimmed;
}

export function firstNameFromDisplay(
  displayName: string | null,
  email: string,
) {
  const usable = usablePersonName(displayName);
  if (usable) {
    const first = usable.split(/\s+/)[0] ?? '';
    const cleaned = first.replace(LEADING_OR_TRAILING_PUNCT, '');
    if (cleaned && !looksLikeEmail(cleaned)) {
      return cleaned;
    }
  }

  return localPartFromEmail(email);
}

export function mergeValuesForRecipient(input: {
  displayName: string | null;
  email: string;
  formUrl?: string | null;
  customFields?: Record<string, string | number | boolean> | null;
}): CampaignMergeValues {
  const name = usablePersonName(input.displayName) || input.email;
  return {
    name,
    firstName: firstNameFromDisplay(input.displayName, input.email),
    email: input.email,
    formUrl: input.formUrl?.trim() || '',
    custom: input.customFields
      ? Object.fromEntries(
          Object.entries(input.customFields).map(([key, value]) => [
            key,
            customValueToText(value),
          ]),
        )
      : undefined,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Drop a leftover comma next to an empty merge so
 * "You're invited, {{first_name}}" / "{{first_name}}, you're invited"
 * does not become ", you're invited".
 */
function replaceMergeToken(
  text: string,
  token: string,
  value: string,
  escape: boolean,
): string {
  if (value) {
    const inserted = escape ? escapeHtml(value) : value;
    return text.replaceAll(token, inserted);
  }

  const tokenRe = escapeRegExp(token);
  return text
    .replace(new RegExp(`\\s*,\\s*${tokenRe}`, 'g'), '')
    .replace(new RegExp(`${tokenRe}\\s*,\\s*`, 'g'), '')
    .replaceAll(token, '');
}

function applyMerge(
  text: string,
  values: CampaignMergeValues,
  escape: boolean,
): string {
  const standard = (
    [
      ['{{name}}', values.name],
      ['{{first_name}}', values.firstName],
      ['{{email}}', values.email],
      ['{{form_url}}', values.formUrl ?? ''],
    ] as const
  ).reduce(
    (current, [token, value]) =>
      replaceMergeToken(current, token, value, escape),
    text,
  );

  // Unknown or empty custom tags render blank rather than leaking raw tokens.
  const customTokens = new Set(
    [...standard.matchAll(CUSTOM_TOKEN_RE)].map((match) => match[0]),
  );
  return [...customTokens].reduce((current, token) => {
    const key = token.slice(2 + CUSTOM_MERGE_PREFIX.length, -2);
    return replaceMergeToken(
      current,
      token,
      values.custom?.[key] ?? '',
      escape,
    );
  }, standard);
}

/** Replace merge tags in HTML (values are escaped). */
export function applyCampaignMergeFields(
  html: string,
  values: CampaignMergeValues,
): string {
  return applyMerge(html, values, true);
}

/** Replace merge tags in plain text (subjects). Do not HTML-escape. */
export function applyCampaignMergeText(
  text: string,
  values: CampaignMergeValues,
): string {
  return applyMerge(text, values, false);
}
