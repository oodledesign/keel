import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import {
  formatPortalDate,
  formatPortalMoney,
  portalExternalHref,
} from '../_components/portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';
import type { PortalInvoice } from '../_lib/server/client-portal.service';

interface PortalBillingPageProps {
  params: Promise<{ slug: string }>;
}

function formatInvoiceTotal(pence: number, currency: string | null) {
  return formatPortalMoney(pence / 100, currency);
}

export default async function PortalBillingPage({
  params,
}: PortalBillingPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const { subscription, invoices } = await service.getBilling(ctx.clientOrgId);

  const paymentLink = subscription
    ? portalExternalHref(subscription.stripePaymentLink)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Billing</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your subscription and invoice history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscription ? (
            <>
              <p className="text-lg font-medium text-slate-900">
                {subscription.planName}
              </p>
              <p className="text-sm text-slate-600">
                {formatPortalMoney(
                  subscription.monthlyAmount,
                  subscription.currency,
                )}
                /month
                {subscription.status ? ` · ${subscription.status}` : ''}
              </p>
              <p className="text-sm text-slate-500">
                Next billing date:{' '}
                {formatPortalDate(subscription.nextBillingDate)}
              </p>
              {paymentLink ? (
                <Button asChild variant="outline" size="sm">
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                    Manage payment
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">No active subscription.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">Invoice</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Due</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: PortalInvoice) => {
                    const viewHref = invoice.publicToken
                      ? `/portal/invoices/${invoice.publicToken}`
                      : null;

                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-2 py-3 text-slate-900">
                          {invoice.invoiceNumber ?? '—'}
                        </td>
                        <td className="px-2 py-3 capitalize text-slate-600">
                          {invoice.status}
                        </td>
                        <td className="px-2 py-3 text-slate-600">
                          {formatInvoiceTotal(
                            invoice.totalPence,
                            invoice.currency,
                          )}
                        </td>
                        <td className="px-2 py-3 text-slate-600">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
