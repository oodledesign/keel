import Link from 'next/link';

import { AlertCircle, CheckCircle2, Clock, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { countOpenChangeRequestsByStaff } from '~/lib/signatures/change-requests';

import { ModuleDataSection } from '../../_components/module-data-section';
import { SignaturesStaffSearch } from '../_components/signatures-staff-search';
import { SignaturesStaffTable } from '../_components/signatures-staff-table';
import {
  type StaffListFilters,
  loadSignaturesDashboard,
  loadSignaturesWorkspace,
} from '../_lib/server/signatures-data';
import {
  SIGNATURES_DASHBOARD_STAFF_PAGE_SIZE,
  parseStaffListPage,
} from '../_lib/signatures-staff-pagination';

type SignaturesDashboardPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
};

const cards = [
  { key: 'total', label: 'Total Staff', icon: Users, tone: 'text-[#39AEB3]' },
  {
    key: 'pushed',
    label: 'Pushed',
    icon: CheckCircle2,
    tone: 'text-[var(--ozer-accent)]',
  },
  { key: 'pending', label: 'Pending', icon: Clock, tone: 'text-[#F2C94C]' },
  { key: 'errors', label: 'Errors', icon: AlertCircle, tone: 'text-[#E85D75]' },
] as const;

export default async function SignaturesDashboardPage({
  params,
  searchParams,
}: SignaturesDashboardPageProps) {
  const { account } = await params;
  const query = await searchParams;
  const filters: StaffListFilters = {
    search: query.q ?? null,
  };
  const page = parseStaffListPage(query.page);

  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [{ summary, staff, totalCount, pageSize }, openRequestCounts] =
    await Promise.all([
      loadSignaturesDashboard(accountId, {
        ...filters,
        page,
        pageSize: SIGNATURES_DASHBOARD_STAFF_PAGE_SIZE,
      }),
      countOpenChangeRequestsByStaff(accountId),
    ]);

  const staffListPath = pathsConfig.app.accountSignaturesStaff.replace(
    '[account]',
    account,
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.key}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.tone}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">
                  {summary[card.key]}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ModuleDataSection
        title="Staff signatures"
        description="Search staff, browse pages, or open the full staff list for bulk editing."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <SignaturesStaffSearch placeholder="Search staff on dashboard…" />
            </div>
            <Link
              href={staffListPath}
              className="text-sm font-medium text-[#39AEB3] hover:underline"
            >
              Open full staff list
            </Link>
          </div>
          <SignaturesStaffTable
            accountId={accountId}
            accountSlug={account}
            staff={staff}
            openRequestCounts={Object.fromEntries(openRequestCounts)}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            paginationPageSizes={[SIGNATURES_DASHBOARD_STAFF_PAGE_SIZE]}
            emptyMessage={
              totalCount === 0
                ? 'No staff match your search.'
                : 'No staff on this page.'
            }
          />
        </div>
      </ModuleDataSection>
    </div>
  );
}
