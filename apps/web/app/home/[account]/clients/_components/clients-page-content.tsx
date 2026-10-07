'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Archive,
  Download,
  LayoutGrid,
  Linkedin,
  List,
  Loader2,
  PlusCircle,
  Search,
  Upload,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { ContactCirculationFilter } from '~/lib/commercial/circulation/contact-comms';

import { listAccountMembers } from '../../jobs/_lib/server/server-actions';
import type { ClientOverviewItem } from '../_lib/clients-overview.types';
import type {
  ContactsView,
  ContactsViewCounts,
  ContactsViewState,
} from '../_lib/contacts-view';
import { exportClientsCsvAction } from '../_lib/server/client-import-actions';
import {
  listClientsOverview,
  pauseClientsCirculation,
} from '../_lib/server/server-actions';
import { ArchivedClientsList } from './archived-clients-list';
import {
  ClientCard,
  ClientListTableColGroup,
  ClientListTableHeader,
} from './client-card';
import { ClientCreateDialog } from './client-create-dialog';
import { ClientOverviewCard } from './client-overview-card';

type ViewMode = 'cards' | 'list';
type SortKey = 'name-asc' | 'name-desc' | 'recent' | 'projects' | 'disposals';

const DEFAULT_VIEW_STATE: ContactsViewState = { view: 'all', circ: null };

function viewStateKey(state: ContactsViewState) {
  return `${state.view}:${state.circ ?? ''}`;
}

