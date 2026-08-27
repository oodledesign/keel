'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { ListingStatusBadge } from '~/components/commercial/listing-status-badge';
import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
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
  workspaceSelectContentClass,
  workspaceSelectItemClass,
} from '~/lib/workspace-ui';

import { buildNewDisposalPath } from '../_lib/disposal-create-url';
import {
  type DisposalStatusFilter,
  disposalStatusQueryParams,
  listingMatchesDisposalStatus,
  parseDisposalStatusFilter,
} from '../_lib/disposal-list-filters';
import type {
  CommercialListing,
  ListingMemberOption,
} from '../_lib/server/listings.service';
import {
  backfillListingLocations,
  countSuggestedMatches,
  countUnassignedListings,
  deleteListing,
  listListings,
} from '../_lib/server/server-actions';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import { ListingFormModal } from './listing-form-modal';
import { ListingSectorPills } from './listing-sector-pills';
import { ListingsMapView } from './listings-map-view';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
const MAP_PAGE_SIZE = 100;

interface ListingsListProps {
  accountId: string;
  accountSlug: string;
  initialListings: CommercialListing[];
  initialTotal: number;
  offices: Array<{ id: string; name: string }>;
  members: ListingMemberOption[];
  initialOfficeId: string | null;
  initialStatusFilter: StatusFilter;
  initialAgentUserId: string | null;
  initialNeedsLocation: boolean;
  unassignedCount: number;
  canEditDisposals: boolean;
}

type ViewMode = 'cards' | 'table' | 'map';
type ListingSort = 'updated' | 'name' | 'on_market' | 'matches';
type StatusFilter = DisposalStatusFilter;

const LISTING_SORT_OPTIONS: Array<{ value: ListingSort; label: string }> = [
  { value: 'updated', label: 'Updated last' },
  { value: 'name', label: 'Alphabetical' },
  { value: 'on_market', label: 'On market date' },
  { value: 'matches', label: 'Most matches' },
];

const statusQueryParams = disposalStatusQueryParams;

function listingMatchesStatus(
  listing: CommercialListing,
  filter: StatusFilter,
) {
  return listingMatchesDisposalStatus(listing.status, filter);
}

