'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { FileSignature, PlusCircle, RefreshCw, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';

import { getErrorMessage } from '../_lib/error-message';
import {
  createContract,
  getContractTabCountsAction,
  listContracts,
} from '../_lib/server/server-actions';
import { ContractRowMenu } from './contract-row-menu';
import { ContractStatusBadge } from './contract-status-badge';

type ContractRow = {
  id: string;
  title: string | null;
  status: string;
  total_pence: number;
  currency: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  author_signed_at: string | null;
  recipient_signed_at: string | null;
  payment_plan?: unknown;
  clients: { display_name: string | null } | null;
};

type TabKey = 'unsigned' | 'draft' | 'all';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ContractsPageContent({
  accountSlug,
  accountId,
  canViewContracts,
  canEditContracts,
  canManageContractStatus,
}: {
  accountSlug: string;
  accountId: string;
  canViewContracts: boolean;
  canEditContracts: boolean;
  canManageContractStatus: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>('unsigned');
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ draft: 0, unsigned: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [clientOptions, setClientOptions] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const pageSize = 20;

  const fetchCounts = useCallback(async () => {
    try {
      const result = await getContractTabCountsAction({ accountId });
      setCounts(result as typeof counts);
    } catch {
      /* ignore */
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => {
        const raw = result as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClientOptions(
          (list ?? []) as { id: string; display_name: string | null }[],
        );
      })
      .catch(() => setClientOptions([]));
  }, [accountId]);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const statusMap: Record<TabKey, 'unsigned' | 'draft' | 'all'> = {
        unsigned: 'unsigned',
        draft: 'draft',
        all: 'all',
      };
      const result = await listContracts({
        accountId,
        page,
        pageSize,
        query: searchDebounced || undefined,
        status: statusMap[tab],
        clientId: clientFilter || undefined,
      });
      if (result?.data !== undefined) {
        setContracts((result.data ?? []) as unknown as ContractRow[]);
        setTotal(result.total ?? 0);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setContracts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientFilter, page, pageSize, searchDebounced, tab]);

  useEffect(() => {
    void fetchContracts();
    void fetchCounts();
  }, [fetchContracts, fetchCounts]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreateSheet = useCallback(async () => {
    setCreateSheetOpen(true);
    setSelectedClientId('');
    setClientsLoading(true);
    try {
      const result = await listClients({ accountId, page: 1, pageSize: 100 });
      const raw = result as { data?: unknown } | unknown[];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: unknown })?.data)
          ? (raw as { data: unknown[] }).data
          : [];
      const options = (list ?? []) as {
        id: string;
        display_name: string | null;
      }[];
      setClientOptions(options);
      if (options.length > 0) setSelectedClientId(options[0]!.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setClientOptions([]);
    } finally {
      setClientsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!canEditContracts || searchParams.get('create') !== 'contract') return;
    void openCreateSheet();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams}` : pathname,
      {
        scroll: false,
      },
    );
  }, [canEditContracts, openCreateSheet, pathname, router, searchParams]);

  const handleCreateContract = async () => {
    if (!canEditContracts || !selectedClientId) {
      toast.error('Please select a client');
      return;
    }
    setCreating(true);
    try {
      const contract = await createContract({
        accountId,
        client_id: selectedClientId,
      });
      if (contract?.id) {
        setCreateSheetOpen(false);
        router.push(
          pathsConfig.app.accountContractEdit
            .replace('[account]', accountSlug)
            .replace('[id]', contract.id),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const editPathBase = pathsConfig.app.accountContractEdit.replace(
    '[account]',
    accountSlug,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'unsigned', label: 'Unsigned', count: counts.unsigned },
    { key: 'draft', label: 'Draft', count: counts.draft },
    { key: 'all', label: 'All contracts', count: counts.all },
  ];

  if (!canViewContracts) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-[var(--workspace-shell-text-muted)]">
          You don&apos;t have access to contracts in this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6">
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] p-4">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/80 p-1 text-xs">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                  tab === item.key
                    ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
                }`}
              >
                {item.label}
                {item.count != null ? ` (${item.count})` : ''}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchContracts()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <If condition={canEditContracts}>
              <Button
                size="sm"
                className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
                onClick={openCreateSheet}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create contract
              </Button>
            </If>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div className="relative max-w-sm min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <Input
              placeholder="Search title or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="min-w-[200px]">
            <ClientCombobox
              clients={
                clientOptions.length
                  ? clientOptions
                  : [{ id: '', display_name: 'All clients' }]
              }
              value={clientFilter}
              onValueChange={setClientFilter}
              loading={false}
              placeholder="Filter by client"
              emptyMessage="No clients"
              addClientHref={pathsConfig.app.accountClients.replace(
                '[account]',
                accountSlug,
              )}
            />
          </div>
          {(search || clientFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setClientFilter('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="overflow-auto p-4">
          {loading ? (
            <p className="text-[var(--workspace-shell-text-muted)]">Loading…</p>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[var(--workspace-shell-text-muted)]">
              <FileSignature className="mb-3 h-10 w-10 opacity-50" />
              No contracts in this tab.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[var(--workspace-shell-text-muted)]">
                  <th className="pr-4 pb-2">Title</th>
                  <th className="pr-4 pb-2">Client</th>
                  <th className="pr-4 pb-2">Created</th>
                  <th className="pr-4 pb-2">Sent</th>
                  <th className="pr-4 pb-2">Total</th>
                  <th className="pr-4 pb-2">Status</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[color:var(--workspace-shell-border)] hover:bg-white/3"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={editPathBase.replace('[id]', row.id)}
                        className="font-medium text-[var(--workspace-shell-text)] hover:underline"
                      >
                        {row.title?.trim() || 'Agreement'}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {row.clients?.display_name ?? '—'}
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatDate(row.sent_at)}
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatPence(
                        row.total_pence,
                        row.currency?.toUpperCase() ?? 'GBP',
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <ContractStatusBadge
                        status={row.status}
                        authorSignedAt={row.author_signed_at}
                        recipientSignedAt={row.recipient_signed_at}
                      />
                    </td>
                    <td className="py-3">
                      <ContractRowMenu
                        accountId={accountId}
                        accountSlug={accountSlug}
                        contract={row}
                        canEditContracts={canEditContracts}
                        canManageContractStatus={canManageContractStatus}
                        onChanged={fetchContracts}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && total > 0 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--workspace-shell-text-muted)]">
              <span>
                Page {page} of {totalPages} ({total} contracts)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create contract</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Client</Label>
              <ClientCombobox
                clients={clientOptions}
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                loading={clientsLoading}
                placeholder="Select client"
                emptyMessage="No clients"
                addClientHref={pathsConfig.app.accountClients.replace(
                  '[account]',
                  accountSlug,
                )}
              />
            </div>
            <Button
              className="w-full bg-[var(--ozer-accent)] text-[#09111F]"
              onClick={handleCreateContract}
              disabled={creating || !selectedClientId}
            >
              {creating ? 'Creating…' : 'Create and edit'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
