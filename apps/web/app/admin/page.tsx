import { KeelAdminDashboard } from '~/admin/_components/keel-admin-dashboard';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

function AdminPage() {
  return (
    <>
      <PageHeader description={`Super Admin`} />

      <PageBody>
        <KeelAdminDashboard />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminPage);
