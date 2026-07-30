import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { createListingsService } from '../listings/_lib/server/listings.service';
import { CommercialPublishingSettings } from './_components/commercial-publishing-settings';
import { loadCommercialPublishingSettings } from './_lib/server/commercial-publishing.loader';

interface CommercialPublishingPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Website & portals',
});

async function CommercialPublishingPage({
  params,
}: CommercialPublishingPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [settings, listings] = await Promise.all([
    loadCommercialPublishingSettings(accountId),
    createListingsService(client).listListings(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Website & portals"
        description="Property Hive website sync and Rightmove / EACH portal credentials."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <CommercialPublishingSettings
          accountId={accountId}
          initialSettings={settings}
          listings={listings}
        />
      </PageBody>
    </>
  );
}

export default withI18n(CommercialPublishingPage);
