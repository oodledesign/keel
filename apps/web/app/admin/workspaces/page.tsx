import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Button } from '@kit/ui/button';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminCreateWorkspaceDialog } from './_components/admin-create-workspace-dialog';
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
      >
        <AdminCreateWorkspaceDialog>
          <Button>Create workspace</Button>
        </AdminCreateWorkspaceDialog>
      </PageHeader>
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
