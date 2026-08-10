'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Camera,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Settings2,
  Users,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';

import type { CommercialListing } from '../_lib/server/listings.service';

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, href: '' },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, href: '/marketing' },
  { key: 'media', label: 'Media', icon: Camera, href: '/media' },
  { key: 'interest', label: 'Interest', icon: Users, href: '/interest' },
  {
    key: 'availability',
    label: 'Availability',
    icon: FileText,
    href: '/availability',
  },
  {
    key: 'management',
    label: 'Management',
    icon: Settings2,
    href: '/management',
  },
] as const;

function listingAddress(listing: CommercialListing) {
  return [
    listing.addressLine1,
    listing.addressLine2,
    listing.town,
    listing.county,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

export function ListingDetailShell({
  listing,
  accountSlug,
  children,
}: {
  listing: CommercialListing;
  accountSlug: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id);

  const isOverview = pathname === base || pathname === `${base}/`;
  const address = listingAddress(listing);

  return (
    <div className="space-y-5">
      {isOverview ? (
        <OverviewHeader listing={listing} address={address} />
      ) : (
        <CompactHeader listing={listing} address={address} />
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active =
              item.href === '' ? isOverview : pathname.startsWith(href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function CompactHeader({
  listing,
  address,
}: {
  listing: CommercialListing;
  address: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
        {listing.name}
      </h2>
      {address ? (
        <p className="mt-0.5 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text)]/55">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{address}</span>
        </p>
      ) : null}
    </div>
  );
}

function OverviewHeader({
  listing,
  address,
}: {
  listing: CommercialListing;
  address: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-[var(--workspace-shell-sidebar-accent)] sm:h-auto sm:w-52">
          {listing.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center text-[var(--workspace-shell-text)]/25">
              <Camera className="h-10 w-10" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 rounded-md bg-[var(--ozer-accent)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--ozer-white)] uppercase">
            {LISTING_STATUS_LABELS[listing.status]}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div>
            <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              {listing.name}
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text)]/55">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{address || 'No address'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
              {DISPOSAL_TYPE_LABELS[listing.disposalType]}
            </span>
            {listing.sector ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
                {listing.sector}
              </span>
            ) : null}
            {listing.sizeMinSqft != null || listing.sizeMaxSqft != null ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
                {[listing.sizeMinSqft, listing.sizeMaxSqft]
                  .filter((v) => v != null)
                  .join('–')}{' '}
                sq ft
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
