import { AdminGuard } from '@kit/admin/components/admin-guard';
import { PageBody, PageHeader } from '@kit/ui/page';

import { OzerBrandingGuide } from '~/admin/_components/ozer-branding-guide';

function AdminBrandingPage() {
  return (
    <>
      <PageHeader
        title="Branding"
        description="Ozer design tokens, colours, typography, and logo assets."
      />

      <PageBody>
        <OzerBrandingGuide />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminBrandingPage);
