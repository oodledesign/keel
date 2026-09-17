import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminRightmoveSyncMonitor } from './_components/admin-rightmove-sync-monitor';
import { loadAdminRightmoveSync } from './_lib/load-admin-rightmove-sync';

export const metadata = { title: 'Rightmove sync' };

async function AdminRightmovePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    account?: string;
    query?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const filter = params.status ?? 'all';
  const accountId = params.account?.trim() ?? '';
  const query = params.query?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 40;
  const data = await loadAdminRightmoveSync({
    overviewStatus: filter as
      | 'all'
      | 'pending'
      | 'failed'
      | 'unsynced'
      | 'removed'
      | 'draft'
      | 'not_pushed'
      | 'pushed',
    accountId,
    query,
    page,
    pageSize,
  });

  return (
    <>
      <PageHeader
        title="Rightmove sync"
        description={
          <AppBreadcrumbs
            values={{
              rightmove: 'Rightmove sync',
            }}
          />
        }
      />
      <PageBody>
        <p className="text-muted-foreground mb-6 text-sm">
          Cross-workspace view of Rightmove publications, pending 15-minute
          flushes, and recent bulk jobs. Read-only — first-time publish still
          happens from a disposal or Push all.
        </p>
        <AdminRightmoveSyncMonitor
          listings={data.listings}
          total={data.total}
          statusCounts={data.statusCounts}
          workspaces={data.workspaces}
          jobs={data.jobs}
          flushRuns={data.flushRuns}
          currentFilter={filter}
          currentAccountId={accountId}
          currentQuery={query}
          page={page}
          pageSize={pageSize}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminRightmovePage);
