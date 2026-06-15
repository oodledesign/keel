import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { KeelBrandingGuide } from '~/admin/_components/keel-branding-guide';

function AdminBrandingPage() {
  return (
    <>
      <PageHeader
        title="Branding"
        description="Keel design tokens, colours, typography, and logo assets."
      />

      <PageBody>
        <KeelBrandingGuide />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminBrandingPage);