const CIRCULATION_FILTER_OPTIONS: Array<{
  value: ContactCirculationFilter;
  label: string;
}> = [
  { value: 'subscribed', label: 'Subscribed' },
  { value: 'paused', label: 'Paused' },
  { value: 'not_subscribed', label: 'Not subscribed' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
];

const EMPTY_VIEW_COPY: Record<Exclude<ContactsView, 'all'>, string> = {
  requirements: 'No contacts match this filter.',
  newsletter:
    'No newsletter subscribers yet. People who join from a mailing-list form appear here and stay on All contacts.',
  attention: 'Nothing needs attention right now.',
};

const panelToolbarClass =
  'border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

function favoritesStorageKey(accountId: string) {
  return `keel-client-favorites:${accountId}`;
}

function viewStorageKey(accountId: string) {
  return `keel-clients-view:${accountId}`;
}

function readFavorites(accountId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(favoritesStorageKey(accountId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeFavorites(accountId: string, ids: Set<string>) {
  window.localStorage.setItem(
    favoritesStorageKey(accountId),
    JSON.stringify([...ids]),
  );
}

function sortClients(items: ClientOverviewItem[], sort: SortKey) {
  const list = [...items];
  list.sort((a, b) => {
    if (sort === 'projects') {
      return (
        b.projectCount - a.projectCount ||
        a.displayName.localeCompare(b.displayName)
      );
    }
    if (sort === 'disposals') {
      return (
        b.disposalCount - a.disposalCount ||
        b.requirementCount - a.requirementCount ||
        a.displayName.localeCompare(b.displayName)
      );
    }
    if (sort === 'recent') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
    if (sort === 'name-desc') {
      return b.displayName.localeCompare(a.displayName);
    }
    return a.displayName.localeCompare(b.displayName);
  });
  return list;
}

function mergeClients(
  existing: ClientOverviewItem[],
  incoming: ClientOverviewItem[],
): ClientOverviewItem[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((client) => [client.id, client]));
  for (const client of incoming) {
    byId.set(client.id, client);
  }
  return [...byId.values()];
}

function clientMatchesSearch(
  client: ClientOverviewItem,
  query: string,
): boolean {
  const haystack = [
    client.displayName,
    client.companyName,
    client.email,
    client.city,
    client.tagline,
    client.commercialRole,
    client.phone,
    ...client.projects.map((project) => project.title),
    ...client.highlights.map((item) => item.title),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function ClientsPageContent({
  accountSlug,
  accountId,
  canViewClients,
  canEditClients,
  isContractorView: _isContractorView,
  initialOverview = [],
  initialTotal = 0,
  variant = 'work',
  pageTitle = 'Clients',
  hidePageTitle = false,
  addClientLabel = 'Add client',
  showCommercialRole = false,
  showLinkedInImport = true,
  initialViewState = DEFAULT_VIEW_STATE,
  initialCounts = null,
  campaignsEnabled = false,
}: {
  accountSlug: string;
  accountId: string;
  canViewClients: boolean;
  canEditClients: boolean;
  isContractorView: boolean;
  initialOverview?: ClientOverviewItem[];
  initialTotal?: number;
  variant?: 'work' | 'commercial';
  pageTitle?: string;
  hidePageTitle?: boolean;
  addClientLabel?: string;
  showCommercialRole?: boolean;
  showLinkedInImport?: boolean;
  initialViewState?: ContactsViewState;
  initialCounts?: ContactsViewCounts | null;
  /** Email Campaigns add-on. The Newsletter view stays hidden when off. */
  campaignsEnabled?: boolean;
}) {
  const isCommercial = variant === 'commercial';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pageClients, setPageClients] =
    useState<ClientOverviewItem[]>(initialOverview);
  const [cachedClients, setCachedClients] =
    useState<ClientOverviewItem[]>(initialOverview);
  const [total, setTotal] = useState(Number(initialTotal) || 0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [enrichingSearch, setEnrichingSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showArchived, setShowArchived] = useState(false);
  const [viewState, setViewState] =
    useState<ContactsViewState>(initialViewState);
  const [counts, setCounts] = useState<ContactsViewCounts | null>(
    initialCounts,
  );
  const viewKey = viewStateKey(viewState);
  const initialViewKey = viewStateKey(initialViewState);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [members, setMembers] = useState<
    Array<{ user_id: string; name: string | null; picture_url?: string | null }>
  >([]);
  const pageSize = 20;

  const clientsBasePath = pathsConfig.app.accountClients.replace(
    '[account]',
    accountSlug,
  );

  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await exportClientsCsvAction({ accountId });
      const url = URL.createObjectURL(
        new Blob([result.csv], { type: 'text/csv;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.count} clients`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not export clients',
      );
    } finally {
      setExporting(false);
    }
  };

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormInitialValues, setCreateFormInitialValues] = useState<
    { first_name: string; company_name: string } | undefined
  >(undefined);

  useEffect(() => {
    setFavorites(readFavorites(accountId));
    const stored = window.localStorage.getItem(viewStorageKey(accountId));
    if (stored === 'cards' || stored === 'list') {
      setViewMode(stored);
    }
  }, [accountId]);

  useEffect(() => {
    if (search.trim() || searchDebounced.trim()) {
      return;
    }

    if (page !== 1) {
      return;
    }

    if (viewKey !== initialViewKey) {
      return;
    }

    setPageClients(initialOverview);
    setCachedClients(initialOverview);
    setTotal(Number(initialTotal) || 0);
  }, [
    viewKey,
    initialViewKey,
    initialOverview,
    initialTotal,
    page,
    search,
    searchDebounced,
  ]);

  useEffect(() => {
    listAccountMembers({ accountSlug })
      .then((data) => {
        setMembers(
          (data ?? []) as Array<{
            user_id: string;
            name: string | null;
            picture_url?: string | null;
          }>,
        );
      })
      .catch(() => {
        setMembers([]);
      });
  }, [accountSlug]);

  const fetchClientsPage = useCallback(
    async (pageNum: number) => {
      setLoadingPage(true);
      try {
        const result = await listClientsOverview({
          accountId,
          page: pageNum,
          pageSize,
          members,
          variant,
          view: viewState.view,
          circ: viewState.circ ?? undefined,
        });
        const list = Array.isArray((result as { data?: unknown })?.data)
          ? ((result as { data: ClientOverviewItem[] }).data ?? [])
          : [];
        const count =
          typeof (result as { total?: number })?.total === 'number'
            ? (result as { total: number }).total
            : 0;
        const nextCounts = (result as { counts?: ContactsViewCounts | null })
          ?.counts;
        if (nextCounts) setCounts(nextCounts);
        setPageClients(list);
        setCachedClients((current) => mergeClients(current, list));
        setTotal(count);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load clients');
      } finally {
        setLoadingPage(false);
      }
    },
    [accountId, pageSize, members, variant, viewState],
  );

  const refreshClients = useCallback(async () => {
    setPage(1);
    await fetchClientsPage(1);
  }, [fetchClientsPage]);

  useEffect(() => {
    if (search.trim() || searchDebounced.trim()) {
      return;
    }

    const isDefaultFirstPage = page === 1;

    if (
      isDefaultFirstPage &&
      initialOverview.length > 0 &&
      viewKey === initialViewKey
    ) {
      return;
    }

    void fetchClientsPage(page);
  }, [
    page,
    search,
    searchDebounced,
    fetchClientsPage,
    initialOverview.length,
    viewKey,
    initialViewKey,
  ]);

  useEffect(() => {
    const query = searchDebounced.trim().toLowerCase();
    if (!query) {
      setEnrichingSearch(false);
      return;
    }

    let cancelled = false;

    const enrichFromServer = async () => {
      setEnrichingSearch(true);
      try {
        let nextPage = 1;
        let serverTotal = 0;

        while (!cancelled) {
          const result = await listClientsOverview({
            accountId,
            search: searchDebounced.trim(),
            page: nextPage,
            pageSize,
            members,
            variant,
            view: viewState.view,
            circ: viewState.circ ?? undefined,
          });
          const list = Array.isArray((result as { data?: unknown })?.data)
            ? ((result as { data: ClientOverviewItem[] }).data ?? [])
            : [];
          serverTotal =
            typeof (result as { total?: number })?.total === 'number'
              ? (result as { total: number }).total
              : list.length;

          if (!cancelled && list.length > 0) {
            setCachedClients((current) => mergeClients(current, list));
          }

          if (list.length < pageSize || nextPage * pageSize >= serverTotal) {
            break;
          }

          nextPage += 1;
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : 'Failed to search clients',
          );
        }
      } finally {
        if (!cancelled) {
          setEnrichingSearch(false);
        }
      }
    };

    void enrichFromServer();

    return () => {
      cancelled = true;
    };
  }, [accountId, searchDebounced, pageSize, members, variant, viewState]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openClient = (clientId: string) => {
    router.push(`${clientsBasePath}/${clientId}`);
  };

  const openCreate = () => {
    setCreateFormInitialValues(undefined);
    setCreateDialogOpen(true);
  };

  const closeCreate = () => {
    setCreateDialogOpen(false);
    setCreateFormInitialValues(undefined);
    void refreshClients();
  };

  useEffect(() => {
    if (!canEditClients || searchParams.get('create') !== 'client') {
      return;
    }

    setCreateFormInitialValues({
      first_name: searchParams.get('first_name') ?? '',
      company_name: searchParams.get('company_name') ?? '',
    });
    setCreateDialogOpen(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    nextParams.delete('first_name');
    nextParams.delete('company_name');
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextPath, { scroll: false });
  }, [canEditClients, pathname, router, searchParams]);

  const searchQuery = search.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;
  const searchPending =
    isSearching &&
    (search.trim() !== searchDebounced.trim() || enrichingSearch);

  const displayedClients = useMemo(() => {
    if (isSearching) {
      const matches = cachedClients.filter((client) =>
        clientMatchesSearch(client, searchQuery),
      );
      return sortClients(matches, sort);
    }

    return sortClients(pageClients, sort);
  }, [cachedClients, isSearching, pageClients, searchQuery, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const toggleFavorite = (clientId: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      writeFavorites(accountId, next);
      return next;
    });
  };

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(viewStorageKey(accountId), mode);
  };

  const changeView = (next: ContactsViewState) => {
    if (viewStateKey(next) === viewKey) return;
    setViewState(next);
    setSelectedIds(new Set());
    setPageClients([]);
    setCachedClients([]);
    setPage(1);
    setShowArchived(false);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('list');
    if (next.view === 'all') {
      nextParams.delete('view');
    } else {
      nextParams.set('view', next.view);
    }
    if (next.circ) {
      nextParams.set('circ', next.circ);
    } else {
      nextParams.delete('circ');
    }
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;
    router.replace(nextPath, { scroll: false });
  };

  const viewOptions: Array<{
    value: ContactsView;
    label: string;
    count: number | null;
  }> = [
    {
      value: 'all',
      label: isCommercial ? 'All contacts' : 'All clients',
      count: counts?.all ?? null,
    },
    ...(isCommercial
      ? [
          {
            value: 'requirements' as const,
            label: 'With requirements',
            count: counts?.requirements ?? null,
          },
        ]
      : []),
    ...(campaignsEnabled
      ? [
          {
            value: 'newsletter' as const,
            label: 'Newsletter',
            count: counts?.newsletter ?? null,
          },
        ]
      : []),
    ...(isCommercial &&
    ((counts?.attention ?? 0) > 0 || viewState.view === 'attention')
      ? [
          {
            value: 'attention' as const,
            label: 'Needs attention',
            count: counts?.attention ?? null,
          },
        ]
      : []),
  ];

  const selectable = isCommercial && canEditClients && viewMode === 'list';
  const visibleIds = displayedClients.map((client) => client.id);
  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id));
  const headerSelection = selectable
    ? {
        state:
          selectedVisible.length === 0
            ? false
            : selectedVisible.length === visibleIds.length
              ? true
              : ('indeterminate' as const),
        onChange: (checked: boolean) =>
          setSelectedIds(checked ? new Set(visibleIds) : new Set()),
      }
    : undefined;

  const toggleSelected = (clientId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(clientId);
      else next.delete(clientId);
      return next;
    });
  };

  const pauseSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkPending(true);
    try {
      await pauseClientsCirculation({
        accountId,
        clientIds: [...selectedIds],
      });
      toast.success(
        `Automatic emails paused for ${selectedIds.size} contact${
          selectedIds.size === 1 ? '' : 's'
        }`,
      );
      setSelectedIds(new Set());
      await fetchClientsPage(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pause emails');
    } finally {
      setBulkPending(false);
    }
  };

  if (!canViewClients) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-[var(--workspace-shell-text-muted)]">
          You don&apos;t have access to clients in this account.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden',
        !isCommercial &&
          'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
        {hidePageTitle ? (
          <span className="sr-only">{pageTitle}</span>
        ) : (
          <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">
            {pageTitle}
          </h1>
        )}
        {canEditClients ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]"
              asChild
            >
              <Link
                href={pathsConfig.app.accountClientsImport.replace(
                  '[account]',
                  accountSlug,
                )}
                data-test="import-clients-csv-button"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import CSV
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]"
              disabled={exporting}
              onClick={() => void exportCsv()}
              data-test="export-clients-csv-button"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {showLinkedInImport ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-xs text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]"
                asChild
              >
                <Link
                  href={pathsConfig.app.accountLinkedInImport.replace(
                    '[account]',
                    accountSlug,
                  )}
                  data-test="import-clients-linkedin-button"
                >
                  <Linkedin className="mr-1.5 h-3.5 w-3.5" />
                  LinkedIn
                </Link>
              </Button>
            ) : null}
            <Button
              size="sm"
              className="h-8 bg-[var(--ozer-accent)] text-xs hover:bg-[var(--ozer-accent-hover)]"
              onClick={openCreate}
              data-test="add-client-button"
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              {addClientLabel}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-5">
        {viewOptions.length > 1 ? (
          <div
            className={cn(
              'inline-flex flex-wrap rounded-lg p-1',
              panelToolbarClass,
            )}
            role="tablist"
            aria-label={isCommercial ? 'Contact views' : 'Client views'}
          >
            {viewOptions.map((option) => {
              const active = viewState.view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-test={`contacts-view-${option.value}`}
                  onClick={() => changeView({ view: option.value, circ: null })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]'
                      : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                    option.value === 'attention' &&
                      !active &&
                      'text-amber-700 dark:text-amber-300',
                  )}
                >
                  {option.label}
                  {option.count !== null ? (
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        active ? 'opacity-70' : 'opacity-60',
                      )}
                    >
                      {option.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
          <Input
            placeholder={
              isCommercial
                ? 'Search contacts...'
                : 'Search clients or projects...'
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)] focus-visible:ring-[var(--ozer-accent)]"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((current) => !current)}
          className={cn(
            'border',
            showArchived
              ? 'border-transparent bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-plum-900)] hover:text-[var(--ozer-text-on-dark)]'
              : 'border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)]',
          )}
        >
          <Archive className="mr-1 h-4 w-4" />
          Archived
        </Button>

        <Select
          value={sort}
          onValueChange={(value) => setSort(value as SortKey)}
        >
          <SelectTrigger
            className={cn(
              'w-full border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] sm:w-[160px]',
              panelToolbarClass,
            )}
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
            <SelectItem value="name-asc">Sort: A–Z</SelectItem>
            <SelectItem value="name-desc">Sort: Z–A</SelectItem>
            <SelectItem value="recent">Recently updated</SelectItem>
            {isCommercial ? (
              <SelectItem value="disposals">Most disposals</SelectItem>
            ) : (
              <SelectItem value="projects">Most projects</SelectItem>
            )}
          </SelectContent>
        </Select>

        <div className={cn('inline-flex rounded-lg p-1', panelToolbarClass)}>
          <button
            type="button"
            onClick={() => setView('cards')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
              viewMode === 'cards'
                ? 'bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
            aria-pressed={viewMode === 'cards'}
            aria-label="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
              viewMode === 'list'
                ? 'bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewState.view === 'requirements' && !showArchived ? (
        <div
          className="flex flex-wrap items-center gap-1.5 px-4 pb-3 md:px-5"
          role="group"
          aria-label="Circulation status"
        >
          <span className="mr-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Circulation:
          </span>
          {[
            {
              value: null,
              label: 'Any',
              count: counts?.requirements ?? null,
            },
            ...CIRCULATION_FILTER_OPTIONS.map((option) => ({
              ...option,
              count: counts?.circulation[option.value] ?? null,
            })),
          ].map((option) => {
            const active = viewState.circ === option.value;
            return (
              <button
                key={option.value ?? 'any'}
                type="button"
                aria-pressed={active}
                data-test={`contacts-circ-${option.value ?? 'any'}`}
                onClick={() =>
                  changeView({ view: 'requirements', circ: option.value })
                }
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                  active
                    ? 'border-transparent bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]'
                    : 'border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {option.label}
                {option.count !== null ? (
                  <span className="tabular-nums opacity-70">
                    {option.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {selectable && selectedIds.size > 0 && !showArchived ? (
        <div
          className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-sm md:mx-5"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="font-medium text-[var(--workspace-shell-text)]">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={bulkPending}
            onClick={() => void pauseSelected()}
            data-test="contacts-bulk-pause"
            className="h-7 text-xs"
          >
            {bulkPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Pause automatic emails
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="h-7 text-xs text-[var(--workspace-shell-text-muted)]"
          >
            Clear
          </Button>
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            To subscribe someone, open their contact and choose a lawful basis.
          </span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-5 md:pb-5">
        {showArchived ? (
          <ArchivedClientsList
            accountId={accountId}
            canEditClients={canEditClients}
            onRestored={() => void refreshClients()}
            terminology={isCommercial ? 'commercial' : 'default'}
          />
        ) : displayedClients.length === 0 && (loadingPage || searchPending) ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--workspace-shell-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isSearching ? 'Searching…' : <Trans i18nKey="common:loading" />}
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            {isSearching
              ? isCommercial
                ? 'No contacts match your search.'
                : 'No clients match your search.'
              : viewState.view !== 'all'
                ? EMPTY_VIEW_COPY[viewState.view]
                : isCommercial
                  ? 'No contacts yet. Add your first contact to get started.'
                  : 'No clients yet. Add your first client to get started.'}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayedClients.map((client) => (
              <ClientOverviewCard
                key={client.id}
                client={client}
                accountSlug={accountSlug}
                variant={variant}
                showNewsletter={campaignsEnabled}
                isFavorite={favorites.has(client.id)}
                onToggleFavorite={() => toggleFavorite(client.id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
            <table className="w-full table-fixed border-collapse text-sm">
              <ClientListTableColGroup
                variant={variant}
                selectable={selectable}
              />
              <ClientListTableHeader
                variant={variant}
                selection={headerSelection}
              />
              <tbody>
                {displayedClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    id={client.id}
                    display_name={client.displayName}
                    company_name={client.companyName}
                    tagline={
                      isCommercial
                        ? [client.commercialRole, client.city]
                            .filter(Boolean)
                            .join(' · ') || client.tagline
                        : client.tagline
                    }
                    email={client.email}
                    city={client.city}
                    picture_url={client.pictureUrl}
                    updated_at={client.updatedAt}
                    projectCount={client.projectCount}
                    dueTaskCount={client.dueTaskCount}
                    disposalCount={client.disposalCount}
                    requirementCount={client.requirementCount}
                    viewingCount={client.viewingCount}
                    leaseCount={client.leaseCount}
                    clientType={client.clientType}
                    variant={variant}
                    comms={client.comms}
                    showNewsletter={campaignsEnabled}
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={
                      selectable
                        ? (checked) => toggleSelected(client.id, checked)
                        : undefined
                    }
                    selected={selectedIds.has(client.id)}
                    onSelect={() => openClient(client.id)}
                    detailHref={`${clientsBasePath}/${client.id}`}
                    onNotes={() => openClient(client.id)}
                    onEmail={
                      client.email
                        ? () => window.open(`mailto:${client.email}`, '_blank')
                        : undefined
                    }
                    onCall={
                      client.phone
                        ? () => window.open(`tel:${client.phone}`, '_blank')
                        : undefined
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showArchived && searchPending && displayedClients.length > 0 ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-[var(--workspace-shell-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </p>
        ) : null}

        {!showArchived && !isSearching && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm text-[var(--workspace-shell-text-muted)]">
            <span>
              Page {page} of {totalPages} ({total}{' '}
              {isCommercial ? 'contacts' : 'clients'})
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ClientCreateDialog
        open={createDialogOpen}
        onOpenChange={(open) => !open && closeCreate()}
        accountId={accountId}
        accountSlug={accountSlug}
        createInitialValues={createFormInitialValues}
        onSaved={closeCreate}
        showCommercialRole={showCommercialRole}
        showLinkedInImport={showLinkedInImport}
      />
    </div>
  );
}
