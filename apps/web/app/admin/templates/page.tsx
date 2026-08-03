import { AdminGuard } from '@kit/admin/components/admin-guard';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody, PageHeader } from '@kit/ui/page';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { mapSystemTemplate } from '~/lib/content-templates/map-rows';

import { AdminTemplatesClient } from './_components/admin-templates-client';

export const metadata = { title: 'Content templates' };

async function AdminTemplatesPage() {
  await requireSuperAdmin();
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('content_templates')
    .select('*')
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const templates = (data ?? []).map((row) =>
    mapSystemTemplate(row as Record<string, unknown>),
  );

  return (
    <>
      <PageHeader
        title="Content templates"
        description="System defaults for proposals, send emails, and Gmail reply presets. Workspaces and users can fork these."
      />
      <PageBody>
        <AdminTemplatesClient initialTemplates={templates} />
      </PageBody>
    </>
  );
}

export default AdminGuard(AdminTemplatesPage);
