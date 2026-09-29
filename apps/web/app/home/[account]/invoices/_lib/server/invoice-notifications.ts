import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { resolveClientRecipientEmail } from '~/lib/clients/resolve-client-recipient';
import { alignedReplyTo } from '~/lib/email/aligned-reply-to';
import { escapeEmailHtml } from '~/lib/email/ozer-transactional-shell';
import { wrapNotificationEmail } from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { notifyInvoicePaidInApp } from '~/lib/invoices/invoice-in-app-notifications';
import {
  formatInvoiceItemsLine,
  summarizeInvoicePurchase,
} from '~/lib/invoices/invoice-purchase-summary';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { formatInvoiceMoney } from '../invoice-currency';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  formatWorkspaceSenderName,
  renderSmartFields,
} from '../invoice-smart-fields';

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
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  return resolveTransactionalEmailFrom(
    formatWorkspaceSenderName(accountName, productName),
  );
}

/**
 * Prefer the workspace business contact email (Settings → Business contact),
 * then account email, sender email, then primary owner/admin.
 */
async function resolveInvoiceReplyToEmail(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  params: {
    accountId: string;
    accountSlug?: string | null;
    brandContactEmail?: string | null;
    accountEmail?: string | null;
    senderEmail?: string | null;
  },
): Promise<string | null> {
  const preferred = [
    params.brandContactEmail,
    params.accountEmail,
    params.senderEmail,
  ]
    .map((value) => value?.trim().toLowerCase() || null)
    .find((value): value is string => Boolean(value));

  if (preferred) {
    return preferred;
  }

  let slug = params.accountSlug?.trim() || null;

  if (!slug) {
    const { data: account } = await admin
      .from('accounts')
      .select('slug, email, primary_owner_user_id')
      .eq('id', params.accountId)
      .maybeSingle();

    const accountEmail = (account?.email as string | null | undefined)?.trim();
    if (accountEmail) {
      return accountEmail.toLowerCase();
    }

    slug = (account?.slug as string | null | undefined)?.trim() || null;
  }

  if (!slug) {
    return null;
  }

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: slug,
  });

  const ownerAdmin = (members ?? []).find(
    (member: { role?: string | null; email?: string | null }) =>
      (member.role === 'owner' || member.role === 'admin') &&
      Boolean(member.email?.trim()),
  ) as { email?: string | null } | undefined;

  return ownerAdmin?.email?.trim().toLowerCase() || null;
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
      'id, account_id, client_id, invoice_number, total_pence, currency, paid_at, public_token, sent_to_email, metadata',
    )
    .eq('id', params.invoiceId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (invoiceError || !invoice) {
    return;
  }

  const [{ data: account }, { data: client }, { data: items }] =
    await Promise.all([
      admin
        .from('accounts')
        .select('id, name, slug, email')
        .eq('id', params.accountId)
        .maybeSingle(),
      admin
        .from('clients')
        .select('display_name, first_name, last_name, email')
        .eq('id', invoice.client_id)
        .maybeSingle(),
      admin
        .from('invoice_items')
        .select('description')
        .eq('invoice_id', invoice.id)
        .order('sort_order', { ascending: true }),
    ]);

  if (!account?.slug) {
    return;
  }

  const from = buildInvoiceEmailFrom(account.name);
  if (!from) {
    return;
  }

  const purchase = summarizeInvoicePurchase(invoice.metadata);
  const itemsLine = formatInvoiceItemsLine(
    (items ?? []).map((item) => item.description),
  );

  const brand = await loadAccountBrandResolved(params.accountId);
  const replyTo = alignedReplyTo(
    await resolveInvoiceReplyToEmail(admin, {
      accountId: params.accountId,
      accountSlug: account.slug,
      brandContactEmail: brand.contact_email,
      accountEmail: account.email,
    }),
    from,
  );

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

  const safeInvoiceNumber = escapeEmailHtml(String(invoice.invoice_number));
  const safeClientName = escapeEmailHtml(clientName);
  const safeAmount = escapeEmailHtml(amount);
  const safePaidAt = escapeEmailHtml(paidAt);
  const safeMethod = escapeEmailHtml(methodLabel);
  const safeAccountName = escapeEmailHtml(account.name?.trim() || productName);

  const itemsHtml = itemsLine
    ? `<p style="margin:0 0 4px;"><strong>For:</strong> ${escapeEmailHtml(itemsLine)}</p>`
    : '';
  const amountHtml = `<p style="margin:0 0 4px;"><strong>Amount:</strong> ${safeAmount}</p>`;
  const paidAtHtml = `<p style="margin:0;">Paid at: ${safePaidAt}</p>`;

  let customerSubject = `Payment received for invoice ${invoice.invoice_number}`;
  let customerHeading = 'Payment received';
  let customerPreview = `${amount} paid for invoice ${invoice.invoice_number}`;
  let customerBody = `<p style="margin:0 0 12px;">We've received payment for invoice <strong>${safeInvoiceNumber}</strong> via <strong>${safeMethod}</strong>.</p>
      ${itemsHtml}${amountHtml}${paidAtHtml}`;

  let ownerSubject = `Invoice ${invoice.invoice_number} paid via ${methodLabel}`;
  let ownerHeading = 'Invoice paid';
  let ownerPreview = `${clientName} paid ${amount} via ${methodLabel}`;
  let ownerBody = `<p style="margin:0 0 12px;">Invoice <strong>${safeInvoiceNumber}</strong> for <strong>${safeClientName}</strong> has been marked as paid via <strong>${safeMethod}</strong>.</p>
      ${itemsHtml}${amountHtml}${paidAtHtml}`;

  if (purchase.kind === 'credit_topup') {
    const credits = purchase.credits;
    const validity = `${purchase.expiryMonths} month${purchase.expiryMonths === 1 ? '' : 's'}`;
    const creditsHtml = `<p style="margin:0 0 4px;"><strong>Credits added:</strong> ${credits} (valid for ${validity})</p>`;

    customerSubject = `Your ${credits}-credit top-up is confirmed`;
    customerHeading = 'Top-up confirmed';
    customerPreview = `${credits} credits added to your account`;
    customerBody = `<p style="margin:0 0 12px;">Thanks — we've received ${safeAmount} for your <strong>${credits}-credit top-up</strong> (invoice ${safeInvoiceNumber}). The credits are in your account now.</p>
      ${creditsHtml}${amountHtml}${paidAtHtml}
      <p style="margin:12px 0 0;">This is a one-off purchase, separate from any retainer.</p>`;

    ownerSubject = `Credit top-up paid: ${credits} credits · ${clientName} (${invoice.invoice_number})`;
    ownerHeading = 'Credit top-up paid';
    ownerPreview = `${clientName} bought ${credits} credits for ${amount}`;
    ownerBody = `<p style="margin:0 0 12px;"><strong>${safeClientName}</strong> bought a one-off <strong>${credits}-credit top-up</strong> (invoice ${safeInvoiceNumber}), paid via <strong>${safeMethod}</strong>.</p>
      ${creditsHtml}${amountHtml}${paidAtHtml}
      <p style="margin:12px 0 0;">This is a one-off top-up, not a retainer or subscription payment.</p>`;
  } else if (purchase.kind === 'retainer_credits') {
    const creditsHtml = `<p style="margin:0 0 4px;"><strong>Credits this cycle:</strong> ${purchase.credits}</p>`;

    customerSubject = `Retainer payment received for invoice ${invoice.invoice_number}`;
    customerHeading = 'Retainer payment received';
    customerPreview = `${amount} retainer payment · ${purchase.credits} credits this cycle`;
    customerBody = `<p style="margin:0 0 12px;">We've received your retainer payment for invoice <strong>${safeInvoiceNumber}</strong> via <strong>${safeMethod}</strong>.</p>
      ${itemsHtml}${creditsHtml}${amountHtml}${paidAtHtml}`;

    ownerSubject = `Retainer invoice ${invoice.invoice_number} paid via ${methodLabel}`;
    ownerHeading = 'Retainer invoice paid';
    ownerBody = `<p style="margin:0 0 12px;">Retainer invoice <strong>${safeInvoiceNumber}</strong> for <strong>${safeClientName}</strong> has been paid via <strong>${safeMethod}</strong>.</p>
      ${itemsHtml}${creditsHtml}${amountHtml}${paidAtHtml}`;
  }

  const customerHtml = wrapNotificationEmail(
    `<p style="margin:0 0 12px;">Hi ${safeClientName},</p>
      ${customerBody}`,
    {
      title: customerSubject,
      heading: customerHeading,
      preview: customerPreview,
      cta: portalInvoiceUrl
        ? { label: 'View invoice', href: portalInvoiceUrl }
        : undefined,
      footerNote: `You're receiving this because you paid an invoice from ${safeAccountName}.`,
      productName,
    },
  );

  const ownerHtml = wrapNotificationEmail(ownerBody, {
    title: ownerSubject,
    heading: ownerHeading,
    preview: ownerPreview,
    cta: { label: 'Open invoice', href: adminInvoiceUrl },
    footerNote: `You're receiving this because you own or admin ${safeAccountName} on ${escapeEmailHtml(productName)}.`,
    productName,
  });

  const emailJobs: Promise<unknown>[] = [];

  if (clientEmail) {
    emailJobs.push(
      sendClientFacingEmail({
        type: 'invoice',
        accountId: params.accountId,
        feature: 'invoices',
        accountName: account.name,
        displayName: formatWorkspaceSenderName(account.name, productName),
        brandContactEmail: brand.contact_email,
        mail: {
          to: clientEmail,
          subject: customerSubject,
          html: customerHtml,
          ...(replyTo ? { replyTo } : {}),
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

  await notifyInvoicePaidInApp({
    accountId: params.accountId,
    accountSlug: account.slug,
    invoiceId: params.invoiceId,
    invoiceNumber: invoice.invoice_number,
    clientName,
    totalPence: invoice.total_pence ?? 0,
    currency: invoice.currency ?? 'gbp',
    paymentMethod: params.paymentMethod,
    topupCredits: purchase.kind === 'credit_topup' ? purchase.credits : null,
  });
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

  const invoiceProjectId =
    typeof invoice.project_id === 'string' ? invoice.project_id : null;

  const [{ data: account }, clientResult, projectResult] = await Promise.all([
    admin
      .from('accounts')
      .select('name, slug, email')
      .eq('id', params.accountId)
      .maybeSingle(),
    invoice.client_id
      ? admin
          .from('clients')
          .select('display_name, first_name, last_name, company_name, email')
          .eq('id', invoice.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    invoiceProjectId
      ? admin
          .from('projects')
          .select('name')
          .eq('id', invoiceProjectId)
          .eq('account_id', params.accountId)
          .eq('project_type', 'delivery')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const client = clientResult.data;
  const projectName = projectResult.data?.name?.trim() || null;

  const from = buildInvoiceEmailFrom(account?.name);
  if (!from) {
    return;
  }

  const brand = await loadAccountBrandResolved(params.accountId);
  const replyTo = alignedReplyTo(
    await resolveInvoiceReplyToEmail(admin, {
      accountId: params.accountId,
      accountSlug: account?.slug,
      brandContactEmail: brand.contact_email,
      accountEmail: account?.email,
      senderEmail: params.sender?.email,
    }),
    from,
  );

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
    projectName,
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

  const safeInvoiceNumber = escapeEmailHtml(String(invoice.invoice_number));
  const safeAmount = escapeEmailHtml(amount);
  const safeDueDate = escapeEmailHtml(dueDate);
  const safeAccountName = escapeEmailHtml(account?.name?.trim() || productName);
  const bodyHtml = `
      <p style="margin:0 0 16px;">${escapeEmailHtml(bodyText).replace(/\r?\n/g, '<br />')}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 16px;background:#FBF6EC;border:1px solid #E7DECF;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#5A4450;">
            <p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#2A1720;"><strong>Invoice ${safeInvoiceNumber}</strong></p>
            <p style="margin:0 0 4px;"><strong>Total:</strong> ${safeAmount}</p>
            <p style="margin:0;"><strong>Due date:</strong> ${safeDueDate}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;">${escapeEmailHtml(signature).replace(/\r?\n/g, '<br />')}</p>
  `;

  await sendClientFacingEmail({
    type: 'invoice',
    accountId: params.accountId,
    feature: 'invoices',
    accountName: account?.name,
    displayName: formatWorkspaceSenderName(account?.name, productName),
    brandContactEmail: brand.contact_email,
    mail: {
      to: params.recipientEmail,
      subject: params.testOnly ? `[Test] ${subject}` : subject,
      html: wrapNotificationEmail(bodyHtml, {
        title: subject,
        heading: subject,
        preview: `Invoice ${invoice.invoice_number} · ${amount} due ${dueDate}`,
        cta: { label: 'View and pay invoice', href: portalInvoiceUrl },
        footerNote: `You're receiving this invoice from ${safeAccountName}.`,
        productName,
      }),
      ...(replyTo ? { replyTo } : {}),
    },
    metadata: { invoice_id: params.invoiceId, event: 'issued' },
  });
}
