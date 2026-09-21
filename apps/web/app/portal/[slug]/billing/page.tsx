import Link from 'next/link';

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
import { PortalPendingRetainerPayList } from '../_components/portal-pending-retainer-pay-card';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createPortalBillingService } from '../_lib/server/portal-billing.service';

interface PortalBillingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ paid?: string; checkout?: string }>;
}

function statusLabel(status: string) {
  return clientSubscriptionStatusLabel(status);
}

export default async function PortalBillingPage({
  params,
  searchParams,
}: PortalBillingPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const ctx = await loadClientPortalContext(slug);
  const billing = await createPortalBillingService(
    getSupabaseServerClient(),
  ).getBillingBundle(ctx.accountId, ctx.clientOrgId);
  const paid = query.paid === '1';
  const checkoutCancelled = query.checkout === 'cancelled';

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

      {paid ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Payment received. Your retainer will show as active once Stripe
          confirms it.
        </p>
      ) : null}
      {checkoutCancelled ? (
        <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm text-[var(--ozer-text-on-light-muted)]">
          Checkout was cancelled. You can complete payment whenever you&apos;re
          ready.
        </p>
      ) : null}

      {billing.pendingSetup.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              These retainers are not active yet. Pay now to unlock the plan.
            </p>
            <PortalPendingRetainerPayList
              items={billing.pendingSetup.map((sub) => ({
                id: sub.id,
                planName: sub.planName,
                amountPence: sub.amountPence,
                currency: sub.currency,
                interval: sub.interval,
              }))}
            />
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
