import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { ListingsList } from './_components/listings-list';
import { createListingsService } from './_lib/server/listings.service';

interface ListingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Disposals` };
};

async function ListingsPage({ params }: ListingsPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const { data: listings, total } = await service.listListingsPage({
    accountId,
    page: 1,
    pageSize: 20,
  });

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
      <ListingsList
        accountId={accountId}
        accountSlug={slug}
        initialListings={listings}
        initialTotal={total}
      />
    </PageBody>
  );
}

export default withI18n(ListingsPage);
