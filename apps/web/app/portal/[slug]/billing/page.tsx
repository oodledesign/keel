import Link from 'next/link';

import { ExternalLink } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { clientSubscriptionStatusLabel } from '~/lib/billing/client-subscription-status';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';

import { ManagePaymentMethodButton } from '../_components/manage-payment-method-button';
import {
  formatPortalDate,
  portalExternalHref,
} from '../_components/portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createPortalBillingService } from '../_lib/server/portal-billing.service';

interface PortalBillingPageProps {
  params: Promise<{ slug: string }>;
}

function statusLabel(status: string) {
  return clientSubscriptionStatusLabel(status);
}

export default async function PortalBillingPage({
  params,
}: PortalBillingPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const billing = await createPortalBillingService(
    getSupabaseServerClient(),
  ).getBillingBundle(ctx.accountId, ctx.clientOrgId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
            Billing
          </h2>
          <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
            Your subscriptions, payment setup, and invoice history. To cancel a
            plan, contact your agency — cancellation is not available here.
          </p>
        </div>
        {billing.canManagePaymentMethod ? (
          <ManagePaymentMethodButton
            clientOrgId={ctx.clientOrgId}
            clientSlug={slug}
          />
        ) : null}
      </div>

      {billing.pendingSetup.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Set up payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {billing.pendingSetup.map((sub) => {
              const href = portalExternalHref(sub.checkoutUrl);
              return (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--ozer-text-on-light)]">
                      {sub.planName}
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatMinorUnits(
                        sub.amountPence,
                        sub.currency,
                        sub.interval,
                      )}{' '}
                      · {statusLabel(sub.status)}
                    </p>
                  </div>
                  {href ? (
                    <Button asChild size="sm">
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        Set up payment
                        <ExternalLink className="ml-1 size-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {billing.activeSubscriptions.length === 0 ? (
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              No active subscriptions yet.
            </p>
          ) : (
            billing.activeSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="rounded-lg border border-slate-200 px-3 py-3"
              >
                <p className="font-medium text-[var(--ozer-text-on-light)]">
                  {sub.planName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatMinorUnits(
                    sub.amountPence,
                    sub.currency,
                    sub.interval,
                  )}{' '}
                  · {statusLabel(sub.status)}
                </p>
                <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
                  Next payment: {formatPortalDate(sub.nextPaymentDate)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {billing.stripeInvoices.length === 0 ? (
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              No subscription payments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  <tr>
                    <th className="px-2 py-2 font-medium">Invoice</th>
                    <th className="px-2 py-2 font-medium">Paid</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {billing.stripeInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-2 py-3 text-[var(--ozer-text-on-light)]">
                        {invoice.number ?? invoice.id.slice(-8)}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {formatPortalDate(invoice.paidAt)}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {formatMinorUnits(
                          invoice.amountPaidPence,
                          invoice.currency,
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {(() => {
                          const href = portalExternalHref(
                            invoice.hostedInvoiceUrl,
                          );
                          return href ? (
                            <Button asChild variant="ghost" size="sm">
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View
                              </a>
                            </Button>
                          ) : null;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {billing.agencyInvoices.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  <tr>
                    <th className="px-2 py-2 font-medium">Invoice</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Due</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {billing.agencyInvoices.map((invoice) => {
                    const viewHref = invoice.publicToken
                      ? `/portal/invoices/${invoice.publicToken}`
                      : null;
                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-2 py-3">
                          {invoice.invoiceNumber ?? '—'}
                        </td>
                        <td className="px-2 py-3 capitalize">
                          {invoice.status}
                        </td>
                        <td className="px-2 py-3">
                          {formatMinorUnits(
                            invoice.totalPence,
                            invoice.currency ?? 'gbp',
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {formatPortalDate(invoice.dueAt)}
                        </td>
                        <td className="px-2 py-3">
                          {viewHref ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={viewHref}>View</Link>
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
