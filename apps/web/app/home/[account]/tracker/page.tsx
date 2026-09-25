import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { TrackerWorkspace } from './_components/tracker-workspace';
import { loadTrackerWorkspace } from './_lib/server/tracker.loader';

interface TrackerPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Tracker' });

async function TrackerPage({ params }: TrackerPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const data = await loadTrackerWorkspace(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Tracker"
        description="Competitor industrial, retail and development stock"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <TrackerWorkspace
          accountId={accountId}
          accountSlug={slug}
          initialListings={data.listings}
          initialWatches={data.watches}
          initialNotifications={data.notifications}
        />
      </PageBody>
    </>
  );
}

export default withI18n(TrackerPage);
