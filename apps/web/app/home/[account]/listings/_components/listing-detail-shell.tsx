'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Activity,
  Camera,
  Edit2,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Settings2,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import { ListingFormModal } from './listing-form-modal';
import { ListingSectorPills } from './listing-sector-pills';

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
  { key: 'activity', label: 'Activity', icon: Activity, href: '/activity' },
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

function formatUpdatedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ListingDetailShell({
  listing: initialListing,
  accountSlug,
  accountId,
  children,
}: {
  listing: CommercialListing;
  accountSlug: string;
  accountId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [listing, setListing] = useState(initialListing);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  const base = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id);

  const isOverview = pathname === base || pathname === `${base}/`;
  const address = listingAddress(listing);

  const editButton = (
    <Button
      type="button"
      className={workspaceBtnPrimaryMd}
      onClick={() => setEditOpen(true)}
    >
      <Edit2 className="h-4 w-4" />
      Edit
    </Button>
  );

  return (
    <div className="space-y-5">
      {isOverview ? (
        <OverviewHeader
          listing={listing}
          address={address}
          editButton={editButton}
        />
      ) : (
        <CompactHeader
          listing={listing}
          address={address}
          editButton={editButton}
        />
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

      <ListingFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        accountId={accountId}
        accountSlug={accountSlug}
        listing={listing}
        onSaved={(saved) => {
          setListing(saved);
          setEditOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function CompactHeader({
  listing,
  address,
  editButton,
}: {
  listing: CommercialListing;
  address: string;
  editButton: React.ReactNode;
}) {
  const updatedLabel = formatUpdatedAt(listing.updatedAt);

  return (
    <div className="flex items-start justify-between gap-3">
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
        {updatedLabel ? (
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/45">
            Updated {updatedLabel}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{editButton}</div>
    </div>
  );
}

function OverviewHeader({
  listing,
  address,
  editButton,
}: {
  listing: CommercialListing;
  address: string;
  editButton: React.ReactNode;
}) {
  const updatedLabel = formatUpdatedAt(listing.updatedAt);

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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
                {listing.name}
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-[var(--workspace-shell-text)]/55">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{address || 'No address'}</span>
              </p>
            </div>
            <div className="shrink-0">{editButton}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
            >
              {DISPOSAL_TYPE_LABELS[listing.disposalType]}
            </span>
            <ListingSectorPills sector={listing.sector} size="md" />
            {listing.sizeMinSqft != null || listing.sizeMaxSqft != null ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
                {[listing.sizeMinSqft, listing.sizeMaxSqft]
                  .filter((v) => v != null)
                  .join('–')}{' '}
                sq ft
              </span>
            ) : null}
          </div>
          {(listing.actingAgents?.length ?? 0) > 0 ? (
            <div className="flex items-center gap-2">
              <ListingAgentAvatarStack
                agents={listing.actingAgents ?? []}
                size="sm"
              />
              <span className="text-xs text-[var(--workspace-shell-text)]/50">
                {(listing.actingAgents ?? [])
                  .slice(0, 3)
                  .map((agent) => agent.name)
                  .join(', ')}
                {(listing.actingAgents?.length ?? 0) > 3
                  ? ` +${(listing.actingAgents?.length ?? 0) - 3}`
                  : ''}
              </span>
            </div>
          ) : null}
          {updatedLabel ? (
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              Updated {updatedLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
