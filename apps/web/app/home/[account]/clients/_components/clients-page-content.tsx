'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Filter,
  LayoutGrid,
  List,
  PlusCircle,
  Search,
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
import { Sheet, SheetContent } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { listAccountMembers } from '../../jobs/_lib/server/server-actions';
import type { ClientOverviewItem } from '../_lib/clients-overview.types';
import { listClientsOverview } from '../_lib/server/server-actions';
import { ClientCard, ClientListTableColGroup, ClientListTableHeader } from './client-card';
import { ClientDetailDrawer } from './client-detail-drawer';
import { ClientOverviewCard } from './client-overview-card';

type ViewMode = 'cards' | 'list';
type SortKey = 'name-asc' | 'name-desc' | 'recent' | 'projects';

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
      return b.projectCount - a.projectCount || a.displayName.localeCompare(b.displayName);
    }
    if (sort === 'recent') {
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
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

function clientMatchesSearch(client: ClientOverviewItem, query: string): boolean {
  const haystack = [
    client.displayName,
    client.companyName,
    client.email,
    client.city,
    client.tagline,
    client.phone,
    ...client.projects.map((project) => project.title),
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
  isContractorView,
  initialOverview = [],
  initialTotal = 0,
  pageTitle = 'Clients',
  addClientLabel = 'Add client',
}: {
  accountSlug: string;
  accountId: string;
  canViewClients: boolean;
  canEditClients: boolean;
  isContractorView: boolean;
  initialOverview?: ClientOverviewItem[];
  initialTotal?: number;
  pageTitle?: string;
  addClientLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pageClients, setPageClients] = useState<ClientOverviewItem[]>(initialOverview);
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
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [members, setMembers] = useState<
    Array<{ user_id: string; name: string | null; picture_url?: string | null }>
  >([]);
  const pageSize = 20;

  const clientsBasePath = pathsConfig.app.accountClients.replace(
    '[account]',
    accountSlug,
  );

  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
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
        });
        const list = Array.isArray((result as { data?: unknown })?.data)
          ? ((result as { data: ClientOverviewItem[] }).data ?? [])
          : [];
        const count =
          typeof (result as { total?: number })?.total === 'number'
            ? (result as { total: number }).total
            : 0;
        setPageClients(list);
        setCachedClients((current) => mergeClients(current, list));
        setTotal(count);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load clients');
      } finally {
        setLoadingPage(false);
      }
    },
    [accountId, pageSize, members],
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

    if (isDefaultFirstPage && initialOverview.length > 0) {
      return;
    }

    void fetchClientsPage(page);
  }, [page, search, searchDebounced, fetchClientsPage, initialOverview.length]);

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
          toast.error(e instanceof Error ? e.message : 'Failed to search clients');
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
  }, [accountId, searchDebounced, pageSize, members]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openClient = (clientId: string) => {
    router.push(`${clientsBasePath}/${clientId}`);
  };

  const openCreate = () => {
    setCreateFormInitialValues(undefined);
    setCreateDrawerOpen(true);
  };

  const closeCreate = () => {
    setCreateDrawerOpen(false);
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
    setCreateDrawerOpen(true);

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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
        <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">{pageTitle}</h1>
        {canEditClients ? (
          <Button
            size="sm"
            className="h-8 bg-[var(--ozer-accent)] text-xs hover:bg-[var(--ozer-accent-hover)]"
            onClick={openCreate}
            data-test="add-client-button"
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            {addClientLabel}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <Input
              placeholder="Search clients or projects..."
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
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)]"
          >
            <Filter className="mr-1 h-4 w-4" />
            Filter
          </Button>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
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
              <SelectItem value="projects">Most projects</SelectItem>
            </SelectContent>
          </Select>

          <div
            className={cn(
              'inline-flex rounded-lg p-1',
              panelToolbarClass,
            )}
          >
            <button
              type="button"
              onClick={() => setView('cards')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition',
                viewMode === 'cards'
                  ? 'bg-[var(--keel-accent-blue)] text-[var(--workspace-shell-text)]'
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
                  ? 'bg-[var(--keel-accent-blue)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-5 md:pb-5">
          {loadingPage && displayedClients.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
              <Trans i18nKey="common:loading" />
            </div>
          ) : displayedClients.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--workspace-shell-text-muted)]">
              {isSearching
                ? 'No clients match your search.'
                : 'No clients yet. Add your first client to get started.'}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedClients.map((client) => (
                <ClientOverviewCard
                  key={client.id}
                  client={client}
                  accountSlug={accountSlug}
                  isFavorite={favorites.has(client.id)}
                  onToggleFavorite={() => toggleFavorite(client.id)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
              <table className="w-full table-fixed border-collapse text-sm">
                <ClientListTableColGroup />
                <ClientListTableHeader />
                <tbody>
                  {displayedClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      id={client.id}
                      display_name={client.displayName}
                      company_name={client.companyName}
                      email={client.email}
                      city={client.city}
                      picture_url={client.pictureUrl}
                      updated_at={client.updatedAt}
                      projectCount={client.projectCount}
                      dueTaskCount={client.dueTaskCount}
                      selected={false}
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

          {isSearching && enrichingSearch ? (
            <p className="mt-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              Finding more matches…
            </p>
          ) : null}

          {!isSearching && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm text-[var(--workspace-shell-text-muted)]">
              <span>
                Page {page} of {totalPages} ({total} clients)
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

      <ClientDetailDrawer
        open={createDrawerOpen}
        onOpenChange={(open) => !open && closeCreate()}
        accountId={accountId}
        createInitialValues={createFormInitialValues}
        canEditClients={canEditClients}
        onSaved={closeCreate}
      />
    </div>
  );
}
