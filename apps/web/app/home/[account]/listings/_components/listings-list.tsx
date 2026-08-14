'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Bell,
  Building2,
  Edit2,
  LayoutGrid,
  List,
  Map as MapIcon,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_BADGE_CLASS,
  LISTING_STATUS_FILTER_ACTIVE_CLASS,
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
import {
  backfillListingLocations,
  deleteListing,
  listListings,
} from '../_lib/server/server-actions';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import { ListingFormModal } from './listing-form-modal';
import { ListingsMapView } from './listings-map-view';

const PAGE_SIZE = 20;
const MAP_PAGE_SIZE = 100;

interface ListingsListProps {
  accountId: string;
  accountSlug: string;
  initialListings: CommercialListing[];
  initialTotal: number;
}

type ViewMode = 'cards' | 'table' | 'map';

function mergeListings(
  current: CommercialListing[],
  incoming: CommercialListing[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return sortListingsByUpdated(Array.from(byId.values()));
}

function sortListingsByUpdated(listings: CommercialListing[]) {
  return [...listings].sort((a, b) => {
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return b.createdAt.localeCompare(a.createdAt);
  });
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
  initialTotal,
}: ListingsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createRequested = searchParams.get('create') === '1';
  const [pageListings, setPageListings] = useState(initialListings);
  const [cachedListings, setCachedListings] = useState(initialListings);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>(
    'all',
  );
  const [needsLocationOnly, setNeedsLocationOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialListing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommercialListing | null>(
    null,
  );
  const [loadingPage, setLoadingPage] = useState(false);
  const [enrichingSearch, setEnrichingSearch] = useState(false);
  const [enrichingMap, setEnrichingMap] = useState(false);
  const [backfillingLocations, setBackfillingLocations] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    setPageListings(initialListings);
    setCachedListings(initialListings);
    setTotal(initialTotal);
    setPage(1);
  }, [initialListings, initialTotal]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const clearCreateQuery = useCallback(() => {
    if (!createRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('create');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [createRequested, router]);

  const fetchPage = useCallback(
    async (
      pageNum: number,
      opts?: { search?: string; status?: ListingStatus | 'all' },
    ) => {
      setLoadingPage(true);
      try {
        const status =
          (opts?.status ?? statusFilter) === 'all'
            ? undefined
            : ((opts?.status ?? statusFilter) as ListingStatus);
        const result = await listListings({
          accountId,
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: opts?.search?.trim() || undefined,
          status,
        });
        const list = Array.isArray(result?.data) ? result.data : [];
        const count = typeof result?.total === 'number' ? result.total : 0;
        setPageListings(list);
        setCachedListings((current) => mergeListings(current, list));
        setTotal(count);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPage(false);
      }
    },
    [accountId, statusFilter],
  );

  useEffect(() => {
    if (searchDebounced.trim()) return;

    const isDefaultFirstPage =
      page === 1 && statusFilter === 'all' && initialListings.length > 0;
    if (isDefaultFirstPage) return;

    void fetchPage(page);
  }, [page, searchDebounced, statusFilter, fetchPage, initialListings.length]);

  useEffect(() => {
    const query = searchDebounced.trim();
    if (!query) {
      setEnrichingSearch(false);
      return;
    }

    let cancelled = false;

    const enrichFromServer = async () => {
      setEnrichingSearch(true);
      setPage(1);
      try {
        let nextPage = 1;
        let serverTotal = 0;
        const status = statusFilter === 'all' ? undefined : statusFilter;

        while (!cancelled) {
          const result = await listListings({
            accountId,
            search: query,
            page: nextPage,
            pageSize: PAGE_SIZE,
            status,
          });
          const list = Array.isArray(result?.data) ? result.data : [];
          serverTotal =
            typeof result?.total === 'number' ? result.total : list.length;

          if (!cancelled && list.length > 0) {
            setCachedListings((current) =>
              nextPage === 1 ? list : mergeListings(current, list),
            );
            if (nextPage === 1) setPageListings(list);
          }

          if (list.length < PAGE_SIZE || nextPage * PAGE_SIZE >= serverTotal) {
            break;
          }
          nextPage += 1;
        }

        if (!cancelled) setTotal(serverTotal);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setEnrichingSearch(false);
      }
    };

    void enrichFromServer();
    return () => {
      cancelled = true;
    };
  }, [accountId, searchDebounced, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (viewMode !== 'map' && !needsLocationOnly) {
      setEnrichingMap(false);
      return;
    }

    // Search enrichment already pages through the full filtered set.
    if (searchDebounced.trim()) return;

    let cancelled = false;

    const loadAllForMap = async () => {
      setEnrichingMap(true);
      try {
        let nextPage = 1;
        let serverTotal = 0;
        const status = statusFilter === 'all' ? undefined : statusFilter;

        while (!cancelled) {
          const result = await listListings({
            accountId,
            page: nextPage,
            pageSize: MAP_PAGE_SIZE,
            status,
          });
          const list = Array.isArray(result?.data) ? result.data : [];
          serverTotal =
            typeof result?.total === 'number' ? result.total : list.length;

          if (!cancelled && list.length > 0) {
            setCachedListings((current) =>
              nextPage === 1 && statusFilter !== 'all'
                ? list
                : mergeListings(current, list),
            );
          }

          if (
            list.length < MAP_PAGE_SIZE ||
            nextPage * MAP_PAGE_SIZE >= serverTotal
          ) {
            break;
          }
          nextPage += 1;
        }

        if (!cancelled) setTotal(serverTotal);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setEnrichingMap(false);
      }
    };

    void loadAllForMap();
    return () => {
      cancelled = true;
    };
  }, [accountId, viewMode, needsLocationOnly, statusFilter, searchDebounced]);

  const isSearching = searchDebounced.trim().length > 0;

  const visibleListings = useMemo(() => {
    const applyNeedsLocation = (items: CommercialListing[]) =>
      needsLocationOnly
        ? items.filter((l) => l.latitude == null || l.longitude == null)
        : items;

    if (viewMode === 'map' || needsLocationOnly) {
      const q = searchDebounced.trim().toLowerCase();
      return applyNeedsLocation(
        sortListingsByUpdated(
          cachedListings.filter((l) => {
            if (statusFilter !== 'all' && l.status !== statusFilter) return false;
            if (!q) return true;
            const haystack = [
              l.name,
              l.addressLine1,
              l.addressLine2,
              l.town,
              l.postcode,
              l.county,
              l.sector,
              l.externalId,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(q);
          }),
        ),
      );
    }

    if (!isSearching) return sortListingsByUpdated(pageListings);
    const q = searchDebounced.trim().toLowerCase();
    return sortListingsByUpdated(
      cachedListings.filter((l) => {
        if (statusFilter !== 'all' && l.status !== statusFilter) return false;
        const haystack = [
          l.name,
          l.addressLine1,
          l.addressLine2,
          l.town,
          l.postcode,
          l.county,
          l.sector,
          l.externalId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      }),
    );
  }, [
    cachedListings,
    isSearching,
    needsLocationOnly,
    pageListings,
    searchDebounced,
    statusFilter,
    viewMode,
  ]);

  const needsLocationCount = useMemo(
    () =>
      cachedListings.filter((l) => l.latitude == null || l.longitude == null)
        .length,
    [cachedListings],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const displayCount =
    isSearching || viewMode === 'map' || needsLocationOnly
      ? visibleListings.length
      : total;

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
      let wasNew = false;
      setCachedListings((prev) => {
        wasNew = !prev.some((l) => l.id === saved.id);
        return mergeListings(prev, [saved]);
      });
      setPageListings((prev) => {
        const idx = prev.findIndex((l) => l.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return sortListingsByUpdated(next);
        }
        return sortListingsByUpdated([saved, ...prev]);
      });
      setTotal((prev) => (wasNew ? prev + 1 : prev));
      router.refresh();
    },
    [router],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const listingId = deleteTarget.id;
    startDeleteTransition(async () => {
      try {
        await deleteListing({ listingId, accountId });
        setPageListings((prev) => prev.filter((l) => l.id !== listingId));
        setCachedListings((prev) => prev.filter((l) => l.id !== listingId));
        setTotal((prev) => Math.max(0, prev - 1));
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  }, [accountId, deleteTarget, router]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Disposals
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {displayCount} {displayCount === 1 ? 'disposal' : 'disposals'}
            {!isSearching && total > PAGE_SIZE
              ? ` · page ${page} of ${totalPages}`
              : null}
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
            <button
              type="button"
              onClick={() => setViewMode('map')}
              aria-label="Map view"
              className={`flex h-9 w-9 items-center justify-center transition-colors ${
                viewMode === 'map'
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                  : 'text-[var(--workspace-shell-text)]/45 hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <MapIcon className="h-4 w-4" />
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
            Add disposal
          </Button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, address, postcode, or sector…"
          aria-label="Search disposals"
          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus-visible:ring-[var(--ozer-accent)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
            activeClassName={LISTING_STATUS_FILTER_ACTIVE_CLASS[status]}
          />
        ))}
        <FilterChip
          active={needsLocationOnly}
          onClick={() => setNeedsLocationOnly((v) => !v)}
          label={
            needsLocationCount > 0
              ? `Needs location (${needsLocationCount})`
              : 'Needs location'
          }
        />
        {needsLocationOnly && needsLocationCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={backfillingLocations}
            className="h-8 border-[color:var(--workspace-shell-border)]"
            onClick={() => {
              void (async () => {
                setBackfillingLocations(true);
                try {
                  const result = await backfillListingLocations({
                    accountId,
                    limit: 40,
                  });
                  // Refresh caches so new coords appear.
                  const pageResult = await listListings({
                    accountId,
                    page: 1,
                    pageSize: MAP_PAGE_SIZE,
                    status:
                      statusFilter === 'all' ? undefined : statusFilter,
                  });
                  const list = Array.isArray(pageResult?.data)
                    ? pageResult.data
                    : [];
                  setCachedListings((current) => mergeListings(current, list));
                  setPageListings((current) => mergeListings(current, list));
                  if (typeof result?.updated === 'number' && result.updated > 0) {
                    router.refresh();
                  }
                } catch (err) {
                  console.error(err);
                } finally {
                  setBackfillingLocations(false);
                }
              })();
            }}
          >
            {backfillingLocations ? 'Geocoding…' : 'Backfill locations'}
          </Button>
        ) : null}
      </div>

      {(isSearching && enrichingSearch) ||
      (viewMode === 'map' && enrichingMap) ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {viewMode === 'map' && enrichingMap
            ? 'Loading disposals for map…'
            : 'Searching all disposals…'}
        </p>
      ) : null}

      {visibleListings.length === 0 &&
      !loadingPage &&
      !enrichingSearch &&
      !enrichingMap ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              {searchQuery.trim() || statusFilter !== 'all'
                ? 'No matching disposals'
                : 'No disposals yet'}
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              {searchQuery.trim() || statusFilter !== 'all'
                ? 'Try a different search or clear the status filter.'
                : 'Add a disposal instruction to get started.'}
            </p>
            {searchQuery.trim() || statusFilter !== 'all' ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                onClick={openCreate}
                className={`mt-4 ${workspaceBtnPrimaryMd}`}
              >
                <Plus className="h-4 w-4" />
                Add disposal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'map' ? (
        <ListingsMapView
          listings={visibleListings}
          accountSlug={accountSlug}
          loading={enrichingMap || enrichingSearch}
        />
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              accountSlug={accountSlug}
              onEdit={() => openEdit(listing)}
              onDelete={() => setDeleteTarget(listing)}
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
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Matches
                </th>
                <th className="hidden px-4 py-3 font-medium xl:table-cell">
                  Updated
                </th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {visibleListings.map((listing) => {
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
                          className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ${workspaceIconChip}`}
                        >
                          {listing.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={listing.coverUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-3.5 w-3.5" />
                          )}
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
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
                      >
                        {DISPOSAL_TYPE_LABELS[listing.disposalType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${LISTING_STATUS_BADGE_CLASS[listing.status]}`}
                      >
                        {LISTING_STATUS_LABELS[listing.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 lg:table-cell">
                      {size}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/70 sm:table-cell">
                      {rent ?? price ?? '—'}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {(listing.matchCount ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--ozer-accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Bell className="h-3 w-3" />
                          <span className="tabular-nums">
                            {listing.matchCount}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--workspace-shell-text)]/35">
                          —
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-[var(--workspace-shell-text)]/55 xl:table-cell">
                      {formatUpdatedAt(listing.updatedAt) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ListingActions
                        onEdit={() => openEdit(listing)}
                        onDelete={() => setDeleteTarget(listing)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isSearching &&
      viewMode !== 'map' &&
      !needsLocationOnly &&
      totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loadingPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loadingPage}
              onClick={() => setPage((p) => p + 1)}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ListingFormModal
        open={modalOpen || createRequested}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          clearCreateQuery();
        }}
        accountId={accountId}
        listing={editing}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.name ?? 'this disposal'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Units, media and related interest on this
              disposal will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-[#C4455C] text-white hover:bg-[#C4455C]/90"
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete disposal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const updatedLabel = formatUpdatedAt(listing.updatedAt);

  return (
    <Card
      className={`group overflow-hidden ${workspacePanelCard} ${workspaceCardHover}`}
    >
      <Link
        href={href}
        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[var(--workspace-shell-sidebar-accent)]"
      >
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <Building2 className="h-10 w-10 text-[var(--workspace-shell-text)]/15" />
        )}
        <span
          className={`absolute top-3 left-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm ${LISTING_STATUS_BADGE_CLASS[listing.status]}`}
        >
          {LISTING_STATUS_LABELS[listing.status]}
        </span>
        <span
          className={`absolute top-3 right-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
        >
          {DISPOSAL_TYPE_LABELS[listing.disposalType]}
        </span>
        {(listing.matchCount ?? 0) > 0 ? (
          <span
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--ozer-accent)] px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
            title={`${listing.matchCount} linked interest match${listing.matchCount === 1 ? '' : 'es'}`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="tabular-nums">{listing.matchCount}</span>
          </span>
        ) : null}
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
          {updatedLabel ? <span>Updated {updatedLabel}</span> : null}
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

        {(listing.actingAgents?.length ?? 0) > 0 ? (
          <ListingAgentAvatarStack
            agents={listing.actingAgents ?? []}
            size="sm"
          />
        ) : null}

        {(listing.coAgents?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {listing.coAgents!.slice(0, 3).map((agent) => (
              <span
                key={agent.id}
                className="inline-flex max-w-full truncate rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/70"
                title={
                  agent.contactName
                    ? `${agent.clientName} · ${agent.contactName}`
                    : agent.clientName
                }
              >
                Joint: {agent.clientName}
              </span>
            ))}
            {(listing.coAgents?.length ?? 0) > 3 ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/55">
                +{(listing.coAgents?.length ?? 0) - 3}
              </span>
            ) : null}
          </div>
        ) : null}
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
  activeClassName,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? (activeClassName ?? 'bg-[var(--ozer-accent)] text-white')
          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]'
      }`}
    >
      {label}
    </button>
  );
}
