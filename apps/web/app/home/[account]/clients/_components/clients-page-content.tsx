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
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { listAccountMembers } from '../../jobs/_lib/server/server-actions';
import type { ClientOverviewItem } from '../_lib/clients-overview.types';
import { listClientsOverview } from '../_lib/server/server-actions';
import { ClientCard } from './client-card';
import { ClientDetailDrawer } from './client-detail-drawer';
import { ClientDetailSidebar } from './client-detail-sidebar';
import { ClientOverviewCard } from './client-overview-card';

type ViewMode = 'cards' | 'list';
type SortKey = 'name-asc' | 'name-desc' | 'recent' | 'projects';

const panelToolbarClass =
  'border border-white/[0.08] bg-[var(--workspace-shell-panel)]';

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

export function ClientsPageContent({
  accountSlug,
  accountId,
  canViewClients,
  canEditClients,
  isContractorView,
  initialOverview = [],
  initialTotal = 0,
}: {
  accountSlug: string;
  accountId: string;
  canViewClients: boolean;
  canEditClients: boolean;
  isContractorView: boolean;
  initialOverview?: ClientOverviewItem[];
  initialTotal?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [clients, setClients] = useState<ClientOverviewItem[]>(initialOverview);
  const [total, setTotal] = useState(Number(initialTotal) || 0);
  const [loading, setLoading] = useState(false);
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

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createNew, setCreateNew] = useState(false);
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

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listClientsOverview({
        accountId,
        search: searchDebounced || undefined,
        page,
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
      setClients(list);
      setTotal(count);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load clients');
      setClients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, searchDebounced, page, pageSize, members]);

  useEffect(() => {
    if (page === 1 && !searchDebounced && members.length === 0) {
      return;
    }

    void fetchClients();
  }, [accountId, searchDebounced, page, pageSize, members, fetchClients]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (isDesktop && selectedClientId && !createNew) setDrawerOpen(false);
  }, [isDesktop, selectedClientId, createNew]);

  const openDetail = (clientId: string | null) => {
    setSelectedClientId(clientId);
    setCreateNew(!clientId);
    setDrawerOpen(true);
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    setSelectedClientId(null);
    setCreateNew(false);
    setCreateFormInitialValues(undefined);
    void fetchClients();
  };

  useEffect(() => {
    if (!canEditClients || searchParams.get('create') !== 'client') {
      return;
    }

    setCreateFormInitialValues({
      first_name: searchParams.get('first_name') ?? '',
      company_name: searchParams.get('company_name') ?? '',
    });
    openDetail(null);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    nextParams.delete('first_name');
    nextParams.delete('company_name');
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextPath, { scroll: false });
  }, [canEditClients, pathname, router, searchParams]);

  const sortedClients = useMemo(
    () => sortClients(clients, sort),
    [clients, sort],
  );

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!canViewClients) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">
          You don&apos;t have access to clients in this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700 px-4 py-4 md:px-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Projects / Clients Overview
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Active client accounts and delivery health
            </p>
          </div>

          <If condition={canEditClients}>
            <Button
              size="sm"
              className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
              onClick={() => openDetail(null)}
              data-test="add-client-button"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </If>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-700 p-4 md:px-6">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search clients or projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-[var(--keel-teal)]"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-300 hover:bg-[var(--workspace-shell-panel-hover)]"
          >
            <Filter className="mr-1 h-4 w-4" />
            Filter
          </Button>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              className={cn(
                'w-full border-white/10 text-white sm:w-[160px]',
                panelToolbarClass,
              )}
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0F1B35] text-white">
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
                  ? 'bg-[var(--keel-accent-blue)] text-white'
                  : 'text-zinc-400 hover:text-white',
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
                  ? 'bg-[var(--keel-accent-blue)] text-white'
                  : 'text-zinc-400 hover:text-white',
              )}
              aria-pressed={viewMode === 'list'}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              <Trans i18nKey="common:loading" />
            </div>
          ) : sortedClients.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              {searchDebounced
                ? 'No clients match your search.'
                : 'No clients yet. Add your first client to get started.'}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedClients.map((client) => (
                <ClientOverviewCard
                  key={client.id}
                  client={client}
                  accountSlug={accountSlug}
                  isFavorite={favorites.has(client.id)}
                  onToggleFavorite={() => toggleFavorite(client.id)}
                  onSelect={() => openDetail(client.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedClients.map((client) => (
                <ClientCard
                  key={client.id}
                  id={client.id}
                  display_name={client.displayName}
                  company_name={client.companyName}
                  email={client.email}
                  city={client.city}
                  updated_at={client.updatedAt}
                  projectCount={client.projectCount}
                  dueTaskCount={client.dueTaskCount}
                  selected={selectedClientId === client.id}
                  onSelect={() => openDetail(client.id)}
                  detailHref={`${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${client.id}`}
                  onNotes={() => openDetail(client.id)}
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
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Page {page} of {totalPages} ({total} clients)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-600 text-zinc-400"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-600 text-zinc-400"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <If condition={selectedClientId && !createNew}>
        <div className="hidden md:block">
          <ClientDetailSidebar
            accountSlug={accountSlug}
            accountId={accountId}
            clientId={selectedClientId!}
            canEditClients={canEditClients}
            isContractorView={isContractorView}
            onClose={closeDetail}
            onSaved={closeDetail}
            onDeleted={closeDetail}
          />
        </div>
      </If>

      <ClientDetailDrawer
        open={drawerOpen && (createNew || !isDesktop)}
        onOpenChange={(open) => !open && closeDetail()}
        accountSlug={accountSlug}
        accountId={accountId}
        clientId={createNew ? null : selectedClientId}
        createNew={createNew}
        createInitialValues={createFormInitialValues}
        canEditClients={canEditClients}
        isContractorView={isContractorView}
        onSaved={closeDetail}
        onDeleted={closeDetail}
      />
    </div>
  );
}
