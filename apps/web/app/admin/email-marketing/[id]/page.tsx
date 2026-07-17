import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { formatUkDateTimeShort } from '~/lib/format/uk-datetime';

import { CampaignMetricsActions } from '../_components/campaign-metrics-actions';
import {
  loadCampaignMetrics,
  loadCurrentSuperAdminEmail,
} from '../_lib/server/email-marketing.loader';

export const metadata = {
  title: 'Campaign metrics',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-[var(--workspace-shell-text)]">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function CampaignMetricsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ campaign, rows, summary }, superAdminEmail] = await Promise.all([
    loadCampaignMetrics(id),
    loadCurrentSuperAdminEmail(),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/email-marketing"
          className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          Back to campaigns
        </Link>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--workspace-shell-text)]">
              {campaign.title}
            </h1>
            <p className="text-[var(--workspace-shell-text-muted)]">
              {campaign.subject}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
          >
            {campaign.status}
          </Badge>
        </div>
        <div className="mt-4">
          <CampaignMetricsActions
            campaignId={campaign.id}
            status={campaign.status}
            subject={campaign.subject}
            htmlBody={campaign.html_body}
            plainTextBody={campaign.plain_text_body}
            superAdminEmail={superAdminEmail}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sent" value={summary.sent} />
        <StatCard label="Unique opens" value={summary.opens} />
        <StatCard label="Open rate" value={`${summary.openRate}%`} />
        <StatCard label="Unique clicks" value={summary.clicks} />
        <StatCard label="Click rate" value={`${summary.clickRate}%`} />
        <StatCard label="Bounces" value={summary.bounces} />
        <StatCard label="Unsubscribes" value={summary.unsubscribes} />
      </div>

      <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-[var(--workspace-shell-text)]">
            Recipients
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[color:var(--workspace-shell-border)] hover:bg-transparent">
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Email
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Sent
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Opened
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Clicked
                </TableHead>
                <TableHead className="text-[var(--workspace-shell-text-muted)]">
                  Counts
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-[color:var(--workspace-shell-border)]">
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-[var(--workspace-shell-text-muted)]"
                  >
                    No recipient metrics yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-[color:var(--workspace-shell-border)]"
                  >
                    <TableCell className="text-[var(--workspace-shell-text)]">
                      {row.email}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.sent_at ? formatUkDateTimeShort(row.sent_at) : '—'}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.opened_at
                        ? formatUkDateTimeShort(row.opened_at)
                        : 'No'}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.clicked_at
                        ? formatUkDateTimeShort(row.clicked_at)
                        : 'No'}
                    </TableCell>
                    <TableCell className="text-[var(--workspace-shell-text-muted)]">
                      {row.open_count ?? 0} opens / {row.click_count ?? 0}{' '}
                      clicks
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
