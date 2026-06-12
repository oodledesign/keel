import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminUsersTable } from './_components/admin-users-table';
import { loadAdminUsersPage } from './_lib/load-admin-users';

export const metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

interface AdminUsersPageProps {
  searchParams: Promise<{ page?: string; query?: string }>;
}

async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const data = await loadAdminUsersPage(params.page, params.query);

  return (
    <>
      <PageHeader
        description={
          <AppBreadcrumbs
            values={{
              users: 'Users',
            }}
          />
        }
        title="Users"
      />
      <PageBody>
        {data.ok ? (
          <AdminUsersTable
            users={data.users}
            page={data.page}
            perPage={data.perPage}
            total={data.total}
            query={params.query ?? ''}
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Could not load users</AlertTitle>
            <AlertDescription>{data.error}</AlertDescription>
          </Alert>
        )}
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminUsersPage);
