/**
 * Contract template / email smart-field tokens.
 *
 * Tokens stay in stored HTML until they are resolved (create-from-template
 * or when a draft's related fields change). Already-resolved text is left
 * alone — we only replace remaining `{{token}}` placeholders.
 */

export type SmartFieldClient = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  company_name?: string | null;
  email?: string | null;
};

export type SmartFieldContract = {
  title?: string | null;
  total_pence?: number;
  currency?: string;
  payment_plan?: Array<{ label: string; percent: number }> | null;
};

export type SmartFieldSender = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

export type SmartFieldContext = {
  client?: SmartFieldClient | null;
  contract?: SmartFieldContract | null;
  sender?: SmartFieldSender | null;
  accountName?: string | null;
  authorName?: string | null;
  authorCompany?: string | null;
  now?: Date;
};

export type SmartFieldDefinition = {
  token: string;
  label: string;
  group: 'Client' | 'Contract' | 'Author' | 'Account';
};

export const CONTRACT_SMART_FIELDS: SmartFieldDefinition[] = [
  { token: '{{client.fullName}}', label: 'Client name', group: 'Client' },
  {
    token: '{{client.firstName}}',
    label: 'Client first name',
    group: 'Client',
  },
  { token: '{{client.lastName}}', label: 'Client last name', group: 'Client' },
  { token: '{{client.company}}', label: 'Client company', group: 'Client' },
  { token: '{{client.email}}', label: 'Client email', group: 'Client' },
  { token: '{{contract.title}}', label: 'Contract title', group: 'Contract' },
  { token: '{{contract.total}}', label: 'Amount', group: 'Contract' },
  { token: '{{contract.date}}', label: 'Date', group: 'Contract' },
  {
    token: '{{contract.paymentPlan}}',
    label: 'Payment plan',
    group: 'Contract',
  },
  { token: '{{author.name}}', label: 'Author name', group: 'Author' },
  { token: '{{author.company}}', label: 'Author company', group: 'Author' },
  { token: '{{your.fullName}}', label: 'Your name', group: 'Author' },
  { token: '{{account.name}}', label: 'Account name', group: 'Account' },
];

export const SMART_FIELD_TOKEN_PATTERN = /\{\{\s*[\w.]+?\s*\}\}/g;

export function formatContractMoney(pence: number, currency = 'gbp'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

export function formatContractDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatPaymentPlanText(
  items: Array<{ label: string; percent: number }> | null | undefined,
  totalPence = 0,
  currency = 'gbp',
): string {
  if (!items || items.length === 0) return '';
  return items
    .map((item) => {
      const amount = formatContractMoney(
        Math.round((totalPence * item.percent) / 100),
        currency,
      );
      return `${item.label}: ${item.percent}% (${amount})`;
    })
    .join('\n');
}

export function hasSmartFieldTokens(template: string): boolean {
  return listUnresolvedSmartFields(template).length > 0;
}

export function listUnresolvedSmartFields(template: string): string[] {
  const found = template.match(SMART_FIELD_TOKEN_PATTERN) ?? [];
  return Array.from(new Set(found.map((token) => token.replace(/\s+/g, ''))));
}

function personName(
  first?: string | null,
  last?: string | null,
  display?: string | null,
): { first: string; last: string; full: string } {
  const firstName = first?.trim() || display?.trim().split(/\s+/)[0] || '';
  const lastName = last?.trim() || '';
  const full = display?.trim() || `${firstName} ${lastName}`.trim();
  return { first: firstName, last: lastName, full };
}

export function buildSmartFieldReplacements(
  ctx: SmartFieldContext,
): Record<string, string> {
  const client = personName(
    ctx.client?.first_name,
    ctx.client?.last_name,
    ctx.client?.display_name,
  );
  const sender = personName(ctx.sender?.first_name, ctx.sender?.last_name);
  const now = ctx.now ?? new Date();
  const currency = ctx.contract?.currency ?? 'gbp';
  const total = ctx.contract?.total_pence ?? 0;
  const date = formatContractDate(now);
  const paymentPlan = formatPaymentPlanText(
    ctx.contract?.payment_plan,
    total,
    currency,
  );
  const authorName = ctx.authorName?.trim() || sender.full;
  const authorCompany = ctx.authorCompany?.trim() || '';

  return {
    '{{client.firstName}}': client.first || 'there',
    '{{client.lastName}}': client.last,
    '{{client.fullName}}': client.full,
    '{{client.company}}': ctx.client?.company_name?.trim() || '',
    '{{client.email}}': ctx.client?.email?.trim() || '',
    '{{contract.title}}': ctx.contract?.title?.trim() || 'Agreement',
    '{{contract.total}}': formatContractMoney(total, currency),
    '{{contract.amount}}': formatContractMoney(total, currency),
    '{{amount}}': formatContractMoney(total, currency),
    '{{contract.date}}': date,
    '{{date}}': date,
    '{{today}}': date,
    '{{contract.paymentPlan}}': paymentPlan,
    '{{paymentPlan}}': paymentPlan,
    '{{your.firstName}}': sender.first,
    '{{your.lastName}}': sender.last,
    '{{your.fullName}}': sender.full,
    '{{author.name}}': authorName,
    '{{author.company}}': authorCompany,
    '{{account.name}}': ctx.accountName?.trim() || '',
  };
}

/**
 * Replace `{{token}}` placeholders. Whitespace inside the braces is ignored
 * so `{{ client.fullName }}` still resolves.
 */
export function renderContractSmartFields(
  template: string,
  ctx: SmartFieldContext,
): string {
  if (!template) return template;
  const replacements = buildSmartFieldReplacements(ctx);
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (full, name: string) => {
    const token = `{{${name}}}`;
    return Object.prototype.hasOwnProperty.call(replacements, token)
      ? replacements[token]!
      : full;
  });
}

export const DEFAULT_CONTRACT_EMAIL_SUBJECT =
  'Please review and sign your agreement';

export const DEFAULT_CONTRACT_EMAIL_BODY = `Hello {{client.firstName}},

Please use the link below to review and sign the agreement. Let me know if you have any questions.

Thank you.`;

export const DEFAULT_CONTRACT_EMAIL_SIGNATURE = `Sincerely,
{{your.firstName}} {{your.lastName}}`;
