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
import { LeasesList } from './_components/leases-list';
import { createLeasesService } from './_lib/server/leases.service';

interface LeasesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Sales register' });

async function LeasesPage({ params }: LeasesPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [leases, listings] = await Promise.all([
    createLeasesService(client).listLeases(accountId),
    createListingsService(client).listListings(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Sales register"
        description="Completed lettings and lease records for the agency."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <LeasesList
          accountId={accountId}
          initialLeases={leases}
          listings={listings}
        />
      </PageBody>
    </>
  );
}

export default withI18n(LeasesPage);
