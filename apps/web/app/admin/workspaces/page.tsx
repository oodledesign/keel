import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminWorkspacesTable } from './_components/admin-workspaces-table';
import { loadAdminWorkspacesPage } from './_lib/load-admin-workspaces';

export const metadata = { title: 'Workspaces' };

interface AdminWorkspacesPageProps {
  searchParams: Promise<{ page?: string; query?: string }>;
}

async function AdminWorkspacesPage({ searchParams }: AdminWorkspacesPageProps) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, parseInt(params.page, 10)) : 1;
  const data = await loadAdminWorkspacesPage({
    page,
    pageSize: 25,
    query: params.query,
  });

  return (
    <>
      <PageHeader
        title="Workspaces"
        description={
          <AppBreadcrumbs
            values={{
              workspaces: 'Workspaces',
            }}
          />
        }
      />
      <PageBody>
        <AdminWorkspacesTable
          rows={data.rows}
          page={data.page}
          pageSize={data.pageSize}
          pageCount={data.pageCount}
          query={params.query ?? ''}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminWorkspacesPage);
