'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ChevronDown, Filter, PlusCircle, Search, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Sheet,
  SheetContent,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';

import { listClients } from '../_lib/server/server-actions';
import { ClientCard } from './client-card';
import { ClientDetailDrawer } from './client-detail-drawer';
import { ClientDetailSidebar } from './client-detail-sidebar';

type ClientRow = {
  id: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
};

type ListTab = 'list' | 'activity' | 'documents' | 'notes';

export function ClientsPageContent({
  accountSlug,
  accountId,
  canViewClients,
  canEditClients,
  isContractorView,
}: {
  accountSlug: string;
  accountId: string;
  canViewClients: boolean;
  canEditClients: boolean;
  isContractorView: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [activeListTab, setActiveListTab] = useState<ListTab>('list');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createNew, setCreateNew] = useState(false);
  const [createFormInitialValues, setCreateFormInitialValues] = useState<
    { first_name: string; company_name: string } | undefined
  >(undefined);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listClients({
        accountId,
        search: searchDebounced || undefined,
        page,
        pageSize,
      });
      // Server returns { data: ClientRow[], total: number }
      const list = Array.isArray((result as { data?: unknown })?.data)
        ? ((result as { data: ClientRow[] }).data ?? [])
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
  }, [accountId, searchDebounced, page, pageSize]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

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
    fetchClients();
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
        {/* Tabs + header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveListTab('list')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeListTab === 'list'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Client List
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('activity')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeListTab === 'activity'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              Activity Timeline
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('documents')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeListTab === 'documents'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              Recent Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('notes')}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeListTab === 'notes'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              Notes & Voice
            </button>
          </div>

          <If condition={canEditClients}>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => openDetail(null)}
              data-test="add-client-button"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </If>
        </div>

        {/* Toolbar: search, sort, filter */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-700 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="text-zinc-500 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Start typing..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-9 text-white placeholder:text-zinc-500 focus-visible:ring-emerald-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-300 hover:bg-[var(--workspace-shell-panel-hover)]"
          >
            Sort by
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-300 hover:bg-[var(--workspace-shell-panel-hover)]"
          >
            <Filter className="mr-1 h-4 w-4" />
            Filter
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeListTab === 'list' && (
            <>
              {loading ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  <Trans i18nKey="common:loading" />
                </div>
              ) : clients.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  {searchDebounced
                    ? 'No clients match your search.'
                    : 'No clients yet. Add your first client to get started.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <ClientCard
                      key={client.id}
                      id={client.id}
                      display_name={client.display_name}
                      company_name={client.company_name}
                      email={client.email}
                      city={client.city}
                      updated_at={client.updated_at}
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
                <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
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
            </>
          )}
          {activeListTab !== 'list' && (
            <div className="py-12 text-center text-sm text-zinc-500">
              Coming soon.
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar (desktop): visible when a client is selected */}
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

      {/* Sheet: "Add Client" on all screens; client detail on mobile only (desktop uses sidebar) */}
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
