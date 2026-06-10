type SmartFieldContext = {
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  invoice?: {
    invoice_number?: string;
    total_pence?: number;
    due_at?: string | null;
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

export function renderSmartFields(template: string, ctx: SmartFieldContext): string {
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
    '{{client.fullName}}': ctx.client?.display_name?.trim() || `${clientFirst} ${clientLast}`.trim(),
    '{{client.company}}': ctx.client?.company_name?.trim() || '',
    '{{client.email}}': ctx.client?.email?.trim() || '',
    '{{invoice.number}}': ctx.invoice?.invoice_number ?? '',
    '{{invoice.total}}': formatMoney(
      ctx.invoice?.total_pence ?? 0,
      ctx.invoice?.currency ?? 'gbp',
    ),
    '{{invoice.dueDate}}': ctx.invoice?.due_at
      ? new Date(ctx.invoice.due_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '',
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

export const DEFAULT_INVOICE_EMAIL_SUBJECT =
  "Here's the invoice, ready for your payment";

export const DEFAULT_INVOICE_EMAIL_BODY = `Hello {{client.firstName}},

Here is the link to view and pay the invoice online. Please let me know if you have any questions.

Thanks for your business!`;

export const DEFAULT_INVOICE_EMAIL_SIGNATURE = `Sincerely,
{{your.firstName}} {{your.lastName}}`;
