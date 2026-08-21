'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ExternalLink, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import { isEachFeedIncluded } from '~/lib/commercial/each-feed-inclusion';
import { getMarketingReadiness } from '~/lib/commercial/marketing-readiness';
import { workspacePanelCard } from '~/lib/workspace-ui';

import { testPublishListingAction } from '../../commercial-publishing/_lib/server/server-actions';
import type {
  CommercialListing,
  CommercialListingMedia,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { ListingEachFeedToggle } from './listing-each-feed-toggle';
import { confirmPublishIfNotReady } from './marketing-readiness-card';

function formatSyncAt(iso: string | null) {
  if (!iso) return 'Never synced';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: string) {
  if (status === 'published') return 'text-emerald-600';
  if (status === 'error') return 'text-rose-500';
  if (status === 'unpublished') return 'text-[var(--workspace-shell-text)]/45';
  return 'text-[var(--workspace-shell-text)]/70';
}

const REPUBLISHABLE = new Set(['property_hive', 'rightmove', 'each']);

export function ListingPortalSyncCard({
  listing,
  publications,
  accountId,
  media = [],
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  media?: CommercialListingMedia[];
}) {
  const router = useRouter();
  const [pendingPortal, setPendingPortal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const otherPublications = publications.filter((pub) => pub.portal !== 'each');
  const eachPublication = publications.find((pub) => pub.portal === 'each');

  const republish = (portal: 'property_hive' | 'rightmove' | 'each') => {
    const readiness = getMarketingReadiness({ listing, media, publications });
    if (!confirmPublishIfNotReady(readiness)) return;

    setPendingPortal(portal);
    startTransition(async () => {
      try {
        const result = await testPublishListingAction({
          accountId,
          listingId: listing.id,
          portal,
        });
        if (
          result &&
          typeof result === 'object' &&
          'ok' in result &&
          result.ok === false
        ) {
          toast.error(
            'error' in result && typeof result.error === 'string'
              ? result.error
              : 'Publish failed',
          );
        } else {
          toast.success(`Republished to ${portal.replace(/_/g, ' ')}`);
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not republish',
        );
      } finally {
        setPendingPortal(null);
      }
    });
  };

  return (
    <Card
      className={workspacePanelCard}
      data-tour="sop-listing-publish"
    >
      <CardHeader>
        <CardTitle className="text-base text-[var(--workspace-shell-text)]">
          Portal publishing
        </CardTitle>
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          Brochure PDFs on portals come from files uploaded under Media →
          Brochure. Online brochure share and PDF download do not publish here.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ListingEachFeedToggle
          accountId={accountId}
          listingId={listing.id}
          initialEnabled={isEachFeedIncluded(publications)}
          onBeforeEnable={() =>
            confirmPublishIfNotReady(
              getMarketingReadiness({ listing, media, publications }),
            )
          }
        />

        {eachPublication ? (
          <PublicationRow
            pub={eachPublication}
            pending={pending && pendingPortal === 'each'}
            onRepublish={() => republish('each')}
          />
        ) : null}

        {otherPublications.length === 0 && !eachPublication ? (
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            Rightmove and Property Hive status will appear here after you
            publish or sync from Commercial publishing.
          </p>
        ) : (
          <ul className="space-y-3">
            {otherPublications.map((pub) => (
              <PublicationRow
                key={pub.id}
                pub={pub}
                pending={pending && pendingPortal === pub.portal}
                onRepublish={
                  REPUBLISHABLE.has(pub.portal)
                    ? () =>
                        republish(
                          pub.portal as 'property_hive' | 'rightmove' | 'each',
                        )
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PublicationRow({
  pub,
  pending,
  onRepublish,
}: {
  pub: CommercialPortalPublication;
  pending?: boolean;
  onRepublish?: () => void;
}) {
  return (
    <li className="rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)] capitalize">
            {pub.portal.replace(/_/g, ' ')}
          </p>
          <p
            className={`text-xs font-medium capitalize ${statusClass(pub.status)}`}
          >
            {pub.status}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text)]/45">
            Last sync: {formatSyncAt(pub.lastSyncAt)}
          </p>
          {pub.lastError ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-rose-500">
              {pub.lastError}
            </p>
          ) : null}
          {pub.externalUrl ? (
            <Link
              href={pub.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--ozer-accent)] hover:underline"
            >
              Open listing <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null}
        </div>
        {onRepublish ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="shrink-0 border-[color:var(--workspace-shell-border)]"
            onClick={onRepublish}
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`}
            />
            Republish
          </Button>
        ) : null}
      </div>
    </li>
  );
}
