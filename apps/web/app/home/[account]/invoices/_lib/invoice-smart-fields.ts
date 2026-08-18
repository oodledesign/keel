type SmartFieldContext = {
  client?: {
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  /** Preferred recipient contact (finance / primary), when available. */
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
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

export function renderSmartFields(
  template: string,
  ctx: SmartFieldContext,
): string {
  const clientFirst =
    ctx.client?.first_name?.trim() ||
    ctx.client?.display_name?.split(' ')[0] ||
    'there';
  const clientLast = ctx.client?.last_name?.trim() || '';
  const contactFirst =
    ctx.contact?.first_name?.trim() ||
    ctx.contact?.full_name?.trim()?.split(/\s+/)[0] ||
    clientFirst;
  const contactLast =
    ctx.contact?.last_name?.trim() ||
    ctx.contact?.full_name?.trim()?.split(/\s+/).slice(1).join(' ') ||
    clientLast;
  const contactFull =
    ctx.contact?.full_name?.trim() ||
    [contactFirst, contactLast].filter(Boolean).join(' ').trim() ||
    ctx.client?.display_name?.trim() ||
    `${clientFirst} ${clientLast}`.trim();
  const yourFirst = ctx.sender?.first_name?.trim() || '';
  const yourLast = ctx.sender?.last_name?.trim() || '';

  const replacements: Record<string, string> = {
    // Contact = person receiving the email (preferred). Client = CRM client record.
    '{{contact.firstName}}': contactFirst,
    '{{contact.lastName}}': contactLast,
    '{{contact.fullName}}': contactFull,
    '{{contact.email}}':
      ctx.contact?.email?.trim() || ctx.client?.email?.trim() || '',
    '{{client.firstName}}': clientFirst,
    '{{client.lastName}}': clientLast,
    '{{client.fullName}}':
      ctx.client?.display_name?.trim() || `${clientFirst} ${clientLast}`.trim(),
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

export const INVOICE_SMART_FIELD_PILLS = [
  { token: '{{contact.firstName}}', label: 'Contact first name' },
  { token: '{{contact.fullName}}', label: 'Contact name' },
  { token: '{{client.company}}', label: 'Company' },
  { token: '{{client.firstName}}', label: 'Client first name' },
  { token: '{{invoice.number}}', label: 'Invoice #' },
  { token: '{{invoice.total}}', label: 'Total' },
  { token: '{{invoice.dueDate}}', label: 'Due date' },
  { token: '{{account.name}}', label: 'Workspace name' },
  { token: '{{your.firstName}}', label: 'Your first name' },
  { token: '{{your.lastName}}', label: 'Your last name' },
] as const;

/** Previous default — used to migrate stored copy that still matches it. */
export const LEGACY_INVOICE_EMAIL_SUBJECT =
  "Here's the invoice, ready for your payment";

export const DEFAULT_INVOICE_EMAIL_SUBJECT =
  'Invoice {{invoice.number}} from {{account.name}}';

export const DEFAULT_INVOICE_EMAIL_BODY = `Hello {{contact.firstName}},

Invoice {{invoice.number}} from {{account.name}} is ready to view online. Please let me know if you have any questions.

Thanks for your business!`;

/**
 * Microsoft 365 treats "Acme Ltd <hi@ozer.so>" as display-name spoofing.
 * Attribute the platform so the From name matches the sending domain.
 */
export function formatWorkspaceSenderName(
  workspaceName: string | null | undefined,
  productName = 'Ozer',
): string {
  const workspace = workspaceName?.trim();
  if (!workspace) return productName;
  if (workspace.toLowerCase() === productName.toLowerCase()) return workspace;
  return `${workspace} via ${productName}`;
}

export const DEFAULT_INVOICE_EMAIL_SIGNATURE = `Sincerely,
{{your.firstName}} {{your.lastName}}`;

export function resolveInvoiceEmailField(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Default invoice footer when card fees are not passed to the client. */
export const DEFAULT_INVOICE_FOOTER_MESSAGE = '';

export { PASS_TO_CLIENT_FEE_NOTE_LONG as INVOICE_CARD_FEE_FOOTER_MESSAGE } from './invoice-stripe-fee';
