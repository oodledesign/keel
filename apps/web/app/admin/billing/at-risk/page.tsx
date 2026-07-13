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
  loadAdminAtRiskAccounts,
  type AdminAtRiskAccountRow,
} from '../_lib/load-admin-at-risk-accounts';

export const metadata = { title: 'At-risk billing' };

function statusBadge(status: AdminAtRiskAccountRow['status']) {
  switch (status) {
    case 'suspended':
      return <Badge variant="destructive">Suspended</Badge>;
    case 'past_due_restricted':
      return <Badge variant="destructive">Restricted</Badge>;
    case 'past_due_grace':
      return <Badge variant="warning">Grace</Badge>;
    case 'trialing':
      return <Badge variant="info">Trialing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

async function AdminBillingAtRiskPage() {
  const { rows, counts } = await loadAdminAtRiskAccounts();

  return (
    <>
      <PageHeader
        title="At-risk accounts"
        description="Trial and dunning workspaces for manual outreach before automated suspension. Super-admin only."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/billing">Billing analytics</Link>
        </Button>
      </PageHeader>

      <PageBody className="mx-auto max-w-5xl space-y-8 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Suspended" value={String(counts.suspended)} warning={counts.suspended > 0} />
          <MetricCard
            title="Restricted"
            value={String(counts.past_due_restricted)}
            warning={counts.past_due_restricted > 0}
          />
          <MetricCard
            title="In grace"
            value={String(counts.past_due_grace)}
            warning={counts.past_due_grace > 0}
          />
          <MetricCard title="Trialing" value={String(counts.trialing)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outreach queue</CardTitle>
            <CardDescription>
              Sorted by urgency (suspended → restricted → grace → trial ending
              soon). Use for Thistleleaf-tier personal check-ins.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="text-muted-foreground px-6 py-8 text-sm">
                No accounts in trial or dunning right now.
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => (
                  <li
                    key={row.accountId}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/workspaces/${row.accountId}`}
                          className="truncate font-medium hover:underline"
                        >
                          {row.accountName}
                        </Link>
                        {statusBadge(row.status)}
                        <span className="text-muted-foreground text-xs">
                          {row.urgencyLabel}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {row.accountEmail ?? 'No account email'}
                        {row.accountSlug ? ` · ${row.accountSlug}` : ''}
                        {row.trialDaysRemaining != null
                          ? ` · ${row.trialDaysRemaining}d trial left`
                          : ''}
                      </p>
                      {row.lastEvent ? (
                        <p className="text-muted-foreground text-xs">
                          Last event:{' '}
                          {row.lastEvent.fromStatus ?? '—'} →{' '}
                          {row.lastEvent.toStatus} ·{' '}
                          {new Date(row.lastEvent.createdAt).toLocaleString(
                            'en-GB',
                          )}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          No billing_events yet
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {row.accountEmail ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={`mailto:${row.accountEmail}`}>Email</a>
                        </Button>
                      ) : null}
                      {row.accountSlug ? (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={pathsConfig.app.accountBilling.replace(
                              '[account]',
                              row.accountSlug,
                            )}
                          >
                            Workspace billing
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/admin/workspaces/${row.accountId}`}>
                          Admin
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function MetricCard(props: {
  title: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <Card className={props.warning ? 'border-amber-500/40' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{props.value}</p>
      </CardContent>
    </Card>
  );
}

export default AdminGuard(AdminBillingAtRiskPage);
