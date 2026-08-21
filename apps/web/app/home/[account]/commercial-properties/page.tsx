import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { CommercialPropertiesList } from './_components/commercial-properties-list';
import { createCommercialPropertiesService } from './_lib/server/commercial-properties.service';

interface PageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Properties' });

async function CommercialPropertiesPage({ params }: PageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const properties = await createCommercialPropertiesService(
    getSupabaseServerClient(),
  ).listProperties({ accountId });

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Properties" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <CommercialPropertiesList
          accountId={accountId}
          accountSlug={slug}
          initialProperties={properties}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CommercialPropertiesPage);
