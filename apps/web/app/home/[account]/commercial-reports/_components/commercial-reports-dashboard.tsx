'use client';

import {
  BarChart3,
  Calendar,
  Clock,
  Inbox,
  Tag,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent } from '@kit/ui/card';

import {
  COMMERCIAL_PIPELINE_BOARD_STAGES,
  type CommercialPipelineStage,
} from '~/lib/commercial/commercial-constants';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialReportsMetrics } from '../_lib/server/commercial-reports.service';

interface CommercialReportsDashboardProps {
  metrics: CommercialReportsMetrics;
}

function KpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className={workspacePanelCard}>
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
            {value}
          </p>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommercialReportsDashboard({
  metrics,
}: CommercialReportsDashboardProps) {
  const pipelineTotal = COMMERCIAL_PIPELINE_BOARD_STAGES.reduce(
    (sum, { key }) =>
      sum + (metrics.pipelineByStage[key as CommercialPipelineStage] ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          Overview
        </h2>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Key metrics across listings, enquiries, and pipeline.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={TrendingUp}
          label="Stock on market"
          value={metrics.stockOnMarket}
        />
        <KpiCard icon={Tag} label="Under offer" value={metrics.underOffer} />
        <KpiCard
          icon={Inbox}
          label="Unactioned enquiries"
          value={metrics.unactionedEnquiries}
        />
        <KpiCard
          icon={Calendar}
          label="Upcoming viewings"
          value={metrics.upcomingViewings}
        />
        <KpiCard
          icon={Clock}
          label="Avg days on market"
          value={
            metrics.avgDaysOnMarket != null
              ? `${metrics.avgDaysOnMarket}d`
              : '—'
          }
        />
        <KpiCard
          icon={BarChart3}
          label="Pipeline deals"
          value={pipelineTotal}
        />
      </div>

      <div>
        <h3 className="mb-4 text-base font-semibold text-[var(--workspace-shell-text)]">
          Pipeline by stage
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {COMMERCIAL_PIPELINE_BOARD_STAGES.map(({ key, label }) => (
            <Card key={key} className={workspacePanelCard}>
              <CardContent className="flex items-center justify-between p-4">
                <span className="text-sm text-[var(--workspace-shell-text)]/70">
                  {label}
                </span>
                <span className="text-lg font-semibold text-[var(--workspace-shell-text)] tabular-nums">
                  {metrics.pipelineByStage[key as CommercialPipelineStage] ?? 0}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
