'use client';

import { MapPin } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';

function buildMapQuery(listing: CommercialListing) {
  if (listing.latitude != null && listing.longitude != null) {
    return `${listing.latitude},${listing.longitude}`;
  }

  return [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.county,
    listing.postcode,
    listing.country,
  ]
    .filter(Boolean)
    .join(', ');
}

export function ListingMapCard({ listing }: { listing: CommercialListing }) {
  const query = buildMapQuery(listing);
  const hasLocation =
    Boolean(query) &&
    (listing.latitude != null ||
      Boolean(listing.postcode) ||
      Boolean(listing.addressLine1));

  const embedSrc = hasLocation
    ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`
    : null;

  return (
    <Card className={workspacePanelCard}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
          <MapPin className="h-4 w-4" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent>
        {embedSrc ? (
          <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
            <iframe
              title="Listing map"
              src={embedSrc}
              className="h-64 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            Add an address or latitude/longitude on Edit to show a map.
          </p>
        )}
        {listing.latitude != null && listing.longitude != null ? (
          <p className="mt-2 text-xs text-[var(--workspace-shell-text)]/45">
            {listing.latitude.toFixed(5)}, {listing.longitude.toFixed(5)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
