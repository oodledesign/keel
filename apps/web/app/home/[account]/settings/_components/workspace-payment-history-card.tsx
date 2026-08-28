import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import type { PlatformBillingInvoice } from '~/lib/billing/platform-billing-invoices';
import { formatBillingDate } from '~/lib/billing/format-billing-date';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';

type WorkspacePaymentHistoryCardProps = {
  invoices: PlatformBillingInvoice[];
};

export function WorkspacePaymentHistoryCard({
  invoices,
}: WorkspacePaymentHistoryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payment history</CardTitle>
        <CardDescription>
          {invoices.length === 0
            ? 'Paid workspace plan invoices from Stripe.'
            : 'Paid invoices for your workspace plan subscription.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subscription payments yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-muted-foreground border-b text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Invoice</th>
                  <th className="px-2 py-2 font-medium">Paid</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b last:border-0"
                  >
                    <td className="px-2 py-3">
                      {invoice.number ?? invoice.id.slice(-8)}
                    </td>
                    <td className="text-muted-foreground px-2 py-3">
                      {formatBillingDate(invoice.paidAt)}
                    </td>
                    <td className="text-muted-foreground px-2 py-3">
                      {formatMinorUnits(
                        invoice.amountPaidPence,
                        invoice.currency,
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.invoicePdf ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]/80"
                          >
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF
                            </a>
                          </Button>
                        ) : null}
                        {invoice.hostedInvoiceUrl ? (
                          <Button
                            asChild
                            size="sm"
                            className="ozer-gradient-btn h-8 px-3 text-[var(--ozer-white)]"
                          >
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
