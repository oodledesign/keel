import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminUsersTable } from './_components/admin-users-table';
import { loadAdminUsersPage } from './_lib/load-admin-users';

export const metadata = { title: 'Users' };

interface AdminUsersPageProps {
  searchParams: Promise<{ page?: string; query?: string }>;
}

async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, parseInt(params.page, 10)) : 1;
  const data = await loadAdminUsersPage(page, params.query);

  return (
    <>
      <PageHeader description={<AppBreadcrumbs />} title="Users" />
      <PageBody>
        <AdminUsersTable
          users={data.users}
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          query={params.query ?? ''}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminUsersPage);
