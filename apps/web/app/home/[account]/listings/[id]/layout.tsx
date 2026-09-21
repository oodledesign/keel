import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { isGovUkEpcConfigured } from '~/lib/building-surveyor/epc/env';
import { getWebsiteChannelStatus } from '~/lib/commercial/channel-publish-status';
import { loadWebsiteChannelUrlState } from '~/lib/commercial/listing-website-url-resolve.server';
import { collectRightmoveUrls } from '~/lib/commercial/rightmove-publish-status';
import { withI18n } from '~/lib/i18n/with-i18n';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { ListingDetailShell } from '../_components/listing-detail-shell';
import { createListingsService } from '../_lib/server/listings.service';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ account: string; id: string }>;
}

async function ListingDetailLayout({ children, params }: LayoutProps) {
  const { account: slug, id: listingId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const canEditDisposals = workspace.canMutateCommercial;
  const client = getSupabaseServerClient();
  const service = createListingsService(client);
  const listing = await service.getListing(listingId, accountId);

  if (!listing) {
    notFound();
  }

  const [publications, mediaRows] = await Promise.all([
    service.listPublicationsForListing(listingId),
    client
      .from('commercial_listing_media')
      .select('created_at')
      .eq('listing_id', listingId)
      .eq('account_id', accountId)
      .eq('is_private', false),
  ]);
  const rightmoveUrls = publications
    .filter((publication) => publication.portal === 'rightmove')
    .flatMap((publication) =>
      collectRightmoveUrls({ externalUrl: publication.externalUrl }),
    );
  const websiteIsLive =
    getWebsiteChannelStatus({
      listing: {
        status: listing.status,
        externalId: listing.externalId,
        websiteUrl: listing.websiteUrl,
      },
      publications,
    }).state === 'live';
  const websiteUrlState = await loadWebsiteChannelUrlState({
    accountId,
    listingId,
    listing: {
      externalId: listing.externalId,
      addressLine1: listing.addressLine1,
      addressLine2: listing.addressLine2,
      town: listing.town,
      postcode: listing.postcode,
      name: listing.name,
      websiteUrl: listing.websiteUrl,
    },
    publications,
    websiteIsLive,
  });

  return (
    <>
      <div className="hidden px-4 pt-4 pb-1 lg:block lg:px-6">
        <Link
          href={pathsConfig.app.accountListings.replace('[account]', slug)}
          className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
        >
          ← Back to disposals
        </Link>
      </div>
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 pt-3 pb-6 lg:px-6">
        <ListingDetailShell
          listing={listing}
          accountSlug={slug}
          accountId={accountId}
          canEditDisposals={canEditDisposals}
          epcConfigured={isGovUkEpcConfigured()}
          rightmoveUrls={rightmoveUrls}
          publications={publications}
          mediaCreatedAt={(mediaRows.data ?? []).map((row) => row.created_at)}
          websitePublicPageUrl={websiteUrlState.publicPageUrl}
          websiteUrlHealth={websiteUrlState.health}
        >
          {children}
        </ListingDetailShell>
      </PageBody>
    </>
  );
}

export default withI18n(ListingDetailLayout);
