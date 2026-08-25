'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { FileText, PlusCircle, RefreshCw, Repeat, Search } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { DateRangeSelection } from '~/components/date-range/analytics-date-range-picker';
import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';
import {
  currentMonthToDateSelection,
  resolveAnalyticsDateRange,
} from '~/lib/date-range/analytics-date-range';

import { getErrorMessage } from '../_lib/error-message';
import { formatInvoiceMoney } from '../_lib/invoice-currency';
import type { ListInvoicesInput } from '../_lib/schema/invoices.schema';
import {
  createInvoice,
  deleteRecurringSeriesAction,
  getInvoiceSummaryAction,
  getInvoiceTabCountsAction,
  listInvoices,
  listRecurringSeriesAction,
  updateRecurringSeriesStatusAction,
} from '../_lib/server/server-actions';
import { InvoiceRowMenu } from './invoice-row-menu';
import {
  InvoiceStatusBadge,
  RecurringSeriesStatusBadge,
} from './invoice-status-badge';
import { InvoicesIncomeSummary } from './invoices-income-summary';
import {
  RecurringSeriesEditDialog,
  type RecurringSeriesEditModel,
} from './recurring-series-edit-dialog';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  issued_at: string | null;
  currency?: string | null;
  total_pence: number;
  amount_paid_pence?: number;
  recurring_series_id?: string | null;
  scheduled_send_at?: string | null;
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

const INVOICES_DEFAULT_DATE_RANGE = currentMonthToDateSelection();

