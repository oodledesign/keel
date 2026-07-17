import Link from 'next/link';

import { AdminGuard } from '@kit/admin/components/admin-guard';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { PageBody, PageHeader } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';

import {
  formatMoneyMinor,
  loadAdminBillingAnalytics,
} from './_lib/load-admin-billing-analytics';

export const metadata = { title: 'Billing analytics' };

async function AdminBillingPage() {
  const data = await loadAdminBillingAnalytics();

  return (
    <>
      <PageHeader
        title="Billing"
        description="Platform SaaS subscriptions — MRR estimate, dunning, and churn."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/billing/at-risk">At-risk outreach</Link>
        </Button>
      </PageHeader>
      <PageBody className="mx-auto max-w-5xl space-y-8 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Est. MRR"
            value={formatMoneyMinor(data.estimatedMrrMinor, data.currency)}
            hint="From active & trialing line items"
          />
          <MetricCard title="Active" value={String(data.activeSubscriptions)} />
          <MetricCard
            title="Trialing"
            value={String(data.trialingSubscriptions)}
          />
          <MetricCard
            title="Past due"
            value={String(data.pastDueSubscriptions)}
            variant={data.pastDueSubscriptions > 0 ? 'warning' : 'default'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status breakdown</CardTitle>
            <CardDescription>
              All platform workspace subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.statusBreakdown.map((row) => (
              <Badge key={row.status} variant="outline" className="capitalize">
                {row.status.replace('_', ' ')} · {row.count}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Past due — needs attention</h2>
          {data.pastDue.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No past-due subscriptions.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.pastDue.map((row) => (
                <li
                  key={row.subscriptionId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <Link
                      className="font-medium hover:underline"
                      href={`/admin/workspaces/${row.accountId}`}
                    >
                      {row.accountName}
                    </Link>
                    <p className="text-muted-foreground text-xs capitalize">
                      {row.status} · updated{' '}
                      {new Date(row.updatedAt).toLocaleString('en-GB')}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={pathsConfig.app.accountBilling.replace(
                        '[account]',
                        row.accountSlug,
                      )}
                    >
                      Billing
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Cancelled in the last 30 days ({data.cancelledLast30Days})
          </h2>
          {data.recentlyCancelled.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No recent cancellations.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.recentlyCancelled.map((row) => (
                <li key={row.subscriptionId} className="px-4 py-3 text-sm">
                  <span className="font-medium">{row.accountName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(row.cancelledAt).toLocaleDateString('en-GB')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}

function MetricCard(props: {
  title: string;
  value: string;
  hint?: string;
  variant?: 'default' | 'warning';
}) {
  return (
    <Card
      className={
        props.variant === 'warning' ? 'border-amber-500/40' : undefined
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{props.value}</p>
        {props.hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{props.hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default AdminGuard(AdminBillingPage);
