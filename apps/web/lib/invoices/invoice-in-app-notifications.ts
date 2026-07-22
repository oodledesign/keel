import 'server-only';

import pathsConfig from '~/config/paths.config';
import { formatWorkspaceMoney } from '~/lib/currency/workspace-currency';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

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

  await createInAppNotification({
    accountId: params.accountId,
    body: `Invoice ${params.invoiceNumber} paid (${amount}) by ${params.clientName} via ${method}`,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
  });
}

export async function notifyInvoiceViewedInApp(params: {
  accountId: string;
  accountSlug: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
}) {
  await createInAppNotification({
    accountId: params.accountId,
    body: `${params.clientName} opened invoice ${params.invoiceNumber}`,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
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

  await createInAppNotification({
    accountId: params.accountId,
    type: 'warning',
    body: `Invoice ${params.invoiceNumber} for ${params.clientName} is overdue (${amount} due ${dueLabel})`,
    link: invoiceEditLink(params.accountSlug, params.invoiceId),
  });
}
