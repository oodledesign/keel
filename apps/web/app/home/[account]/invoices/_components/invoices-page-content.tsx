'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { FileText, PlusCircle, RefreshCw, Repeat, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { If } from '@kit/ui/if';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';

import { formatPence } from '../_lib/invoice-totals';
import { getErrorMessage } from '../_lib/error-message';
import {
  createInvoice,
  getInvoiceSummaryAction,
  getInvoiceTabCountsAction,
  listInvoices,
  listRecurringSeriesAction,
  updateRecurringSeriesStatusAction,
} from '../_lib/server/server-actions';
import type { ListInvoicesInput } from '../_lib/schema/invoices.schema';
import { InvoiceRowMenu } from './invoice-row-menu';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { InvoicesIncomeSummary } from './invoices-income-summary';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  issued_at: string | null;
  total_pence: number;
  amount_paid_pence?: number;
  recurring_series_id?: string | null;
  updated_at: string;
  clients: { display_name: string | null } | null;
};

type TabKey = 'unpaid' | 'draft' | 'all' | 'recurring';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function InvoicesPageContent({
  accountSlug,
  accountId,
  canViewInvoices,
  canEditInvoices,
  canManageInvoiceStatus,
  initialInvoices,
  initialTotal,
  initialCounts,
  initialSummary,
  initialClients,
}: {
  accountSlug: string;
  accountId: string;
  canViewInvoices: boolean;
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
  initialInvoices?: InvoiceRow[];
  initialTotal?: number;
  initialCounts?: {
    draft: number;
    unpaid: number;
    all: number;
    recurring: number;
  };
  initialSummary?: Awaited<ReturnType<typeof getInvoiceSummaryAction>> | null;
  initialClients?: { id: string; display_name: string | null }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>('unpaid');
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices ?? []);
  const [recurring, setRecurring] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [counts, setCounts] = useState(
    initialCounts ?? { draft: 0, unpaid: 0, all: 0, recurring: 0 },
  );
  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof getInvoiceSummaryAction>> | null
  >(initialSummary ?? null);
  const [summaryPeriod, setSummaryPeriod] = useState<'month_to_date' | 'last_30_days' | 'last_90_days'>('month_to_date');
  const [loading, setLoading] = useState(initialInvoices === undefined);
  const skipInitialFetchRef = useRef(initialInvoices !== undefined);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [clientFilter, setClientFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [clientOptions, setClientOptions] = useState<
    { id: string; display_name: string | null }[]
  >(initialClients ?? []);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const pageSize = 20;

  const fetchCounts = useCallback(async () => {
    try {
      const result = await getInvoiceTabCountsAction({ accountId });
      setCounts(result as typeof counts);
    } catch {
      /* ignore */
    }
  }, [accountId]);

  useEffect(() => {
    if (initialClients !== undefined) {
      return;
    }

    if (!accountId) return;
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => {
        const raw = result as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClientOptions((list ?? []) as { id: string; display_name: string | null }[]);
      })
      .catch(() => setClientOptions([]));
  }, [accountId, initialClients]);

  const fetchSummary = useCallback(async () => {
    try {
      const result = await getInvoiceSummaryAction({ accountId, period: summaryPeriod });
      setSummary(result as typeof summary);
    } catch {
      setSummary(null);
    }
  }, [accountId, summaryPeriod]);

  const fetchInvoices = useCallback(async () => {
    if (tab === 'recurring') {
      setLoading(true);
      try {
        const rows = await listRecurringSeriesAction({ accountId });
        setRecurring((rows ?? []) as Array<Record<string, unknown>>);
      } catch (error) {
        toast.error(getErrorMessage(error));
        setRecurring([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const statusMap: Record<TabKey, ListInvoicesInput['status'] | undefined> = {
        unpaid: 'unpaid',
        draft: 'draft',
        all: 'all',
        recurring: undefined,
      };
      const result = await listInvoices({
        accountId,
        page,
        pageSize,
        includeArchived: false,
        query: searchDebounced || undefined,
        status: statusMap[tab],
        clientId: clientFilter || undefined,
      });
      if (result?.data !== undefined) {
        setInvoices((result.data ?? []) as unknown as InvoiceRow[]);
        setTotal(result.total ?? 0);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientFilter, page, pageSize, searchDebounced, tab]);

  useEffect(() => {
    if (
      skipInitialFetchRef.current &&
      tab === 'unpaid' &&
      page === 1 &&
      !searchDebounced &&
      !clientFilter
    ) {
      skipInitialFetchRef.current = false;
      return;
    }

    void fetchInvoices();
    void fetchCounts();
  }, [fetchInvoices, fetchCounts, tab, page, searchDebounced, clientFilter]);

  useEffect(() => {
    if (skipInitialFetchRef.current && summaryPeriod === 'month_to_date' && initialSummary) {
      return;
    }

    void fetchSummary();
  }, [fetchSummary, initialSummary, summaryPeriod]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreateDialog = useCallback(async () => {
    setCreateDialogOpen(true);
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
      const options = (list ?? []) as { id: string; display_name: string | null }[];
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
    if (!canEditInvoices || searchParams.get('create') !== 'invoice') return;
    void openCreateDialog();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    router.replace(nextParams.toString() ? `${pathname}?${nextParams}` : pathname, {
      scroll: false,
    });
  }, [canEditInvoices, openCreateDialog, pathname, router, searchParams]);

  const handleCreateInvoice = async () => {
    if (!canEditInvoices || !selectedClientId) {
      toast.error('Please select a client');
      return;
    }
    setCreating(true);
    try {
      const invoice = await createInvoice({ accountId, client_id: selectedClientId });
      if (invoice?.id) {
        setCreateDialogOpen(false);
        router.push(
          pathsConfig.app.accountInvoiceEdit
            .replace('[account]', accountSlug)
            .replace('[id]', invoice.id),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const editPathBase = pathsConfig.app.accountInvoiceEdit.replace('[account]', accountSlug);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'unpaid', label: 'Unpaid', count: counts.unpaid },
    { key: 'draft', label: 'Draft', count: counts.draft },
    { key: 'all', label: 'All invoices', count: counts.all },
    { key: 'recurring', label: 'Recurring', count: counts.recurring },
  ];

  if (!canViewInvoices) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-[var(--workspace-shell-text-muted)]">You don&apos;t have access to invoices in this account.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-6">
      <InvoicesIncomeSummary
        summary={summary}
        period={summaryPeriod}
        onPeriodChange={setSummaryPeriod}
      />

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
            <Button variant="outline" size="sm" onClick={() => void fetchInvoices()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <If condition={canEditInvoices}>
              <Button
                size="sm"
                className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
                onClick={openCreateDialog}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create invoice
              </Button>
            </If>
          </div>
        </div>

        {tab !== 'recurring' ? (
          <div className="flex flex-wrap items-end gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
              <Input
                placeholder="Search invoice number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="min-w-[200px]">
              <ClientCombobox
                clients={clientOptions.length ? clientOptions : [{ id: '', display_name: 'All clients' }]}
                value={clientFilter}
                onValueChange={setClientFilter}
                loading={false}
                placeholder="Filter by client"
                emptyMessage="No clients"
                addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
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
        ) : null}

        <div className="overflow-auto p-4">
          {loading ? (
            <p className="text-[var(--workspace-shell-text-muted)]">Loading…</p>
          ) : tab === 'recurring' ? (
            recurring.length === 0 ? (
              <div className="py-12 text-center text-[var(--workspace-shell-text-muted)]">
                <Repeat className="mx-auto mb-3 h-10 w-10 opacity-50" />
                No recurring series yet. Create one from an invoice via Make recurring.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[var(--workspace-shell-text-muted)]">
                    <th className="pb-2 pr-4">Title</th>
                    <th className="pb-2 pr-4">Client</th>
                    <th className="pb-2 pr-4">Frequency</th>
                    <th className="pb-2 pr-4">Next issue</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((series) => (
                    <tr key={String(series.id)} className="border-t border-[color:var(--workspace-shell-border)]">
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text)]">{String(series.title ?? '—')}</td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                        {(series.clients as { display_name?: string | null } | null)?.display_name ?? '—'}
                      </td>
                      <td className="py-3 pr-4 capitalize text-[var(--workspace-shell-text-muted)]">{String(series.frequency ?? '')}</td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">{formatDate(String(series.next_issue_at ?? ''))}</td>
                      <td className="py-3 pr-4 capitalize text-[var(--workspace-shell-text-muted)]">{String(series.status ?? '')}</td>
                      <td className="py-3">
                        {canEditInvoices && series.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await updateRecurringSeriesStatusAction({
                                  accountId,
                                  seriesId: String(series.id),
                                  status: 'paused',
                                });
                                toast.success('Series paused');
                                void fetchInvoices();
                              } catch (error) {
                                toast.error(getErrorMessage(error));
                              }
                            }}
                          >
                            Pause
                          </Button>
                        ) : null}
                        {canEditInvoices && series.status === 'paused' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await updateRecurringSeriesStatusAction({
                                  accountId,
                                  seriesId: String(series.id),
                                  status: 'active',
                                });
                                toast.success('Series resumed');
                                void fetchInvoices();
                              } catch (error) {
                                toast.error(getErrorMessage(error));
                              }
                            }}
                          >
                            Resume
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-[var(--workspace-shell-text-muted)]">
              <FileText className="mb-3 h-10 w-10 opacity-50" />
              No invoices in this tab.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[var(--workspace-shell-text-muted)]">
                  <th className="pb-2 pr-4 w-8" />
                  <th className="pb-2 pr-4">Recipient</th>
                  <th className="pb-2 pr-4">Invoice no</th>
                  <th className="pb-2 pr-4">Issued on</th>
                  <th className="pb-2 pr-4">Due on</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-[color:var(--workspace-shell-border)] hover:bg-white/3">
                    <td className="py-3 pr-2">
                      <input type="checkbox" className="rounded border-[color:var(--workspace-shell-border)]" aria-label="Select invoice" />
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">{inv.clients?.display_name ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Link href={editPathBase.replace('[id]', inv.id)} className="font-medium text-[var(--workspace-shell-text)] hover:underline">
                        {inv.invoice_number}
                        {inv.recurring_series_id ? (
                          <Repeat className="ml-1 inline h-3.5 w-3.5 text-[var(--workspace-shell-text-muted)]" />
                        ) : null}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">{formatDate(inv.issued_at)}</td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">{formatDate(inv.due_at)}</td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">{formatPence(inv.total_pence)}</td>
                    <td className="py-3 pr-4">
                      <InvoiceStatusBadge
                        status={inv.status}
                        due_at={inv.due_at}
                        amount_paid_pence={inv.amount_paid_pence}
                        total_pence={inv.total_pence}
                      />
                    </td>
                    <td className="py-3">
                      <InvoiceRowMenu
                        accountId={accountId}
                        accountSlug={accountSlug}
                        invoice={inv}
                        canEditInvoices={canEditInvoices}
                        canManageInvoiceStatus={canManageInvoiceStatus}
                        onChanged={fetchInvoices}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab !== 'recurring' && !loading && total > 0 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-[var(--workspace-shell-text-muted)]">
              <span>
                Page {page} of {totalPages} ({total} invoices)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div>
              <Label>Client</Label>
              <ClientCombobox
                clients={clientOptions}
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                loading={clientsLoading}
                placeholder="Select client"
                emptyMessage="No clients"
                addClientHref={pathsConfig.app.accountClients.replace('[account]', accountSlug)}
              />
            </div>
            <Button
              className="w-full bg-[var(--ozer-accent)] text-[#09111F]"
              onClick={handleCreateInvoice}
              disabled={creating || !selectedClientId}
            >
              {creating ? 'Creating…' : 'Create and edit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
