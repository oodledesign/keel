import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { buildListingFeedChannels } from '~/lib/commercial/listing-feed-channels';
import { listingTabHref } from '~/lib/commercial/listing-routes';
import type { WebsiteUrlHealth } from '~/lib/commercial/listing-website-url-health';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialListing,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { ChannelStatusPill } from './listing-channel-status-pill';

export function ListingOverviewChannelStatus({
  listing,
  accountSlug,
  publications,
  mediaCreatedAt = [],
  websitePublicPageUrl = null,
  websiteUrlHealth = null,
}: {
  listing: CommercialListing;
  accountSlug: string;
  publications: CommercialPortalPublication[];
  mediaCreatedAt?: Array<string | null | undefined>;
  websitePublicPageUrl?: string | null;
  websiteUrlHealth?: WebsiteUrlHealth | null;
}) {
  const publishingHref = listingTabHref(accountSlug, listing.id, 'publishing');
  const channels = buildListingFeedChannels({
    listing,
    accountSlug,
    publications,
    mediaCreatedAt,
    websitePublicPageUrl,
    websiteUrlHealth,
  });

  return (
    <Card className={workspacePanelCard} data-test="overview-channel-status">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Channels
        </CardTitle>
        {publishingHref ? (
          <Link
            href={publishingHref}
            className="text-xs text-[var(--workspace-shell-text)]/50 hover:text-[var(--workspace-shell-text)] hover:underline"
          >
            Manage
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <li key={channel.key}>
              <Link
                href={channel.href}
                data-test={`overview-channel-${channel.key}`}
                className="inline-flex"
              >
                <ChannelStatusPill
                  label={channel.label}
                  status={channel.status}
                />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
