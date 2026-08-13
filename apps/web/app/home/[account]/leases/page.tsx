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

export const generateMetadata = async () => ({ title: 'Sales & lettings' });

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
  const [leases, listings, completedDisposals] = await Promise.all([
    createLeasesService(client).listLeases(accountId),
    createListingsService(client).listListings(accountId),
    createListingsService(client).listCompletedDisposals(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Sales & lettings"
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <LeasesList
          accountId={accountId}
          accountSlug={slug}
          initialLeases={leases}
          listings={listings}
          completedDisposals={completedDisposals}
        />
      </PageBody>
    </>
  );
}

export default withI18n(LeasesPage);
