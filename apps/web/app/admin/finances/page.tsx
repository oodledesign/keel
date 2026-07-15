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

import { FinancesDeleteCostButton } from './_components/finances-delete-cost-button';
import { FinancesModelRatesForm } from './_components/finances-model-rates-form';
import { FinancesOperatingCostForm } from './_components/finances-operating-cost-form';
import {
  formatMoneyMinor,
  formatUsd,
  loadAdminFinances,
} from './_lib/load-admin-finances';

export const metadata = { title: 'Platform finances' };

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

function monthParamFromPeriod(periodMonth: string): string {
  return periodMonth.slice(0, 7);
}

function shiftMonth(periodMonth: string, delta: number): string {
  const d = new Date(`${periodMonth}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function AdminFinancesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const data = await loadAdminFinances(sp.month);
  const monthKey = monthParamFromPeriod(data.periodMonth);

  return (
    <>
      <PageHeader
        title="Finances"
        description="Unit economics: SaaS revenue, estimated AI COGS, and monthly operating costs."
      >
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/finances?month=${shiftMonth(data.periodMonth, -1)}`}>
              Previous
            </Link>
          </Button>
          <Badge variant="outline" className="font-mono">
            {monthKey}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/finances?month=${shiftMonth(data.periodMonth, 1)}`}>
              Next
            </Link>
          </Button>
        </div>
      </PageHeader>

      <PageBody className="mx-auto max-w-5xl space-y-8 py-4">
        <p className="text-muted-foreground text-sm">
          AI costs are estimated from token usage × editable USD model rates
          (not your raw Anthropic/Google invoice). Operating costs are manual
          GBP line items you enter from Vercel, Supabase, email, domains, etc.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Est. SaaS MRR"
            value={formatMoneyMinor(data.estimatedMrrMinor, data.mrrCurrency)}
            hint="Active & trialing subscriptions"
          />
          <MetricCard
            title="AI pack revenue"
            value={formatMoneyMinor(
              data.aiPackRevenueMinor,
              data.aiPackRevenueCurrency,
            )}
            hint="Credit pack purchases this month"
          />
          <MetricCard
            title="Est. AI COGS"
            value={formatUsd(data.aiEstimatedCostUsd)}
            hint={`${data.aiCreditsUsed.toLocaleString()} credits · ${(data.aiInputTokens / 1000).toFixed(1)}k in / ${(data.aiOutputTokens / 1000).toFixed(1)}k out`}
          />
          <MetricCard
            title="Operating costs"
            value={formatMoneyMinor(
              data.operatingCostsTotalMinor,
              data.operatingCostsCurrency,
            )}
            hint="Logged infra / SaaS invoices"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Paying workspaces"
            value={String(data.activePayingWorkspaces)}
            hint="Active + trialing subscriptions"
          />
          <MetricCard
            title="AI cost / workspace"
            value={
              data.aiCostPerPayingWorkspaceUsd == null
                ? '—'
                : formatUsd(data.aiCostPerPayingWorkspaceUsd)
            }
            hint="Estimated USD AI COGS ÷ paying workspaces"
          />
          <MetricCard
            title="OpEx / workspace"
            value={
              data.opexPerPayingWorkspaceMinor == null
                ? '—'
                : formatMoneyMinor(
                    data.opexPerPayingWorkspaceMinor,
                    data.operatingCostsCurrency,
                  )
            }
            hint="GBP operating costs ÷ paying workspaces"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top workspaces by AI cost</CardTitle>
            <CardDescription>This month, estimated USD</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topAiAccounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No AI usage in this period.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {data.topAiAccounts.map((row) => (
                  <li
                    key={row.accountId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/accounts/${row.accountId}`}
                        className="font-medium hover:underline"
                      >
                        {row.accountName}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {row.creditsUsed.toLocaleString()} credits ·{' '}
                        {row.inputTokens.toLocaleString()} in /{' '}
                        {row.outputTokens.toLocaleString()} out
                      </p>
                    </div>
                    <span className="font-mono text-xs">
                      {formatUsd(row.estimatedCostUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI by feature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.aiByFeature.length === 0 ? (
                <p className="text-muted-foreground text-sm">No usage.</p>
              ) : (
                data.aiByFeature.slice(0, 12).map((row) => (
                  <div
                    key={row.feature}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate font-mono text-xs">
                      {row.feature}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {row.credits} cr · {formatUsd(row.costUsd)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI by model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.aiByModel.length === 0 ? (
                <p className="text-muted-foreground text-sm">No usage.</p>
              ) : (
                data.aiByModel.map((row) => (
                  <div
                    key={row.model}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate font-mono text-xs">
                      {row.model}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {row.credits} cr · {formatUsd(row.costUsd)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operating costs</CardTitle>
            <CardDescription>
              Add this month&apos;s invoices (Vercel, Supabase, domain, email…).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FinancesOperatingCostForm periodMonth={data.periodMonth} />
            {data.operatingCosts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No operating costs logged for {monthKey}.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {data.operatingCosts.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{row.label}</p>
                      <p className="text-muted-foreground text-xs capitalize">
                        {row.category.replace('_', ' ')}
                        {row.notes ? ` · ${row.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {formatMoneyMinor(row.amountMinor, row.currency)}
                      </span>
                      <FinancesDeleteCostButton id={row.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI model rates (USD / MTok)</CardTitle>
            <CardDescription>
              Used to estimate AI COGS from the usage ledger. Update when
              provider pricing changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y rounded-lg border">
              {data.modelRates.map((rate) => (
                <li
                  key={rate.model}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs">{rate.model}</p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {rate.provider}
                    </p>
                  </div>
                  <p className="font-mono text-xs">
                    in ${rate.inputUsdPerMtok} / out ${rate.outputUsdPerMtok}
                  </p>
                </li>
              ))}
            </ul>
            <FinancesModelRatesForm />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

export default AdminGuard(AdminFinancesPage);