function mergeListings(
  current: CommercialListing[],
  incoming: CommercialListing[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}

function sortListings(listings: CommercialListing[], sort: ListingSort) {
  return [...listings].sort((a, b) => {
    if (sort === 'name') {
      const byName = a.name.localeCompare(b.name, 'en', {
        sensitivity: 'base',
      });
      if (byName !== 0) return byName;
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    if (sort === 'on_market') {
      const aDate = a.onMarketAt ?? '';
      const bDate = b.onMarketAt ?? '';
      if (aDate && bDate) {
        const byMarket = bDate.localeCompare(aDate);
        if (byMarket !== 0) return byMarket;
      } else if (aDate || bDate) {
        return aDate ? -1 : 1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    if (sort === 'matches') {
      const byMatches = (b.matchCount ?? 0) - (a.matchCount ?? 0);
      if (byMatches !== 0) return byMatches;
      return b.updatedAt.localeCompare(a.updatedAt);
    }
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
  offices,
  members,
  initialOfficeId,
  initialStatusFilter,
  initialAgentUserId,
  initialNeedsLocation,
  unassignedCount,
  canEditDisposals,
}: ListingsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createRequested = searchParams.get('create') === '1';
  const showOfficeFilter = offices.length > 1;
  const officeFromUrl = searchParams.get('office');
  const officeId =
    showOfficeFilter &&
    officeFromUrl &&
    offices.some((office) => office.id === officeFromUrl)
      ? officeFromUrl
      : (initialOfficeId ?? null);
  const statusFromUrl = searchParams.get('status');
  const statusFilter = statusFromUrl
    ? parseDisposalStatusFilter(statusFromUrl)
    : initialStatusFilter;
  const agentFromUrl = searchParams.get('agent');
  const agentUserId =
    agentFromUrl && members.some((member) => member.userId === agentFromUrl)
      ? agentFromUrl
      : searchParams.has('agent')
        ? null
        : initialAgentUserId;
  const needsLocationOnly = searchParams.has('needsLocation')
    ? searchParams.get('needsLocation') === '1'
    : initialNeedsLocation;
  const [pageListings, setPageListings] = useState(initialListings);
  const [cachedListings, setCachedListings] = useState(initialListings);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sortMode, setSortMode] = useState<ListingSort>('updated');
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
  const [unassignedOverride, setUnassignedOverride] = useState<number | null>(
    null,
  );
  const unassignedVisibleCount = unassignedOverride ?? unassignedCount;
  const suggestedMatchIdsRef = useRef(new Set<string>());
  const listFilterKeyRef = useRef(
    `${initialStatusFilter}:${initialAgentUserId ?? ''}`,
  );

  useEffect(() => {
    setPageListings(initialListings);
    setCachedListings(initialListings);
    setTotal(initialTotal);
    setPage(1);
    setUnassignedOverride(null);
    suggestedMatchIdsRef.current.clear();
  }, [initialListings, initialTotal]);

  // Suggested match scoring is deferred off SSR — fill badges after paint.
  useEffect(() => {
    const listingIds = pageListings
      .map((listing) => listing.id)
      .filter((id) => !suggestedMatchIdsRef.current.has(id));
    if (listingIds.length === 0) return;

    let cancelled = false;
    void countSuggestedMatches({ accountId, listingIds })
      .then((suggested) => {
        if (cancelled || !suggested || typeof suggested !== 'object') return;
        for (const id of listingIds) {
          suggestedMatchIdsRef.current.add(id);
        }
        const listingIdSet = new Set(listingIds);
        const apply = (list: CommercialListing[]) =>
          list.map((listing) => {
            if (!listingIdSet.has(listing.id)) return listing;
            const extra = suggested[listing.id] ?? 0;
            if (extra <= 0) return listing;
            return {
              ...listing,
              matchCount: (listing.matchCount ?? 0) + extra,
            };
          });
        setPageListings(apply);
        setCachedListings((current) => apply(current));
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, pageListings]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const updateListFilters = useCallback(
    (patch: {
      office?: string | null;
      status?: StatusFilter;
      agent?: string | null;
      needsLocation?: boolean;
    }) => {
      const url = new URL(window.location.href);

      if (patch.office !== undefined) {
        if (patch.office) url.searchParams.set('office', patch.office);
        else url.searchParams.delete('office');
      }

      if (patch.status !== undefined) {
        if (patch.status === 'active') url.searchParams.delete('status');
        else url.searchParams.set('status', patch.status);
      }

      if (patch.agent !== undefined) {
        if (patch.agent) url.searchParams.set('agent', patch.agent);
        else url.searchParams.delete('agent');
      }

      if (patch.needsLocation !== undefined) {
        if (patch.needsLocation) url.searchParams.set('needsLocation', '1');
        else url.searchParams.delete('needsLocation');
      }

      // Drop scoped cache immediately so map/search don't show the previous filter.
      if (
        patch.office !== undefined ||
        patch.status !== undefined ||
        patch.agent !== undefined
      ) {
        setCachedListings([]);
        setPageListings([]);
        setPage(1);
      }

      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
  );

  const setOfficeFilter = useCallback(
    (nextOfficeId: string | null) => {
      updateListFilters({ office: nextOfficeId });
    },
    [updateListFilters],
  );

  const setStatusFilter = useCallback(
    (nextStatus: StatusFilter) => {
      updateListFilters({ status: nextStatus });
    },
    [updateListFilters],
  );

  const setAgentUserId = useCallback(
    (nextAgentUserId: string | null) => {
      updateListFilters({ agent: nextAgentUserId });
    },
    [updateListFilters],
  );

  const setNeedsLocationOnly = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(needsLocationOnly) : next;
      updateListFilters({ needsLocation: value });
    },
    [needsLocationOnly, updateListFilters],
  );

  const createRequestedHandled = useRef(false);

  useEffect(() => {
    if (!createRequested || createRequestedHandled.current) return;
    createRequestedHandled.current = true;
    if (!canEditDisposals) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '.');
      return;
    }
    const sopAssist = searchParams.get('sopAssist');
    router.replace(
      buildNewDisposalPath(accountSlug, {
        sopAssist,
      }),
    );
  }, [accountSlug, canEditDisposals, createRequested, router, searchParams]);

  const fetchPage = useCallback(
    async (
      pageNum: number,
      opts?: {
        search?: string;
        status?: StatusFilter;
        accountBranchId?: string | null;
        actingAgentUserId?: string | null;
      },
    ) => {
      setLoadingPage(true);
      try {
        const filter = opts?.status ?? statusFilter;
        const { status, statuses } = statusQueryParams(filter);
        const accountBranchId =
          opts?.accountBranchId !== undefined ? opts.accountBranchId : officeId;
        const actingAgentUserId =
          opts?.actingAgentUserId !== undefined
            ? opts.actingAgentUserId
            : agentUserId;
        const result = await listListings({
          accountId,
          page: pageNum,
          pageSize,
          search: opts?.search?.trim() || undefined,
          status,
          statuses,
          accountBranchId: accountBranchId ?? undefined,
          actingAgentUserId: actingAgentUserId ?? undefined,
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
    [accountId, agentUserId, officeId, pageSize, statusFilter],
  );

  useEffect(() => {
    if (searchDebounced.trim()) return;

    const filterKey = `${statusFilter}:${agentUserId ?? ''}`;
    if (listFilterKeyRef.current !== filterKey) {
      listFilterKeyRef.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    const isDefaultFirstPage =
      page === 1 &&
      pageSize === DEFAULT_PAGE_SIZE &&
      statusFilter === initialStatusFilter &&
      (agentUserId ?? null) === (initialAgentUserId ?? null) &&
      officeId === (initialOfficeId ?? null) &&
      initialListings.length > 0;
    if (isDefaultFirstPage) return;

    void fetchPage(page);
  }, [
    page,
    pageSize,
    searchDebounced,
    statusFilter,
    agentUserId,
    officeId,
    initialOfficeId,
    initialStatusFilter,
    initialAgentUserId,
    fetchPage,
    initialListings.length,
  ]);

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
        const { status, statuses } = statusQueryParams(statusFilter);

        while (!cancelled) {
          const result = await listListings({
            accountId,
            search: query,
            page: nextPage,
            pageSize,
            status,
            statuses,
            accountBranchId: officeId ?? undefined,
            actingAgentUserId: agentUserId ?? undefined,
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

          if (list.length < pageSize || nextPage * pageSize >= serverTotal) {
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
  }, [
    accountId,
    searchDebounced,
    statusFilter,
    officeId,
    agentUserId,
    pageSize,
  ]);

  useEffect(() => {
    if (!showOfficeFilter || !officeId) return;

    let cancelled = false;
    void (async () => {
      try {
        const { status, statuses } = statusQueryParams(statusFilter);
        const count = await countUnassignedListings({
          accountId,
          status,
          statuses,
        });
        if (!cancelled && typeof count === 'number') {
          setUnassignedOverride(count);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, officeId, showOfficeFilter, statusFilter]);

  useEffect(() => {
    if (viewMode !== 'map' && !needsLocationOnly && sortMode === 'updated') {
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
        const { status, statuses } = statusQueryParams(statusFilter);

        while (!cancelled) {
          const result = await listListings({
            accountId,
            page: nextPage,
            pageSize: MAP_PAGE_SIZE,
            status,
            statuses,
            accountBranchId: officeId ?? undefined,
            actingAgentUserId: agentUserId ?? undefined,
          });
          const list = Array.isArray(result?.data) ? result.data : [];
          serverTotal =
            typeof result?.total === 'number' ? result.total : list.length;

          if (!cancelled && list.length > 0) {
            setCachedListings((current) =>
              nextPage === 1 &&
              (statusFilter !== 'active' || officeId || agentUserId)
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
  }, [
    accountId,
    viewMode,
    needsLocationOnly,
    sortMode,
    statusFilter,
    officeId,
    agentUserId,
    searchDebounced,
  ]);

  const isSearching = searchDebounced.trim().length > 0;

  const matchesOffice = useCallback(
    (listing: CommercialListing) =>
      !officeId || listing.accountBranchId === officeId,
    [officeId],
  );

  const matchesAgent = useCallback(
    (listing: CommercialListing) =>
      !agentUserId ||
      (listing.actingAgents ?? []).some(
        (agent) => agent.userId === agentUserId,
      ),
    [agentUserId],
  );

  const visibleListings = useMemo(() => {
    const applyNeedsLocation = (items: CommercialListing[]) =>
      needsLocationOnly
        ? items.filter((l) => l.latitude == null || l.longitude == null)
        : items;

    if (viewMode === 'map' || needsLocationOnly || sortMode !== 'updated') {
      const q = searchDebounced.trim().toLowerCase();
      return applyNeedsLocation(
        sortListings(
          cachedListings.filter((l) => {
            if (!matchesOffice(l)) return false;
            if (!matchesAgent(l)) return false;
            if (!listingMatchesStatus(l, statusFilter)) return false;
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
          sortMode,
        ),
      );
    }

    if (!isSearching) return sortListings(pageListings, sortMode);
    const q = searchDebounced.trim().toLowerCase();
    return sortListings(
      cachedListings.filter((l) => {
        if (!matchesOffice(l)) return false;
        if (!matchesAgent(l)) return false;
        if (!listingMatchesStatus(l, statusFilter)) return false;
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
      sortMode,
    );
  }, [
    cachedListings,
    isSearching,
    matchesAgent,
    matchesOffice,
    needsLocationOnly,
    pageListings,
    searchDebounced,
    sortMode,
    statusFilter,
    viewMode,
  ]);

  const needsLocationCount = useMemo(
    () =>
      cachedListings.filter((l) => l.latitude == null || l.longitude == null)
        .length,
    [cachedListings],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const usesFullCache =
    isSearching ||
    viewMode === 'map' ||
    needsLocationOnly ||
    sortMode !== 'updated';
  const displayCount = usesFullCache ? visibleListings.length : total;
  const pagedVisibleListings = useMemo(() => {
    if (!usesFullCache || viewMode === 'map') return visibleListings;
    const start = (page - 1) * pageSize;
    return visibleListings.slice(start, start + pageSize);
  }, [page, pageSize, usesFullCache, viewMode, visibleListings]);
  const clientTotalPages = Math.max(
    1,
    Math.ceil(visibleListings.length / pageSize),
  );
  const effectiveTotalPages = usesFullCache ? clientTotalPages : totalPages;

  const openCreate = () => {
    if (!canEditDisposals) return;
    const sopAssist = searchParams.get('sopAssist');
    router.push(
      buildNewDisposalPath(accountSlug, {
        sopAssist,
      }),
    );
  };

  const openEdit = (listing: CommercialListing) => {
    setEditing(listing);
    setModalOpen(true);
  };

  const handleSaved = useCallback(
    (saved: CommercialListing) => {
      setCachedListings((prev) => mergeListings(prev, [saved]));
      setPageListings((prev) => {
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
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          {displayCount} {displayCount === 1 ? 'disposal' : 'disposals'}
          {usesFullCache && viewMode !== 'map' && effectiveTotalPages > 1
            ? ` · page ${page} of ${effectiveTotalPages}`
            : !usesFullCache && total > pageSize
              ? ` · page ${page} of ${totalPages}`
              : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const next = Number(value) as PageSizeOption;
              if (!PAGE_SIZE_OPTIONS.includes(next)) return;
              setPageSize(next);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[148px] border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]">
              <SelectValue placeholder="Per page" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sortMode}
            onValueChange={(value) => {
              setSortMode(value as ListingSort);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[180px] border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-sm text-[var(--workspace-shell-text)]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {LISTING_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {canEditDisposals ? (
            <Button
              onClick={openCreate}
              className={workspaceBtnPrimaryMd}
              data-tour="sop-add-disposal"
            >
              <Plus className="h-4 w-4" />
              Add disposal
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, address, postcode, or property type…"
          aria-label="Search disposals"
          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus-visible:ring-[var(--ozer-accent)]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {showOfficeFilter ? (
            <Select
              value={officeId ?? 'all'}
              onValueChange={(value) =>
                setOfficeFilter(value === 'all' ? null : value)
              }
            >
              <SelectTrigger
                className="h-8 w-[200px] border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                aria-label="Filter by office"
                data-test="office-filter"
              >
                <SelectValue placeholder="Office" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem
                  value="all"
                  className={workspaceSelectItemClass}
                  data-test="office-filter-all"
                >
                  All offices
                </SelectItem>
                {offices.map((office) => (
                  <SelectItem
                    key={office.id}
                    value={office.id}
                    className={workspaceSelectItemClass}
                    data-test={`office-filter-${office.id}`}
                  >
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger
              className="h-8 w-[180px] border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
              aria-label="Filter by status"
              data-test="status-filter"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className={workspaceSelectContentClass}>
              <SelectItem value="active" className={workspaceSelectItemClass}>
                Active
              </SelectItem>
              {LISTING_STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className={workspaceSelectItemClass}
                >
                  {LISTING_STATUS_LABELS[status]}
                </SelectItem>
              ))}
              <SelectItem value="all" className={workspaceSelectItemClass}>
                All statuses
              </SelectItem>
            </SelectContent>
          </Select>

          {members.length > 0 ? (
            <Select
              value={agentUserId ?? 'all'}
              onValueChange={(value) =>
                setAgentUserId(value === 'all' ? null : value)
              }
            >
              <SelectTrigger
                className="h-8 w-[220px] border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                aria-label="Filter by team member"
                data-test="agent-filter"
              >
                <SelectValue placeholder="Team member" />
              </SelectTrigger>
              <SelectContent className={workspaceSelectContentClass}>
                <SelectItem value="all" className={workspaceSelectItemClass}>
                  All team members
                </SelectItem>
                {members.map((member) => (
                  <SelectItem
                    key={member.userId}
                    value={member.userId}
                    className={workspaceSelectItemClass}
                  >
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <FilterChip
            active={needsLocationOnly}
            onClick={() => setNeedsLocationOnly((v) => !v)}
            label={
              needsLocationCount > 0
                ? `Needs location (${needsLocationCount})`
                : 'Needs location'
            }
          />
          {needsLocationOnly && needsLocationCount > 0 && canEditDisposals ? (
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
                    const { status, statuses } =
                      statusQueryParams(statusFilter);
                    // Refresh caches so new coords appear.
                    const pageResult = await listListings({
                      accountId,
                      page: 1,
                      pageSize: MAP_PAGE_SIZE,
                      status,
                      statuses,
                      accountBranchId: officeId ?? undefined,
                      actingAgentUserId: agentUserId ?? undefined,
                    });
                    const list = Array.isArray(pageResult?.data)
                      ? pageResult.data
                      : [];
                    setCachedListings((current) =>
                      mergeListings(current, list),
                    );
                    setPageListings((current) => mergeListings(current, list));
                    if (
                      typeof result?.updated === 'number' &&
                      result.updated > 0
                    ) {
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
        {officeId && unassignedVisibleCount > 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {unassignedVisibleCount === 1
              ? '1 disposal has no office assigned and only appears under All offices.'
              : `${unassignedVisibleCount} disposals have no office assigned and only appear under All offices.`}
          </p>
        ) : null}
      </div>

      {(isSearching && enrichingSearch) ||
      ((viewMode === 'map' || sortMode !== 'updated' || needsLocationOnly) &&
        enrichingMap) ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {viewMode === 'map' && enrichingMap
            ? 'Loading disposals for map…'
            : sortMode !== 'updated' && enrichingMap
              ? 'Loading disposals for sort…'
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
              {searchQuery.trim() ||
              statusFilter !== 'active' ||
              officeId ||
              agentUserId ||
              needsLocationOnly
                ? 'No matching disposals'
                : 'No active disposals'}
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              {searchQuery.trim() ||
              statusFilter !== 'active' ||
              officeId ||
              agentUserId ||
              needsLocationOnly
                ? 'Try a different search or clear the filters.'
                : 'Add a disposal instruction to get started.'}
            </p>
            {searchQuery.trim() ||
            statusFilter !== 'active' ||
            officeId ||
            agentUserId ||
            needsLocationOnly ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  updateListFilters({
                    office: null,
                    status: 'active',
                    agent: null,
                    needsLocation: false,
                  });
                }}
              >
                Clear filters
              </Button>
            ) : canEditDisposals ? (
              <Button
                onClick={openCreate}
                className={`mt-4 ${workspaceBtnPrimaryMd}`}
                data-tour="sop-add-disposal"
              >
                <Plus className="h-4 w-4" />
                Add disposal
              </Button>
            ) : null}
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
          {pagedVisibleListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              accountSlug={accountSlug}
              canEditDisposals={canEditDisposals}
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
              {pagedVisibleListings.map((listing) => {
                const href = listingHref(accountSlug, listing.id);
                const rent = formatMoney(listing.askingRentPence);
                const price = formatMoney(listing.askingPricePence);
                const size = formatSize(listing) ?? '—';
                const location = locationLabel(listing);

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
                          {location ? (
                            <p className="truncate text-xs text-[var(--workspace-shell-text)]/45">
                              {location}
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
                      <ListingStatusBadge status={listing.status} />
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
                      {canEditDisposals ? (
                        <ListingActions
                          onEdit={() => openEdit(listing)}
                          onDelete={() => setDeleteTarget(listing)}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode !== 'map' && effectiveTotalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(
              page * pageSize,
              usesFullCache ? visibleListings.length : total,
            )}{' '}
            of {usesFullCache ? visibleListings.length : total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loadingPage || enrichingMap}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                page >= effectiveTotalPages || loadingPage || enrichingMap
              }
              onClick={() => setPage((p) => p + 1)}
              className="border-[color:var(--workspace-shell-border)]"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <ListingFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        accountId={accountId}
        accountSlug={accountSlug}
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
  canEditDisposals,
  onEdit,
  onDelete,
}: {
  listing: CommercialListing;
  accountSlug: string;
  canEditDisposals: boolean;
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
        <ListingStatusBadge
          status={listing.status}
          className="absolute top-3 left-3 shadow-sm"
        />
        <span
          className={`absolute top-3 right-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
        >
          {DISPOSAL_TYPE_LABELS[listing.disposalType]}
        </span>
        {(listing.matchCount ?? 0) > 0 ? (
          <span
            className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--ozer-accent)] px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
            title={`${listing.matchCount} match${listing.matchCount === 1 ? '' : 'es'}`}
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
          {canEditDisposals ? (
            <ListingActions
              onEdit={onEdit}
              onDelete={onDelete}
              ghostUntilHover
            />
          ) : null}
        </div>

        {(listing.sector || size) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <ListingSectorPills sector={listing.sector} />
            {size ? (
              <span className="text-xs text-[var(--workspace-shell-text)]/55">
                {size}
              </span>
            ) : null}
          </div>
        )}

        {updatedLabel ? (
          <p className="text-xs text-[var(--workspace-shell-text)]/45">
            Updated {updatedLabel}
          </p>
        ) : null}

        {(listing.actingAgents?.length ?? 0) > 0 ? (
          <ListingAgentAvatarStack
            agents={listing.actingAgents ?? []}
            size="sm"
          />
        ) : null}

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
  dataTest,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClassName?: string;
  dataTest?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-test={dataTest}
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
