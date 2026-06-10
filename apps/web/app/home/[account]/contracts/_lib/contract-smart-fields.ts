type SmartFieldContext = {
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  contract?: {
    title?: string | null;
    total_pence?: number;
    currency?: string;
  } | null;
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  accountName?: string | null;
};

function formatMoney(pence: number, currency = 'gbp') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(pence / 100);
}

export function renderContractSmartFields(template: string, ctx: SmartFieldContext): string {
  const clientFirst =
    ctx.client?.first_name?.trim() ||
    ctx.client?.display_name?.split(' ')[0] ||
    'there';
  const clientLast = ctx.client?.last_name?.trim() || '';
  const yourFirst = ctx.sender?.first_name?.trim() || '';
  const yourLast = ctx.sender?.last_name?.trim() || '';

  const replacements: Record<string, string> = {
    '{{client.firstName}}': clientFirst,
    '{{client.lastName}}': clientLast,
    '{{client.fullName}}':
      ctx.client?.display_name?.trim() || `${clientFirst} ${clientLast}`.trim(),
    '{{client.company}}': ctx.client?.company_name?.trim() || '',
    '{{client.email}}': ctx.client?.email?.trim() || '',
    '{{contract.title}}': ctx.contract?.title?.trim() || 'Agreement',
    '{{contract.total}}': formatMoney(
      ctx.contract?.total_pence ?? 0,
      ctx.contract?.currency ?? 'gbp',
    ),
    '{{your.firstName}}': yourFirst,
    '{{your.lastName}}': yourLast,
    '{{your.fullName}}': `${yourFirst} ${yourLast}`.trim(),
    '{{account.name}}': ctx.accountName?.trim() || '',
  };

  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(key).join(value);
  }
  return output;
}

export const DEFAULT_CONTRACT_EMAIL_SUBJECT =
  'Please review and sign your agreement';

export const DEFAULT_CONTRACT_EMAIL_BODY = `Hello {{client.firstName}},

Please use the link below to review and sign the agreement. Let me know if you have any questions.

Thank you.`;

export const DEFAULT_CONTRACT_EMAIL_SIGNATURE = `Sincerely,
{{your.firstName}} {{your.lastName}}`;
