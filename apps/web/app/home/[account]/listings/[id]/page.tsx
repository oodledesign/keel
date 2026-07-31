import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { ListingOverviewSection } from '../_components/listing-detail-sections';
import { createListingsService } from '../_lib/server/listings.service';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

async function ListingOverviewPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const service = createListingsService(client);
  const listing = await service.getListing(listingId, accountId);

  if (!listing) return null;

  const [interestSummary, viewingsResult] = await Promise.all([
    service.getInterestSummary(listingId),
    client
      .from('commercial_viewings')
      .select('status')
      .eq('listing_id', listingId)
      .eq('account_id', accountId),
  ]);

  const viewingRows = viewingsResult.data ?? [];
  const upcomingViewings = viewingRows.filter(
    (row) => row.status === 'upcoming',
  ).length;
  const awaitingFeedback = viewingRows.filter(
    (row) => row.status === 'awaiting_feedback',
  ).length;

  return (
    <ListingOverviewSection
      listing={listing}
      accountId={accountId}
      interestSummary={{
        ...interestSummary,
        upcomingViewings,
        awaitingFeedback,
      }}
    />
  );
}

export default withI18n(ListingOverviewPage);
