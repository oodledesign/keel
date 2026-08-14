import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isWorkModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { CommercialReportsDashboard } from './_components/commercial-reports-dashboard';
import type {
  InsightsPeriod,
  InsightsTab,
} from './_lib/commercial-reports.types';
import { createCommercialReportsService } from './_lib/server/commercial-reports.service';

interface CommercialReportsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    period?: string;
    type?: string;
    tab?: string;
    txn?: string;
  }>;
}

export const generateMetadata = async () => ({ title: 'Insights' });

function parsePeriod(value: string | undefined): InsightsPeriod {
  if (value === '7d' || value === '30d' || value === 'quarter') return value;
  return 'quarter';
}

function parseDisposalType(
  value: string | undefined,
): 'to_let' | 'for_sale' | 'all' {
  if (value === 'for_sale' || value === 'all' || value === 'to_let') {
    return value;
  }
  return 'to_let';
}

function parseTab(value: string | undefined): InsightsTab {
  if (
    value === 'viewings' ||
    value === 'requirements' ||
    value === 'inbound' ||
    value === 'sources' ||
    value === 'transactions'
  ) {
    return value;
  }
  return 'disposals';
}

function parseTxnKind(value: string | undefined): 'lettings' | 'sales' {
  return value === 'sales' ? 'sales' : 'lettings';
}

async function CommercialReportsPage({
  params,
  searchParams,
}: CommercialReportsPageProps) {
  const { account: slug } = await params;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'reports')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const period = parsePeriod(query.period);
  const disposalType = parseDisposalType(query.type);
  const tab = parseTab(query.tab);
  const txnKind = parseTxnKind(query.txn);
  const service = createCommercialReportsService(getSupabaseServerClient());

  const [
    overview,
    disposals,
    viewings,
    inbound,
    requirements,
    sources,
    transactions,
  ] = await Promise.all([
    service.getMetrics(accountId),
    service.getDisposalInsights({ accountId, period, disposalType }),
    service.getViewingInsights({ accountId, period }),
    service.getInboundInsights({ accountId, period }),
    service.getRequirementInsights({ accountId, period }),
    service.getSourceInsights({ accountId, period }),
    service.getTransactionInsights({ accountId, period, kind: txnKind }),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Insights" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <Suspense fallback={null}>
          <CommercialReportsDashboard
            overview={overview}
            disposals={disposals}
            viewings={viewings}
            inbound={inbound}
            requirements={requirements}
            sources={sources}
            transactions={transactions}
            activeTab={tab}
          />
        </Suspense>
      </PageBody>
    </>
  );
}

export default withI18n(CommercialReportsPage);
