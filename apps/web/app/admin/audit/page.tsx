import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminAuditTable } from './_components/admin-audit-table';
import { loadAdminAuditLogPage } from './_lib/load-admin-audit-log';

export const metadata = { title: 'Audit log' };

interface AdminAuditPageProps {
  searchParams: Promise<{ page?: string }>;
}

async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, parseInt(params.page, 10)) : 1;
  const data = await loadAdminAuditLogPage({ page, pageSize: 25 });

  return (
    <>
      <PageHeader
        title="Audit log"
        description={
          <AppBreadcrumbs
            values={{
              audit: 'Audit log',
            }}
          />
        }
      />
      <PageBody>
        <AdminAuditTable
          rows={data.rows}
          page={data.page}
          pageSize={data.pageSize}
          pageCount={data.pageCount}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminAuditPage);
