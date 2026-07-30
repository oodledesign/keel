import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { ListingDetailContent } from '../_components/listing-detail-content';
import { createListingsService } from '../_lib/server/listings.service';

interface ListingDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Listing` };
};

async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const service = createListingsService(getSupabaseServerClient());
  const listing = await service.getListing(listingId, accountId);

  if (!listing) {
    notFound();
  }

  const [units, enquiries, publications, mediaRows] = await Promise.all([
    service.listUnits(listingId),
    service.listEnquiriesForListing(listingId),
    service.listPublicationsForListing(listingId),
    service.listMedia(listingId),
  ]);
  const media = await service.withSignedMediaUrls(mediaRows);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Listing"
        description={
          <Link
            href={pathsConfig.app.accountListings.replace('[account]', slug)}
            className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
          >
            ← Back to listings
          </Link>
        }
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <ListingDetailContent
          listing={listing}
          units={units}
          media={media}
          enquiries={enquiries}
          publications={publications}
          accountId={accountId}
          accountSlug={slug}
        />
      </PageBody>
    </>
  );
}

export default withI18n(ListingDetailPage);
