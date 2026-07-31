import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingMarketingSection } from '../../_components/listing-detail-sections';
import { createListingsService } from '../../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingMarketingPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const listing = await createListingsService(
    getSupabaseServerClient(),
  ).getListing(listingId, accountId);

  if (!listing) return null;

  return <ListingMarketingSection listing={listing} accountId={accountId} />;
}

export default withI18n(ListingMarketingPage);
