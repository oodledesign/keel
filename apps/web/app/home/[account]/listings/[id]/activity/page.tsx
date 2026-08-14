import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { listListingEventsOrSeed } from '~/lib/commercial/listing-events';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { ListingActivityTimeline } from '../../_components/listing-activity-timeline';

interface PageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => ({ title: 'Activity' });

async function ListingActivityPage({ params }: PageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const events = await listListingEventsOrSeed(client, {
    accountId,
    listingId,
    limit: 150,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          Activity
        </h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Recent changes on this disposal
        </p>
      </div>
      <ListingActivityTimeline events={events} />
    </div>
  );
}

export default withI18n(ListingActivityPage);
