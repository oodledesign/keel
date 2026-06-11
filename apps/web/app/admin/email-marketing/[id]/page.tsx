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

import {
  formatUkDateTimeShort,
} from '~/lib/format/uk-datetime';

import { loadCampaignMetrics, loadCurrentSuperAdminEmail } from '../_lib/server/email-marketing.loader';
import { CampaignMetricsActions } from '../_components/campaign-metrics-actions';

export const metadata = {
  title: 'Campaign metrics',
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-400">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
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
          className="text-sm text-zinc-400 hover:text-white"
        >
          Back to campaigns
        </Link>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.title}</h1>
            <p className="text-zinc-400">{campaign.subject}</p>
          </div>
          <Badge variant="outline" className="border-white/10 text-zinc-200">
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

      <Card className="border-white/10 bg-[var(--workspace-shell-panel)]">
        <CardHeader>
          <CardTitle className="text-white">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Sent</TableHead>
                <TableHead className="text-zinc-400">Opened</TableHead>
                <TableHead className="text-zinc-400">Clicked</TableHead>
                <TableHead className="text-zinc-400">Counts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-white/10">
                  <TableCell colSpan={5} className="py-10 text-center text-zinc-500">
                    No recipient metrics yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-white/10">
                    <TableCell className="text-white">{row.email}</TableCell>
                    <TableCell className="text-zinc-300">
                      {row.sent_at ? formatUkDateTimeShort(row.sent_at) : '—'}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {row.opened_at ? formatUkDateTimeShort(row.opened_at) : 'No'}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {row.clicked_at ? formatUkDateTimeShort(row.clicked_at) : 'No'}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {row.open_count ?? 0} opens / {row.click_count ?? 0} clicks
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
