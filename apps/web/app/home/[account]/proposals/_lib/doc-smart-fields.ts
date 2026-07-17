type SmartFieldContext = {
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  proposal?: {
    title?: string | null;
    total_pence?: number | null;
    currency?: string | null;
    expires_at?: string | null;
    recipient_name?: string | null;
  } | null;
  contract?: {
    title?: string | null;
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

export function renderSmartFields(
  template: string,
  ctx: SmartFieldContext,
): string {
  const clientFirst =
    ctx.client?.first_name?.trim() ||
    ctx.proposal?.recipient_name?.trim()?.split(' ')[0] ||
    ctx.client?.display_name?.split(' ')[0] ||
    'there';
  const clientLast = ctx.client?.last_name?.trim() || '';
  const yourFirst = ctx.sender?.first_name?.trim() || '';
  const yourLast = ctx.sender?.last_name?.trim() || '';

  const replacements: Record<string, string> = {
    '{{client.firstName}}': clientFirst,
    '{{client.lastName}}': clientLast,
    '{{client.fullName}}':
      ctx.client?.display_name?.trim() ||
      ctx.proposal?.recipient_name?.trim() ||
      `${clientFirst} ${clientLast}`.trim(),
    '{{client.company}}': ctx.client?.company_name?.trim() || '',
    '{{client.email}}': ctx.client?.email?.trim() || '',
    '{{proposal.title}}': ctx.proposal?.title?.trim() || 'Proposal',
    '{{proposal.total}}':
      ctx.proposal?.total_pence != null
        ? formatMoney(ctx.proposal.total_pence, ctx.proposal.currency ?? 'gbp')
        : '',
    '{{proposal.expiresAt}}': ctx.proposal?.expires_at
      ? new Date(ctx.proposal.expires_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '',
    '{{contract.title}}': ctx.contract?.title?.trim() || '',
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

export const DEFAULT_PROPOSAL_EMAIL_SUBJECT =
  'Your proposal from {{account.name}}';

export const DEFAULT_PROPOSAL_EMAIL_BODY = `Hello {{client.firstName}},

Please review the proposal below. You can approve, decline, or leave a comment directly from the link.

Let me know if you have any questions.`;

export const DEFAULT_PROPOSAL_EMAIL_SIGNATURE = `Best regards,
{{your.firstName}} {{your.lastName}}
{{account.name}}`;

export const DEFAULT_CONTRACT_EMAIL_SUBJECT =
  'Your agreement from {{account.name}}';

export const DEFAULT_CONTRACT_EMAIL_BODY = `Hello {{client.firstName}},

Your agreement is ready to review and sign. Please open the link below when you are ready.

Thank you.`;

export const DEFAULT_CONTRACT_EMAIL_SIGNATURE =
  DEFAULT_PROPOSAL_EMAIL_SIGNATURE;
