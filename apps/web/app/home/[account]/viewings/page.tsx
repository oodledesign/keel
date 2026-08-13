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
import { ViewingsList } from './_components/viewings-list';
import { createViewingsService } from './_lib/server/viewings.service';

interface ViewingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Viewings' });

async function ViewingsPage({ params }: ViewingsPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [viewings, listings] = await Promise.all([
    createViewingsService(client).listViewings(accountId),
    createListingsService(client).listListings(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Viewings"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <ViewingsList
          accountId={accountId}
          initialViewings={viewings}
          listings={listings}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ViewingsPage);
