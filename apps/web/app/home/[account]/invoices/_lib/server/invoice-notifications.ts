import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { resolveClientRecipientEmail } from '~/lib/clients/resolve-client-recipient';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { formatInvoiceMoney } from '../invoice-currency';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  renderSmartFields,
} from '../invoice-smart-fields';
import { buildInvoicePdf } from './invoice-pdf';
import { buildInvoicePdfPayload } from './invoice-pdf-payload';

type PaymentMethod = 'stripe' | 'cash' | 'bank_transfer';

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

function buildInvoiceEmailFrom(accountName: string | null | undefined) {
  return resolveTransactionalEmailFrom(accountName ?? undefined);
}

function invoicePdfFilename(input: {
  invoiceNumber: string;
  clientCompany?: string | null;
  brandName?: string | null;
}) {
  const party =
    input.clientCompany?.trim() || input.brandName?.trim() || 'Invoice';
  const safeParty = party
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  const safeNumber = input.invoiceNumber.replace(/[^\w-]/g, '');
  return `Invoice_${safeParty}_${safeNumber}.pdf`.replace(/\s+/g, '_');
}

export async function sendInvoicePaidNotifications(params: {
  accountId: string;
  invoiceId: string;
  paymentMethod: PaymentMethod;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select(
      'id, account_id, client_id, invoice_number, total_pence, currency, paid_at, public_token, sent_to_email',
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

  const from = buildInvoiceEmailFrom(account.name);
  if (!from) {
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
        .map((member: { email?: string | null }) =>
          member.email!.toLowerCase(),
        ),
    ),
  );

  const clientName =
    client?.display_name ??
    [client?.first_name, client?.last_name].filter(Boolean).join(' ') ??
    'Client';
  const recipient = invoice.client_id
    ? await resolveClientRecipientEmail(admin, invoice.client_id, {
        purpose: 'invoice',
        fallbackEmail: invoice.sent_to_email,
      })
    : { email: invoice.sent_to_email ?? null };
  const clientEmail =
    recipient.email ?? client?.email ?? invoice.sent_to_email ?? null;
  const amount = formatInvoiceMoney(invoice.total_pence ?? 0, invoice.currency);
  const paidAt = invoice.paid_at
    ? new Date(invoice.paid_at).toLocaleString('en-GB')
    : new Date().toLocaleString('en-GB');
  const methodLabel = getMethodLabel(params.paymentMethod);
  const adminInvoicePath = pathsConfig.app.accountInvoiceEdit
    .replace('[account]', account.slug)
    .replace('[id]', invoice.id);
  const adminInvoiceUrl = new URL(adminInvoicePath, siteUrl).href;
  const portalInvoiceUrl = invoice.public_token
    ? new URL(`/portal/invoices/${invoice.public_token}`, siteUrl).href
    : null;

  const brand = await loadAccountBrandResolved(params.accountId);

  const customerSubject = `Payment received for invoice ${invoice.invoice_number}`;
  const customerInner = `
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
  `;
  const customerHtml = wrapEmailHtmlWithBrand({
    brand,
    innerHtml: customerInner,
  });

  const ownerSubject = `Invoice ${invoice.invoice_number} paid via ${methodLabel}`;
  const ownerInner = `
      <h2 style="margin:0 0 16px">Invoice paid</h2>
      <p>Invoice <strong>${invoice.invoice_number}</strong> for <strong>${clientName}</strong> has been marked as paid via <strong>${methodLabel}</strong>.</p>
      <p><strong>Amount:</strong> ${amount}<br /><strong>Paid at:</strong> ${paidAt}</p>
      <p>Open invoice: <a href="${adminInvoiceUrl}">${adminInvoiceUrl}</a></p>
  `;
  const ownerHtml = wrapEmailHtmlWithBrand({
    brand,
    innerHtml: ownerInner,
  });

  const emailJobs: Promise<unknown>[] = [];

  if (clientEmail) {
    emailJobs.push(
      sendPlatformEmail({
        type: 'invoice',
        accountId: params.accountId,
        mail: {
          from,
          to: clientEmail,
          subject: customerSubject,
          html: customerHtml,
        },
        metadata: { invoice_id: params.invoiceId, event: 'paid_customer' },
      }),
    );
  }

  for (const email of ownerAdminEmails) {
    emailJobs.push(
      sendPlatformEmail({
        type: 'invoice',
        accountId: params.accountId,
        mail: {
          from,
          to: email,
          subject: ownerSubject,
          html: ownerHtml,
        },
        metadata: { invoice_id: params.invoiceId, event: 'paid_owner' },
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
  testOnly?: boolean;
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  if (!siteUrl) {
    return;
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .select('*')
    .eq('id', params.invoiceId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (invoiceError || !invoice?.public_token) {
    return;
  }

  const [{ data: account }, clientResult] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', params.accountId)
      .maybeSingle(),
    invoice.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', invoice.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const client = clientResult.data;

  const from = buildInvoiceEmailFrom(account?.name);
  if (!from) {
    return;
  }

  const recipient = invoice.client_id
    ? await resolveClientRecipientEmail(admin, invoice.client_id, {
        purpose: 'invoice',
        fallbackEmail: params.recipientEmail,
      })
    : null;

  let contact: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    email?: string | null;
  } | null = null;

  if (recipient?.contactId) {
    const { data: contactRow } = await admin
      .from('contacts')
      .select('full_name, email')
      .eq('id', recipient.contactId)
      .maybeSingle();
    contact = (contactRow as {
      full_name?: string | null;
      email?: string | null;
    } | null) ?? {
      full_name: recipient.contactName,
      email: recipient.email,
    };
  } else if (recipient?.contactName || recipient?.email) {
    contact = {
      full_name: recipient.contactName,
      email: recipient.email,
    };
  }

  const portalInvoiceUrl = new URL(
    `/portal/invoices/${invoice.public_token}`,
    siteUrl,
  ).href;

  const smartCtx = {
    client,
    contact,
    invoice,
    sender: params.sender ?? null,
    accountName: account?.name ?? productName,
  };

  const subjectTemplate =
    invoice.email_subject?.trim() || DEFAULT_INVOICE_EMAIL_SUBJECT;
  const bodyTemplate = invoice.email_body?.trim() || DEFAULT_INVOICE_EMAIL_BODY;
  const signatureTemplate =
    invoice.email_signature?.trim() || DEFAULT_INVOICE_EMAIL_SIGNATURE;

  const subject = renderSmartFields(subjectTemplate, smartCtx);
  const bodyText = renderSmartFields(bodyTemplate, smartCtx);
  const signature = renderSmartFields(signatureTemplate, smartCtx);
  const dueDate = invoice.due_at
    ? new Date(invoice.due_at).toLocaleDateString('en-GB')
    : '—';
  const amount = formatInvoiceMoney(invoice.total_pence ?? 0, invoice.currency);

  const pdfPayload = await buildInvoicePdfPayload(
    invoice,
    params.accountId,
    {},
    params.sender ?? null,
  );
  const pdfBytes = await buildInvoicePdf(pdfPayload);
  const pdfAttachment = {
    name: invoicePdfFilename({
      invoiceNumber: invoice.invoice_number,
      clientCompany: client?.company_name,
      brandName: account?.name,
    }),
    content: Buffer.from(pdfBytes).toString('base64'),
    mimeType: 'application/pdf',
  };

  const brand = await loadAccountBrandResolved(params.accountId);
  const issuedInner = `
      <h2 style="margin:0 0 16px">${subject}</h2>
      <p>${bodyText.replace(/\n/g, '<br />')}</p>
      <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
        <p style="margin:0 0 8px"><strong>Invoice ${invoice.invoice_number}</strong></p>
        <p style="margin:0 0 4px"><strong>Total:</strong> ${amount}</p>
        <p style="margin:0"><strong>Due date:</strong> ${dueDate}</p>
        <p style="margin:16px 0 0"><a href="${portalInvoiceUrl}">View and pay invoice</a></p>
      </div>
      <p>A PDF copy of this invoice is attached for your records.</p>
      <p>${signature.replace(/\n/g, '<br />')}</p>
  `;

  await sendPlatformEmail({
    type: 'invoice',
    accountId: params.accountId,
    mail: {
      from,
      to: params.recipientEmail,
      subject: params.testOnly ? `[Test] ${subject}` : subject,
      html: wrapEmailHtmlWithBrand({
        brand,
        innerHtml: issuedInner,
      }),
      attachments: [pdfAttachment],
    },
    metadata: { invoice_id: params.invoiceId, event: 'issued' },
  });
}
