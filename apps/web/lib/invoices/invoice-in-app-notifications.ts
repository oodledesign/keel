import 'server-only';

import pathsConfig from '~/config/paths.config';
import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';
import { sendNativeInvoicePush } from '~/lib/native/apns';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

async function notifyInvoiceApns(input: {
  accountId: string;
  kind: 'paid' | 'overdue' | 'viewed';
  invoiceId: string;
  invoiceNumber: string;
  body: string;
}) {
  try {
    await sendNativeInvoicePush(input);
  } catch (error) {
    console.warn('[invoice-apns] send failed', {
      invoiceId: input.invoiceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function invoiceEditLink(accountSlug: string, invoiceId: string) {
  return pathsConfig.app.accountInvoiceEdit
    .replace('[account]', accountSlug)
    .replace('[id]', invoiceId);
}

function paymentMethodLabel(method: 'stripe' | 'cash' | 'bank_transfer') {
  switch (method) {
    case 'cash':
      return 'cash';
    case 'bank_transfer':
      return 'bank transfer';
    default:
      return 'Stripe';
  }
}

export async function notifyInvoicePaidInApp(params: {
  accountId: string;
  accountSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  totalPence: number;
  currency: string;
  paymentMethod: 'stripe' | 'cash' | 'bank_transfer';
}) {
  const amount = formatWorkspaceMoney(params.totalPence, params.currency);
  const method = paymentMethodLabel(params.paymentMethod);

  const body = `Invoice ${params.invoiceNumber} paid (${amount}) by ${params.clientName} via ${method}`;

  await createInAppNotification({
    accountId: params.accountId,
    body,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
  });

  await notifyInvoiceApns({
    accountId: params.accountId,
    kind: 'paid',
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    body,
  });
}

export async function notifyInvoiceViewedInApp(params: {
  accountId: string;
  accountSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
}) {
  const body = `${params.clientName} opened invoice ${params.invoiceNumber}`;

  await createInAppNotification({
    accountId: params.accountId,
    body,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
  });

  await notifyInvoiceApns({
    accountId: params.accountId,
    kind: 'viewed',
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    body,
  });
}

export async function notifyInvoiceOverdueInApp(params: {
  accountId: string;
  accountSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  dueAt: string;
  balancePence: number;
  currency: string;
}) {
  const dueLabel = new Date(params.dueAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  const amount = formatWorkspaceMoney(params.balancePence, params.currency);

  const body = `Invoice ${params.invoiceNumber} for ${params.clientName} is overdue (${amount} due ${dueLabel})`;

  await createInAppNotification({
    accountId: params.accountId,
    type: 'warning',
    body,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
  });

  await notifyInvoiceApns({
    accountId: params.accountId,
    kind: 'overdue',
    invoiceId: params.invoiceId,
    invoiceNumber: params.invoiceNumber,
    body,
  });
}