function initialSummaryDateRange() {
  const resolved = resolveAnalyticsDateRange(INVOICES_DEFAULT_DATE_RANGE);
  return { from: resolved.fromIso, to: resolved.toIso };
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
  const [recurring, setRecurring] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [counts, setCounts] = useState(
    initialCounts ?? { draft: 0, unpaid: 0, all: 0, recurring: 0 },
  );
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof getInvoiceSummaryAction>
  > | null>(initialSummary ?? null);
  const [summaryDateFrom, setSummaryDateFrom] = useState(
    () => initialSummaryDateRange().from,
  );
  const [summaryDateTo, setSummaryDateTo] = useState(
    () => initialSummaryDateRange().to,
  );
  const [summaryLoading, setSummaryLoading] = useState(false);
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
  const [editingSeries, setEditingSeries] =
    useState<RecurringSeriesEditModel | null>(null);
  const [seriesPendingDelete, setSeriesPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingSeries, setDeletingSeries] = useState(false);
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
        setClientOptions(
          (list ?? []) as { id: string; display_name: string | null }[],
        );
      })
      .catch(() => setClientOptions([]));
  }, [accountId, initialClients]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const result = await getInvoiceSummaryAction({
        accountId,
        dateFrom: summaryDateFrom,
        dateTo: summaryDateTo,
      });
      setSummary(result as typeof summary);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [accountId, summaryDateFrom, summaryDateTo]);

  const onSummaryDateRangeApply = useCallback(
    (fromIso: string, toIso: string, _selection: DateRangeSelection) => {
      setSummaryDateFrom(fromIso);
      setSummaryDateTo(toIso);
    },
    [],
  );

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
      const statusMap: Record<TabKey, ListInvoicesInput['status'] | undefined> =
        {
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
    if (
      skipInitialFetchRef.current &&
      summaryDateFrom === initialSummaryDateRange().from &&
      summaryDateTo === initialSummaryDateRange().to &&
      initialSummary
    ) {
      return;
    }

    void fetchSummary();
  }, [fetchSummary, initialSummary, summaryDateFrom, summaryDateTo]);

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
    if (!canEditInvoices || searchParams.get('create') !== 'invoice') return;
    void openCreateDialog();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams}` : pathname,
      {
        scroll: false,
      },
    );
  }, [canEditInvoices, openCreateDialog, pathname, router, searchParams]);

  const handleCreateInvoice = async () => {
    if (!canEditInvoices || !selectedClientId) {
      toast.error('Please select a client');
      return;
    }
    setCreating(true);
    try {
      const invoice = await createInvoice({
        accountId,
        client_id: selectedClientId,
      });
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

  const editPathBase = pathsConfig.app.accountInvoiceEdit.replace(
    '[account]',
    accountSlug,
  );
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
        <p className="text-[var(--workspace-shell-text-muted)]">
          You don&apos;t have access to invoices in this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="px-4 md:px-0">
        <InvoicesIncomeSummary
          summary={summary}
          dateFrom={summaryDateFrom}
          dateTo={summaryDateTo}
          isLoading={summaryLoading}
          onDateRangeApply={onSummaryDateRangeApply}
        />
      </div>

      <div className="rounded-none border-y border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-sm md:rounded-2xl md:border">
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
                    ? 'bg-background text-[var(--workspace-shell-text)] shadow-sm ring-1 ring-[color:var(--workspace-shell-border)]'
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
              onClick={() => void fetchInvoices()}
            >
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
            <div className="relative max-w-sm min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
              <Input
                placeholder="Search number, client, or project..."
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
        ) : null}

        <div className="overflow-auto p-4">
          {loading ? (
            <p className="text-[var(--workspace-shell-text-muted)]">Loading…</p>
          ) : tab === 'recurring' ? (
            recurring.length === 0 ? (
              <div className="py-12 text-center text-[var(--workspace-shell-text-muted)]">
                <Repeat className="mx-auto mb-3 h-10 w-10 opacity-50" />
                No recurring series yet. Create one from an invoice via Make
                recurring.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[var(--workspace-shell-text-muted)]">
                    <th className="pr-4 pb-2">Title</th>
                    <th className="pr-4 pb-2">Client</th>
                    <th className="pr-4 pb-2">Frequency</th>
                    <th className="pr-4 pb-2">Next issue</th>
                    <th className="pr-4 pb-2">Due</th>
                    <th className="pr-4 pb-2">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((series) => (
                    <tr
                      key={String(series.id)}
                      className="border-t border-[color:var(--workspace-shell-border)]"
                    >
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text)]">
                        {String(series.title ?? '—')}
                      </td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                        {(
                          series.clients as {
                            display_name?: string | null;
                          } | null
                        )?.display_name ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)] capitalize">
                        {String(series.frequency ?? '')}
                      </td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                        {formatDate(String(series.next_issue_at ?? ''))}
                      </td>
                      <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                        {typeof series.due_days === 'number'
                          ? `${series.due_days} day${series.due_days === 1 ? '' : 's'}`
                          : '7 days'}
                      </td>
                      <td className="py-3 pr-4">
                        <RecurringSeriesStatusBadge
                          status={String(series.status ?? 'active')}
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canEditInvoices ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditingSeries({
                                  id: String(series.id),
                                  client_id: String(series.client_id),
                                  title: String(series.title ?? ''),
                                  currency:
                                    typeof series.currency === 'string'
                                      ? series.currency
                                      : null,
                                  frequency: String(
                                    series.frequency ?? 'monthly',
                                  ),
                                  next_issue_at: String(
                                    series.next_issue_at ?? '',
                                  ),
                                  end_at:
                                    typeof series.end_at === 'string'
                                      ? series.end_at
                                      : null,
                                  auto_send: Boolean(series.auto_send),
                                  due_days:
                                    typeof series.due_days === 'number'
                                      ? series.due_days
                                      : 7,
                                  max_occurrences:
                                    typeof series.max_occurrences === 'number'
                                      ? series.max_occurrences
                                      : null,
                                  template:
                                    (series.template as Record<
                                      string,
                                      unknown
                                    > | null) ?? {},
                                })
                              }
                            >
                              Edit
                            </Button>
                          ) : null}
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
                          {canEditInvoices ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setSeriesPendingDelete({
                                  id: String(series.id),
                                  title: String(series.title ?? 'Series'),
                                })
                              }
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
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
                  <th className="w-8 pr-4 pb-2" />
                  <th className="pr-4 pb-2">Recipient</th>
                  <th className="pr-4 pb-2">Invoice no</th>
                  <th className="pr-4 pb-2">Issued on</th>
                  <th className="pr-4 pb-2">Due on</th>
                  <th className="pr-4 pb-2">Total</th>
                  <th className="pr-4 pb-2">Status</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-[color:var(--workspace-shell-border)] hover:bg-white/3"
                  >
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        className="rounded border-[color:var(--workspace-shell-border)]"
                        aria-label="Select invoice"
                      />
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {inv.clients?.display_name ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={editPathBase.replace('[id]', inv.id)}
                        className="inline-flex items-center gap-1.5 font-medium text-[var(--workspace-shell-text)] hover:underline"
                      >
                        <span>{inv.invoice_number}</span>
                        {inv.recurring_series_id ? (
                          <Repeat
                            className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-accent)]"
                            aria-label="Recurring invoice"
                            title="Recurring invoice"
                          />
                        ) : null}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatDate(inv.issued_at)}
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatDate(inv.due_at)}
                    </td>
                    <td className="py-3 pr-4 text-[var(--workspace-shell-text-muted)]">
                      {formatInvoiceMoney(inv.total_pence, inv.currency)}
                    </td>
                    <td className="py-3 pr-4">
                      <InvoiceStatusBadge
                        status={inv.status}
                        due_at={inv.due_at}
                        amount_paid_pence={inv.amount_paid_pence}
                        total_pence={inv.total_pence}
                        scheduled_send_at={inv.scheduled_send_at}
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
                addClientHref={pathsConfig.app.accountClients.replace(
                  '[account]',
                  accountSlug,
                )}
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

      <RecurringSeriesEditDialog
        open={Boolean(editingSeries)}
        onOpenChange={(open) => {
          if (!open) setEditingSeries(null);
        }}
        accountId={accountId}
        series={editingSeries}
        onSaved={() => {
          void fetchInvoices();
        }}
      />

      <AlertDialog
        open={Boolean(seriesPendingDelete)}
        onOpenChange={(open) => {
          if (!open) setSeriesPendingDelete(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--workspace-shell-text)]">
              Delete recurring series?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              This stops future invoices from{' '}
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {seriesPendingDelete?.title}
              </span>
              . Invoices already created from this series are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingSeries}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deletingSeries || !seriesPendingDelete}
              onClick={async () => {
                if (!seriesPendingDelete) return;
                setDeletingSeries(true);
                try {
                  await deleteRecurringSeriesAction({
                    accountId,
                    seriesId: seriesPendingDelete.id,
                  });
                  toast.success('Recurring series deleted');
                  setSeriesPendingDelete(null);
                  void fetchInvoices();
                } catch (error) {
                  toast.error(getErrorMessage(error));
                } finally {
                  setDeletingSeries(false);
                }
              }}
            >
              {deletingSeries ? 'Deleting…' : 'Delete series'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
