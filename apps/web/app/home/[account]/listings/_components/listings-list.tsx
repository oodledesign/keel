'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Building2,
  Edit2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUS_LABELS,
  LISTING_STATUSES,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspaceIconChip,
  workspacePanelCard,
} from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { deleteListing } from '../_lib/server/server-actions';
import { ListingFormModal } from './listing-form-modal';

interface ListingsListProps {
  accountId: string;
  accountSlug: string;
  initialListings: CommercialListing[];
}

function formatMoney(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function locationLabel(listing: CommercialListing) {
  return [listing.addressLine1, listing.town, listing.postcode]
    .filter(Boolean)
    .join(', ');
}

export function ListingsList({
  accountId,
  accountSlug,
  initialListings,
}: ListingsListProps) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>(
    'all',
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialListing | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return listings;
    return listings.filter((l) => l.status === statusFilter);
  }, [listings, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (listing: CommercialListing) => {
    setEditing(listing);
    setModalOpen(true);
  };

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = useCallback(
    (listingId: string) => {
      if (!confirm('Delete this listing? This cannot be undone.')) return;
      startTransition(async () => {
        try {
          await deleteListing({ listingId, accountId });
          setListings((prev) => prev.filter((l) => l.id !== listingId));
        } catch (err) {
          console.error(err);
        }
      });
    },
    [accountId],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Listings
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'disposal' : 'disposals'}
          </p>
        </div>
        <Button onClick={openCreate} className={workspaceBtnPrimaryMd}>
          <Plus className="h-4 w-4" />
          Add listing
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label="All"
        />
        {LISTING_STATUSES.map((status) => (
          <FilterChip
            key={status}
            active={statusFilter === status}
            onClick={() => setStatusFilter(status)}
            label={LISTING_STATUS_LABELS[status]}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No listings yet
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Add a disposal instruction to get started.
            </p>
            <Button
              onClick={openCreate}
              className={`mt-4 ${workspaceBtnPrimaryMd}`}
            >
              <Plus className="h-4 w-4" />
              Add listing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
              <tr>
                <th className="px-4 py-3 font-medium">Listing</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Disposal
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Size
                </th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Rent / price
                </th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing) => {
                const href = pathsConfig.app.accountListingDetail
                  .replace('[account]', accountSlug)
                  .replace('[id]', listing.id);
                const rent = formatMoney(listing.askingRentPence);
                const price = formatMoney(listing.askingPricePence);
                const size =
                  listing.sizeMinSqft != null || listing.sizeMaxSqft != null
                    ? [
                        listing.sizeMinSqft,
                        listing.sizeMaxSqft,
                      ]
                        .filter((v) => v != null)
                        .join('–') + ' sq ft'
                    : '—';

                return (
                  <tr
                    key={listing.id}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-0 hover:bg-[var(--workspace-shell-sidebar-accent)]/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${workspaceIconChip}`}
                        >
                          <Building2 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={href}
                            className="font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
                          >
                            {listing.name}
                          </Link>
                          {locationLabel(listing) ? (
                            <p className="truncate text-xs text-[var(--workspace-shell-text)]/45">
                              {locationLabel(listing)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 md:table-cell">
                      {DISPOSAL_TYPE_LABELS[listing.disposalType]}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
                        {LISTING_STATUS_LABELS[listing.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 lg:table-cell">
                      {size}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 sm:table-cell">
                      {rent ?? price ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[var(--workspace-shell-text-muted)]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => openEdit(listing)}
                            className="gap-2"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => handleDelete(listing.id)}
                            className="gap-2 text-rose-400 focus:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        listing={editing}
        onSaved={handleSaved}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--ozer-accent)] text-white'
          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]'
      }`}
    >
      {label}
    </button>
  );
}
