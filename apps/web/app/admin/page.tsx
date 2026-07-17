import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { OzerAdminDashboard } from '~/admin/_components/ozer-admin-dashboard';

function AdminPage() {
  return (
    <>
      <PageHeader description={`Super Admin`} />

      <PageBody>
        <OzerAdminDashboard />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminPage);
