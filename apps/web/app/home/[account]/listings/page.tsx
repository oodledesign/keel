import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { ListingsList } from './_components/listings-list';
import { createListingsService } from './_lib/server/listings.service';

interface ListingsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ office?: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Disposals` };
};

async function ListingsPage({ params, searchParams }: ListingsPageProps) {
  const { account: slug } = await params;
  const { office: officeParam } = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const branches = await loadAccountBranches(accountId);
  const branchIds = new Set(branches.map((branch) => branch.id));
  const initialOfficeId =
    officeParam && branchIds.has(officeParam) ? officeParam : null;

  const [{ data: listings, total }, unassignedCount] = await Promise.all([
    service.listListingsPage({
      accountId,
      page: 1,
      pageSize: 20,
      accountBranchId: initialOfficeId,
    }),
    // Needed as soon as an office chip is selected (before RSC refresh).
    branches.length > 1
      ? service.countUnassignedListings({ accountId })
      : Promise.resolve(0),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Disposals" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <ListingsList
          accountId={accountId}
          accountSlug={slug}
          initialListings={listings}
          initialTotal={total}
          offices={branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
          }))}
          initialOfficeId={initialOfficeId}
          unassignedCount={unassignedCount}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ListingsPage);
