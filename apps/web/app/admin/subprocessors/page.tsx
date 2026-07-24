import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';

import { AdminSubprocessorsList } from './_components/admin-subprocessors-list';

export const metadata = { title: 'Sub-processors' };

function AdminSubprocessorsPage() {
  return (
    <>
      <PageHeader
        title="Sub-processors & services"
        description={
          <AppBreadcrumbs
            values={{
              subprocessors: 'Sub-processors',
            }}
          />
        }
      />

      <PageBody>
        <AdminSubprocessorsList />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminSubprocessorsPage);
