'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';

import Link from 'next/link';

import { Copy, FileText, Link2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import { getMarketingReadiness } from '~/lib/commercial/marketing-readiness';
import { workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { setBrochureShare } from '../_lib/server/server-actions';
import { useDisposalAccess } from './disposal-access-context';
import { ListingBrochureDownload } from './listing-brochure-download';
import { ListingLinkedInCard } from './listing-linkedin-card';
import { ListingPublishingChannels } from './listing-publishing-channels';
import { MarketingReadinessCard } from './marketing-readiness-card';

function useBrowserOrigin() {
  return useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => '',
  );
}

export function ListingPublishingSection({
  listing: initial,
  publications,
  accountId,
  accountSlug,
  media = [],
  linkedInConnection = null,
  linkedInPost = null,
  linkedInLastPosted = null,
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  accountSlug: string;
  media?: CommercialListingMedia[];
  linkedInConnection?:
    | import('~/lib/commercial/linkedin-publishing/types').LinkedInOrgConnectionPublic
    | null;
  linkedInPost?:
    | import('~/lib/commercial/linkedin-publishing/types').ListingLinkedInPostPublic
    | null;
  linkedInLastPosted?:
    | import('~/lib/commercial/linkedin-publishing/types').ListingLinkedInPostPublic
    | null;
}) {
  const { canEditDisposals } = useDisposalAccess();
  const [listing, setListing] = useState(initial);
  const [brochurePending, startBrochure] = useTransition();
  const [brochureCopied, setBrochureCopied] = useState(false);
  const origin = useBrowserOrigin();

  const listingBase = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id);
  const brochureEditorHref = `${listingBase}/brochure`;
  const workspacePublishingHref =
    pathsConfig.app.accountCommercialPublishing.replace(
      '[account]',
      accountSlug,
    );

  const brochurePath = listing.brochureShareToken
    ? pathsConfig.app.brochureShare.replace(
        '[token]',
        listing.brochureShareToken,
      )
    : null;
  const brochureUrl =
    brochurePath && origin ? `${origin}${brochurePath}` : brochurePath;

  return (
    <div id="publishing" className="space-y-4">
      <section id="marketing-readiness" className="scroll-mt-36">
        <MarketingReadinessCard
          listing={listing}
          accountSlug={accountSlug}
          media={media}
          publications={publications}
          readiness={getMarketingReadiness({
            listing,
            media,
            publications,
          })}
        />
      </section>

      <ListingPublishingChannels
        listing={listing}
        publications={publications}
        accountId={accountId}
        media={media}
      />

      <Card id="brochure" className={`${workspacePanelCard} scroll-mt-36`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
            <FileText className="h-4 w-4" />
            Brochure
          </CardTitle>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            Share an online slideshow or generate a PDF. Edit pages in the
            brochure editor — this tab does not duplicate that layout.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Online brochure share
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Public Ozer slideshow link — not a portal listing.
              </p>
            </div>
            <Switch
              checked={listing.brochureShareEnabled}
              disabled={brochurePending || !canEditDisposals}
              onCheckedChange={(enabled) => {
                if (!canEditDisposals) return;
                startBrochure(async () => {
                  try {
                    const updated = await setBrochureShare({
                      listingId: listing.id,
                      accountId,
                      enabled,
                    });
                    setListing(updated);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not update brochure share',
                    );
                  }
                });
              }}
            />
          </div>
          {listing.brochureShareEnabled && brochurePath ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs text-[var(--workspace-shell-text)]/70">
                {brochureUrl ?? brochurePath}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!brochureUrl) return;
                  await navigator.clipboard.writeText(brochureUrl);
                  setBrochureCopied(true);
                  setTimeout(() => setBrochureCopied(false), 2000);
                }}
                className="shrink-0 gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                {brochureCopied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="shrink-0"
              >
                <a href={brochurePath} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
            </div>
          ) : null}

          <div className="border-t border-[color:var(--workspace-shell-border)] pt-3">
            <p className="mb-1 text-sm font-medium text-[var(--workspace-shell-text)]">
              PDF brochure
            </p>
            <p className="mb-2 text-xs text-[var(--workspace-shell-text-muted)]">
              Preview, publish to Media for portals, or upload an external PDF.
            </p>
            <ListingBrochureDownload
              listingId={listing.id}
              accountId={accountId}
              accountSlug={accountSlug}
              listingName={listing.name}
              listingAddress={[listing.town, listing.postcode]
                .filter(Boolean)
                .join(', ')}
              coverUrl={listing.coverUrl}
              defaultShowRent={!listing.hideRentFromMarketing}
              defaultShowPrice={!listing.hidePriceFromMarketing}
              compact
            />
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href={brochureEditorHref}>Open brochure editor</Link>
          </Button>
        </CardContent>
      </Card>

      <ListingLinkedInCard
        listing={listing}
        accountId={accountId}
        accountSlug={accountSlug}
        media={media}
        publications={publications}
        connection={linkedInConnection}
        initialPost={linkedInPost}
        lastPosted={linkedInLastPosted}
      />

      <Card className={workspacePanelCard}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
              <Link2 className="h-4 w-4" />
              Workspace publishing settings
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Feed URLs, Property Hive credentials, and LinkedIn connection.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={workspacePublishingHref}>Open settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
