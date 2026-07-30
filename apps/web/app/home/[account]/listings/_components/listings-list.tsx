'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Building2,
  Edit2,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
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
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspaceCardHover,
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

type ViewMode = 'cards' | 'table';

function formatMoney(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatSize(listing: CommercialListing) {
  if (listing.sizeMinSqft == null && listing.sizeMaxSqft == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);
  const min = listing.sizeMinSqft;
  const max = listing.sizeMaxSqft;
  if (min != null && max != null && min !== max) {
    return `${fmt(min)}–${fmt(max)} sq ft`;
  }
  return `${fmt(min ?? max!)} sq ft`;
}

function locationLabel(listing: CommercialListing) {
  return [listing.addressLine1, listing.town, listing.postcode]
    .filter(Boolean)
    .join(', ');
}

function listingHref(accountSlug: string, listingId: string) {
  return pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId);
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
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialListing | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setListings(initialListings);
  }, [initialListings]);

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

  const handleSaved = useCallback(
    (saved: CommercialListing) => {
      setListings((prev) => {
        const idx = prev.findIndex((l) => l.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      router.refresh();
    },
    [router],
  );

  const handleDelete = useCallback(
    (listingId: string) => {
      if (!confirm('Delete this listing? This cannot be undone.')) return;
      startTransition(async () => {
        try {
          await deleteListing({ listingId, accountId });
          setListings((prev) => prev.filter((l) => l.id !== listingId));
          router.refresh();
        } catch (err) {
          console.error(err);
        }
      });
    },
    [accountId, router],
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-label="Card view"
              className={`flex h-9 w-9 items-center justify-center transition-colors ${
                viewMode === 'cards'
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text)]/45 hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              className={`flex h-9 w-9 items-center justify-center transition-colors ${
                viewMode === 'table'
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text)]/45 hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button variant="outline" asChild>
            <Link
              href={pathsConfig.app.accountListingsImport.replace(
                '[account]',
                accountSlug,
              )}
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button onClick={openCreate} className={workspaceBtnPrimaryMd}>
            <Plus className="h-4 w-4" />
            Add listing
          </Button>
        </div>
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
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              accountSlug={accountSlug}
              onEdit={() => openEdit(listing)}
              onDelete={() => handleDelete(listing.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
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
                const href = listingHref(accountSlug, listing.id);
                const rent = formatMoney(listing.askingRentPence);
                const price = formatMoney(listing.askingPricePence);
                const size = formatSize(listing) ?? '—';

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
                      <ListingActions
                        onEdit={() => openEdit(listing)}
                        onDelete={() => handleDelete(listing.id)}
                      />
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

function ListingCard({
  listing,
  accountSlug,
  onEdit,
  onDelete,
}: {
  listing: CommercialListing;
  accountSlug: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const href = listingHref(accountSlug, listing.id);
  const rent = formatMoney(listing.askingRentPence);
  const price = formatMoney(listing.askingPricePence);
  const size = formatSize(listing);
  const location = locationLabel(listing);

  return (
    <Card
      className={`group overflow-hidden ${workspacePanelCard} ${workspaceCardHover}`}
    >
      <Link
        href={href}
        className="relative flex aspect-[16/10] items-center justify-center bg-[var(--workspace-shell-sidebar-accent)]"
      >
        <Building2 className="h-10 w-10 text-[var(--workspace-shell-text)]/15" />
        <span className="absolute top-3 left-3 inline-flex rounded-full bg-[var(--workspace-shell-panel)]/95 px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)] shadow-sm">
          {LISTING_STATUS_LABELS[listing.status]}
        </span>
        <span className="absolute top-3 right-3 inline-flex rounded-full bg-[var(--workspace-shell-panel)]/95 px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/70 shadow-sm">
          {DISPOSAL_TYPE_LABELS[listing.disposalType]}
        </span>
      </Link>

      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={href}
              className="line-clamp-2 text-sm font-semibold text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
            >
              {listing.name}
            </Link>
            {location ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--workspace-shell-text)]/50">
                {location}
              </p>
            ) : null}
          </div>
          <ListingActions onEdit={onEdit} onDelete={onDelete} ghostUntilHover />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--workspace-shell-text)]/55">
          {listing.sector ? <span>{listing.sector}</span> : null}
          {size ? <span>{size}</span> : null}
        </div>

        {(rent || price) && (
          <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {rent ?? price}
            {rent ? (
              <span className="ml-1 text-xs font-normal text-[var(--workspace-shell-text)]/45">
                pa
              </span>
            ) : null}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ListingActions({
  onEdit,
  onDelete,
  ghostUntilHover = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  ghostUntilHover?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 shrink-0 text-[var(--workspace-shell-text-muted)] ${
            ghostUntilHover ? 'opacity-0 group-hover:opacity-100' : ''
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit} className="gap-2">
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onDelete}
          className="gap-2 text-rose-400 focus:text-rose-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
