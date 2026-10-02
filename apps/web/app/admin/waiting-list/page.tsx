import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminWaitlistTable } from './_components/admin-waitlist-table';
import { loadAdminWaitlistPage } from './_lib/load-admin-waitlist';

export const metadata = { title: 'Waiting List' };
export const dynamic = 'force-dynamic';

interface AdminWaitlistPageProps {
  searchParams: Promise<{ page?: string; query?: string }>;
}

async function AdminWaitlistPage({ searchParams }: AdminWaitlistPageProps) {
  const params = await searchParams;
  const data = await loadAdminWaitlistPage(params.page, params.query);

  return (
    <>
      <PageHeader
        description={
          <AppBreadcrumbs
            values={{
              'waiting-list': 'Waiting List',
            }}
          />
        }
        title={`Waiting List (${data.total})`}
      />
      <PageBody className="space-y-6">
        <AdminWaitlistTable
          leads={data.leads}
          page={data.page}
          perPage={data.perPage}
          total={data.total}
          query={params.query ?? ''}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminWaitlistPage);
