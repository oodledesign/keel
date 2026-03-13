import 'server-only';

import { getMailer } from '@kit/mailers';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

type PaymentMethod = 'stripe' | 'cash' | 'bank_transfer';

function formatPence(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function getMethodLabel(method: PaymentMethod) {
  switch (method) {
    case 'cash':
      return 'cash';
    case 'bank_transfer':
      return 'bank transfer';
    default:
      return 'Stripe';
  }
}

export async function sendInvoicePaidNotifications(params: {
  accountId: string;
  invoiceId: string;
  paymentMethod: PaymentMethod;
}) {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';

  if (!sender || !siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select(
      'id, account_id, client_id, invoice_number, total_pence, paid_at, public_token, sent_to_email',
    )
    .eq('id', params.invoiceId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return;
  }

  const [{ data: account }, { data: client }] = await Promise.all([
    admin
      .from('accounts')
      .select('id, name, slug')
      .eq('id', params.accountId)
      .maybeSingle(),
    admin
      .from('clients')
      .select('display_name, first_name, last_name, email')
      .eq('id', invoice.client_id)
      .maybeSingle(),
  ]);

  if (!account?.slug) {
    return;
  }

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });

  const ownerAdminEmails = Array.from(
    new Set(
      (members ?? [])
        .filter((member: { role?: string | null; email?: string | null }) => {
          return (
            (member.role === 'owner' || member.role === 'admin') &&
            Boolean(member.email)
          );
        })
        .map((member: { email?: string | null }) => member.email!.toLowerCase()),
    ),
  );

  const clientName =
    client?.display_name ??
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ??
    'Client';
  const clientEmail = client?.email ?? invoice.sent_to_email ?? null;
  const amount = formatPence(invoice.total_pence ?? 0);
  const paidAt = invoice.paid_at
    ? new Date(invoice.paid_at).toLocaleString('en-GB')
    : new Date().toLocaleString('en-GB');
  const methodLabel = getMethodLabel(params.paymentMethod);
  const adminInvoiceUrl = new URL(
    `/home/${account.slug}/invoices/${invoice.id}/edit`,
    siteUrl,
  ).href;
  const portalInvoiceUrl = invoice.public_token
    ? new URL(`/portal/invoices/${invoice.public_token}`, siteUrl).href
    : null;

  const customerSubject = `Payment received for invoice ${invoice.invoice_number}`;
  const customerHtml = `
    <div style="font-family:Poppins,Arial,sans-serif;color:#09111F;line-height:1.6">
      <h2 style="margin:0 0 16px">Payment received</h2>
      <p>Hi ${clientName},</p>
      <p>We have received payment for invoice <strong>${invoice.invoice_number}</strong> via <strong>${methodLabel}</strong>.</p>
      <p><strong>Amount:</strong> ${amount}<br /><strong>Paid at:</strong> ${paidAt}</p>
      ${
        portalInvoiceUrl
          ? `<p>You can view the invoice here: <a href="${portalInvoiceUrl}">${portalInvoiceUrl}</a></p>`
          : ''
      }
      <p>Thanks,<br />${productName}</p>
    </div>
  `;

  const ownerSubject = `Invoice ${invoice.invoice_number} paid via ${methodLabel}`;
  const ownerHtml = `
    <div style="font-family:Poppins,Arial,sans-serif;color:#09111F;line-height:1.6">
      <h2 style="margin:0 0 16px">Invoice paid</h2>
      <p>Invoice <strong>${invoice.invoice_number}</strong> for <strong>${clientName}</strong> has been marked as paid via <strong>${methodLabel}</strong>.</p>
      <p><strong>Amount:</strong> ${amount}<br /><strong>Paid at:</strong> ${paidAt}</p>
      <p>Open invoice: <a href="${adminInvoiceUrl}">${adminInvoiceUrl}</a></p>
    </div>
  `;

  const mailer = await getMailer();
  const emailJobs: Promise<unknown>[] = [];

  if (clientEmail) {
    emailJobs.push(
      mailer.sendEmail({
        from: sender,
        to: clientEmail,
        subject: customerSubject,
        html: customerHtml,
      }),
    );
  }

  for (const email of ownerAdminEmails) {
    emailJobs.push(
      mailer.sendEmail({
        from: sender,
        to: email,
        subject: ownerSubject,
        html: ownerHtml,
      }),
    );
  }

  if (emailJobs.length > 0) {
    await Promise.allSettled(emailJobs);
  }
}

export async function sendInvoiceIssuedEmail(params: {
  accountId: string;
  invoiceId: string;
  recipientEmail: string;
}) {
  const sender = process.env.EMAIL_SENDER;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';

  if (!sender || !siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select(
      'id, account_id, client_id, invoice_number, total_pence, due_at, public_token',
    )
    .eq('id', params.invoiceId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (invoiceError || !invoice?.public_token) {
    return;
  }

  const [{ data: account }, { data: client }] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', params.accountId)
      .maybeSingle(),
    admin
      .from('clients')
      .select('display_name, first_name, last_name')
      .eq('id', invoice.client_id)
      .maybeSingle(),
  ]);

  const clientName =
    client?.display_name ??
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ??
    'there';
  const portalInvoiceUrl = new URL(
    `/portal/invoices/${invoice.public_token}`,
    siteUrl,
  ).href;
  const dueDate = invoice.due_at
    ? new Date(invoice.due_at).toLocaleDateString('en-GB')
    : '—';
  const amount = formatPence(invoice.total_pence ?? 0);

  const mailer = await getMailer();
  await mailer.sendEmail({
    from: sender,
    to: params.recipientEmail,
    subject: `Invoice ${invoice.invoice_number} from ${account?.name ?? productName}`,
    html: `
      <div style="font-family:Poppins,Arial,sans-serif;color:#09111F;line-height:1.6">
        <h2 style="margin:0 0 16px">Your invoice is ready</h2>
        <p>Hi ${clientName},</p>
        <p>You have received invoice <strong>${invoice.invoice_number}</strong> from <strong>${account?.name ?? productName}</strong>.</p>
        <p><strong>Total:</strong> ${amount}<br /><strong>Due date:</strong> ${dueDate}</p>
        <p>View and pay your invoice here: <a href="${portalInvoiceUrl}">${portalInvoiceUrl}</a></p>
        <p>Thanks,<br />${productName}</p>
      </div>
    `,
  });
}
