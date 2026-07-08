'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import dynamic from 'next/dynamic';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  ArrowDownLeft,
  ArrowUpRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  AnalyticsDateRangePicker,
  type DateRangeSelection,
} from '~/components/date-range/analytics-date-range-picker';
import { resolveAnalyticsDateRange } from '~/lib/date-range/analytics-date-range';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

const FinanceNetLineChart = dynamic(
  () =>
    import('~/components/finance/finance-charts').then(
      (mod) => mod.FinanceNetLineChart,
    ),
  { ssr: false },
);

const FinanceTrendBarChart = dynamic(
  () =>
    import('~/components/finance/finance-charts').then(
      (mod) => mod.FinanceTrendBarChart,
    ),
  { ssr: false },
);

import {
  applySuggestedCategoriesAction,
  categorizeFinanceTransactionAction,
  createManualTransactionAction,
  importCsvTransactionsAction,
  loadFinancesDashboardAction,
  setFinanceTransactionLinksAction,
  setFinanceTransferAction,
  suggestCsvMappingAction,
  suggestTransactionCategoriesAction,
  syncFreeAgentAction,
  syncFreeAgentHistoryChunkAction,
} from '../_lib/server/finances-actions';
import { FINANCE_TRANSACTION_PAGE_SIZES } from '../_lib/finance-transaction-pagination';
import { FinancesDashboardSkeleton } from './finances-dashboard-skeleton';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

type DashboardData = Awaited<ReturnType<typeof loadFinancesDashboardAction>>;

type CategorySuggestion = {
  transactionId: string;
  categoryId: string | null;
  confidence: string;
  reason?: string;
};

const FINANCES_DEFAULT_DATE_RANGE: DateRangeSelection = {
  preset: 'last',
  lastSubPreset: 'last_12_months',
  lastCount: 12,
  lastUnit: 'months',
  includeToday: true,
};

function initialDateRange() {
  const resolved = resolveAnalyticsDateRange(FINANCES_DEFAULT_DATE_RANGE);
  return { from: resolved.fromIso, to: resolved.toIso };
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const parts: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        parts.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    parts.push(cur.trim());
    return parts;
  });
  return { headers, rows };
}

export function FinancesPageContent({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const refreshRequestIdRef = useRef(0);
  const [dateFrom, setDateFrom] = useState(initialDateRange().from);
  const [dateTo, setDateTo] = useState(initialDateRange().to);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof FINANCE_TRANSACTION_PAGE_SIZES)[number]>(50);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<CategorySuggestion[]>([]);

  const refresh = useCallback(
    async (options?: { background?: boolean }) => {
      const requestId = ++refreshRequestIdRef.current;

      if (options?.background) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setLoadFailed(false);
      }
      try {
        const result = await loadFinancesDashboardAction({
          accountId,
          dateFrom,
          dateTo,
          page,
          pageSize,
          search: searchQuery || undefined,
        });
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }
        setData(result);
        setLoadFailed(false);
      } catch {
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }
        setLoadFailed(true);
        toast.error('Could not load finances');
      } finally {
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accountId, dateFrom, dateTo, page, pageSize, searchQuery],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('finance_connected') === '1') {
      toast.success('FreeAgent connected');
      startTransition(async () => {
        try {
          await syncFreeAgentAction({ accountId, accountSlug });
          toast.success(
            'FreeAgent synced — transactions and categories imported',
          );
          await refresh({ background: true });
        } catch {
          toast.error('Connected, but initial sync failed — try Sync now');
        }
      });
      router.replace(
        pathsConfig.app.accountFinances.replace('[account]', accountSlug),
      );
    }
    const err = searchParams.get('finance_error');
    if (err) {
      toast.error(decodeURIComponent(err));
      router.replace(
        pathsConfig.app.accountFinances.replace('[account]', accountSlug),
      );
    }
  }, [accountId, accountSlug, refresh, router, searchParams]);

  const chartData = useMemo(() => {
    const rows = data?.summaryRows ?? [];
    if (!rows.length) return [];
    const months = new Map<
      string,
      { month: string; income: number; expenses: number; net: number }
    >();
    const formatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });

    for (const tx of rows) {
      if (tx.is_transfer) continue;

      const key = String(tx.transaction_date).slice(0, 7);
      if (!months.has(key)) {
        const [y, m] = key.split('-').map(Number);
        months.set(key, {
          month: formatter.format(new Date(y!, m! - 1, 1)),
          income: 0,
          expenses: 0,
          net: 0,
        });
      }
      const row = months.get(key)!;
      const p = tx.amount_pence as number;
      if (p >= 0) row.income += p / 100;
      else row.expenses += Math.abs(p) / 100;
      row.net = row.income - row.expenses;
    }

    return [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [data?.summaryRows]);

  const uncategorizedCount = data?.uncategorizedCount ?? 0;

  const suggestionMap = useMemo(
    () => new Map(aiSuggestions.map((s) => [s.transactionId, s])),
    [aiSuggestions],
  );

  const onDateRangeApply = (
    from: string,
    to: string,
    _selection: DateRangeSelection,
  ) => {
    setLoading(true);
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
    setAiSuggestions([]);
  };

  const forecast = useMemo(() => {
    const rows = data?.summaryRows ?? [];
    if (!rows.length) return null;
    const months = new Map<string, { income: number; expense: number }>();
    for (const tx of rows) {
      if (tx.is_transfer) continue;

      const key = String(tx.transaction_date).slice(0, 7);
      const row = months.get(key) ?? { income: 0, expense: 0 };
      const p = tx.amount_pence as number;
      if (p >= 0) row.income += p;
      else row.expense += Math.abs(p);
      months.set(key, row);
    }
    const values = [...months.values()];
    if (!values.length) return null;
    const avgIncome =
      values.reduce((s, v) => s + v.income, 0) / values.length;
    const avgExpense =
      values.reduce((s, v) => s + v.expense, 0) / values.length;
    return {
      avgIncomePence: Math.round(avgIncome),
      avgExpensePence: Math.round(avgExpense),
      projectedNetPence: Math.round(avgIncome - avgExpense),
    };
  }, [data?.summaryRows]);

  const formatSyncResult = (result: {
    imported: number;
    updated: number;
    processed: number;
    categorised: number;
    categoriesSynced: number;
  }) => {
    const parts: string[] = [];
    if (result.imported > 0) {
      parts.push(`${result.imported} new`);
    }
    if (result.updated > 0) {
      parts.push(`${result.updated} updated`);
    }
    if (result.processed > 0 && result.imported === 0 && result.updated === 0) {
      parts.push(`${result.processed} checked`);
    }
    if (result.categoriesSynced > 0) {
      parts.push(
        `${result.categoriesSynced} categor${result.categoriesSynced === 1 ? 'y' : 'ies'} synced`,
      );
    }
    if (result.categorised > 0) {
      parts.push(`${result.categorised} categorised`);
    }
    return parts.length ? parts.join(', ') : 'No changes';
  };

  const onSetLinks = (
    transactionId: string,
    clientId: string | null,
    projectId: string | null,
  ) => {
    startTransition(async () => {
      try {
        await setFinanceTransactionLinksAction({
          accountId,
          accountSlug,
          transactionId,
          clientId,
          projectId,
        });
        await refresh({ background: true });
        toast.success('Client / project updated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update links');
      }
    });
  };

  const onSetTransfer = (transactionId: string, isTransfer: boolean) => {
    startTransition(async () => {
      try {
        await setFinanceTransferAction({
          accountId,
          accountSlug,
          transactionId,
          isTransfer,
        });
        await refresh({ background: true });
        toast.success(
          isTransfer
            ? 'Marked as transfer — excluded from income and expenses'
            : 'Transfer removed — included in totals again',
        );
      } catch {
        toast.error('Could not update transaction');
      }
    });
  };

  const onCategorize = (transactionId: string, categoryId: string | null) => {
    startTransition(async () => {
      try {
        await categorizeFinanceTransactionAction({
          accountId,
          accountSlug,
          transactionId,
          categoryId,
          pushToFreeAgent: Boolean(data?.connection),
        });
        await refresh({ background: true });
        toast.success(
          data?.connection
            ? 'Category updated and queued for FreeAgent sync'
            : 'Category updated',
        );
      } catch {
        toast.error('Could not update category');
      }
    });
  };

  const onSyncFreeAgent = (options?: { history?: boolean }) => {
    startTransition(async () => {
      try {
        if (options?.history) {
          const toastId = 'freeagent-history-sync';
          const resume =
            (
              data?.connection?.sync_state as
                | { historyBackfill?: { status?: string } }
                | null
                | undefined
            )?.historyBackfill?.status === 'running';

          toast.loading(
            resume ? 'Resuming historical sync…' : 'Starting historical sync…',
            { id: toastId },
          );

          let reset = !resume;
          let complete = false;
          const totals = {
            imported: 0,
            updated: 0,
            processed: 0,
            categorised: 0,
            categoriesSynced: 0,
          };

          const maxChunks = 500;
          let chunks = 0;

          while (!complete && chunks < maxChunks) {
            chunks++;
            const result = await syncFreeAgentHistoryChunkAction({
              accountId,
              accountSlug,
              reset,
            });
            reset = false;
            complete = result.historyComplete;
            totals.imported += result.imported;
            totals.updated += result.updated;
            totals.processed += result.processed;
            totals.categorised += result.categorised;
            totals.categoriesSynced += result.categoriesSynced;

            toast.loading(`Syncing history… ${result.historyProgress}`, {
              id: toastId,
            });
          }

          if (!complete) {
            toast.error(
              'Historical sync paused — run Sync all FreeAgent history again to continue.',
              { id: toastId },
            );
            await refresh({ background: true });
            return;
          }

          const wideRange = resolveAnalyticsDateRange(FINANCES_DEFAULT_DATE_RANGE);
          setDateFrom(wideRange.fromIso);
          setDateTo(wideRange.toIso);
          setPage(1);

          await refresh({ background: true });
          toast.success(
            `Historical sync complete — ${formatSyncResult(totals)}`,
            { id: toastId },
          );
          return;
        }

        const result = await syncFreeAgentAction({ accountId, accountSlug });
        await refresh({ background: true });
        toast.success(`FreeAgent sync complete — ${formatSyncResult(result)}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Sync failed');
      }
    });
  };

  const onSuggestCategories = () => {
    startTransition(async () => {
      try {
        const result = await suggestTransactionCategoriesAction({
          accountId,
          dateFrom,
          dateTo,
        });
        setAiSuggestions(result.suggestions ?? []);
        if (!result.suggestions?.length) {
          toast.info('No uncategorised transactions to suggest for');
        } else {
          toast.success(
            `Suggested categories for ${result.suggestions.filter((s) => s.categoryId).length} transactions`,
          );
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not suggest categories',
        );
      }
    });
  };

  const onApplySuggestions = () => {
    const applicable = aiSuggestions.filter((s) => s.categoryId);
    if (!applicable.length) {
      toast.error('No suggestions to apply');
      return;
    }
    startTransition(async () => {
      try {
        const result = await applySuggestedCategoriesAction({
          accountId,
          accountSlug,
          pushToFreeAgent: Boolean(data?.connection),
          suggestions: applicable.map((s) => ({
            transactionId: s.transactionId,
            categoryId: s.categoryId,
          })),
        });
        setAiSuggestions([]);
        await refresh({ background: true });
        if (result.pushFailed > 0) {
          toast.warning(
            `Applied ${result.applied} categories. ${result.pushFailed} could not sync to FreeAgent — check the Source column.`,
          );
        } else if (result.pushed > 0) {
          toast.success(
            `Applied ${result.applied} categories and synced ${result.pushed} to FreeAgent`,
          );
        } else {
          toast.success(`Applied ${result.applied} categories`);
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not apply suggestions',
        );
      }
    });
  };

  const financesSettingsPath = pathsConfig.app.accountFinancesSettings.replace(
    '[account]',
    accountSlug,
  );
  const freeAgentConnected = Boolean(data?.connection);
  const showSkeleton = loading || data === null;

  return (
    <div className="space-y-6 px-4 lg:px-8" aria-busy={showSkeleton}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AnalyticsDateRangePicker
          fromIso={dateFrom}
          toIso={dateTo}
          isLoading={showSkeleton}
          onApply={onDateRangeApply}
        />
        <FinancesPageMenu
          disabled={showSkeleton}
          pending={pending}
          freeAgentConnected={freeAgentConnected}
          settingsPath={financesSettingsPath}
          onAddTransaction={() => setManualOpen(true)}
          onImportCsv={() => setImportOpen(true)}
          onSyncFreeAgent={() => onSyncFreeAgent()}
        />
      </div>

      {showSkeleton ? (
        <FinancesDashboardSkeleton />
      ) : loadFailed ? (
        <div className={cn(panelClass, 'p-6 text-center')}>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">Could not load finance data.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-[color:var(--workspace-shell-border)]"
            onClick={() => void refresh()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            'space-y-6 transition-opacity duration-200',
            refreshing && 'pointer-events-none opacity-50',
          )}
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <SummaryCard
              label="Income"
              value={formatPence(data.summary.incomePence)}
              icon={ArrowDownLeft}
              tone="positive"
            />
            <SummaryCard
              label="Expenses"
              value={formatPence(data.summary.expensePence)}
              icon={ArrowUpRight}
              tone="negative"
            />
            <SummaryCard
              label="Net"
              value={formatPence(data.summary.netPence)}
              icon={ArrowDownLeft}
              tone={data.summary.netPence >= 0 ? 'positive' : 'negative'}
            />
          </div>

          {data.summary.transferPence > 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {formatPence(data.summary.transferPence)} in internal transfers excluded
              from income and expenses.
            </p>
          ) : null}

          {chartData.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cn(panelClass, 'p-4')}>
                <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">Income vs expenses</h3>
                <p className="mb-4 text-xs text-[var(--workspace-shell-text-muted)]">By month in selected range</p>
                <FinanceTrendBarChart data={chartData} variant="grouped" />
              </div>
              <div className={cn(panelClass, 'p-4')}>
                <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">Net trend</h3>
                <p className="mb-4 text-xs text-[var(--workspace-shell-text-muted)]">Monthly net after expenses</p>
                <FinanceNetLineChart data={chartData} />
              </div>
            </div>
          ) : null}

          {forecast ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              <span className="font-medium text-[var(--workspace-shell-text)]">
                Forecast (monthly average):
              </span>{' '}
              ~{formatPence(forecast.avgIncomePence)} income, ~{' '}
              {formatPence(forecast.avgExpensePence)} expenses → projected net{' '}
              <span className="font-medium text-[var(--ozer-accent-muted)]">
                {formatPence(forecast.projectedNetPence)}
              </span>{' '}
              / month based on selected range
            </p>
          ) : null}

          <TransactionsPanel
            data={data}
            loading={false}
            pending={pending}
            freeAgentConnected={freeAgentConnected}
            uncategorizedCount={uncategorizedCount}
            aiSuggestions={aiSuggestions}
            suggestionMap={suggestionMap}
            page={page}
            pageSize={pageSize}
            search={searchInput}
            onSearchChange={setSearchInput}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            onSuggestCategories={onSuggestCategories}
            onApplySuggestions={onApplySuggestions}
            onCategorize={onCategorize}
            onSetTransfer={onSetTransfer}
            onSetLinks={onSetLinks}
            onSyncFreeAgent={() => onSyncFreeAgent()}
            onSyncFreeAgentHistory={() => onSyncFreeAgent({ history: true })}
          />
        </div>
      )}

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        onImported={() => void refresh({ background: true })}
      />

      <ManualTransactionSheet
        open={manualOpen}
        onOpenChange={setManualOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        categories={data?.categories ?? []}
        onSaved={() => void refresh({ background: true })}
      />
    </div>
  );
}

function FinancesPageMenu({
  disabled,
  pending,
  freeAgentConnected,
  settingsPath,
  onAddTransaction,
  onImportCsv,
  onSyncFreeAgent,
}: {
  disabled: boolean;
  pending: boolean;
  freeAgentConnected: boolean;
  settingsPath: string;
  onAddTransaction: () => void;
  onImportCsv: () => void;
  onSyncFreeAgent: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            'h-9 w-9 shrink-0 rounded-xl border border-[color:var(--workspace-shell-border)]',
            'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text-muted)]',
            'hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
          )}
          disabled={disabled}
          aria-label="Finances actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
      >
        <DropdownMenuItem onClick={onAddTransaction}>
          <Plus className="mr-2 h-4 w-4" />
          Add transaction
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onImportCsv}>
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </DropdownMenuItem>
        {freeAgentConnected ? (
          <DropdownMenuItem disabled={pending} onClick={onSyncFreeAgent}>
            <RefreshCw className={cn('mr-2 h-4 w-4', pending && 'animate-spin')} />
            Sync FreeAgent
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <a href={settingsPath}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync FreeAgent
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={settingsPath}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TransactionsPanel({
  data,
  loading,
  pending,
  freeAgentConnected,
  uncategorizedCount,
  aiSuggestions,
  suggestionMap,
  page,
  pageSize,
  search,
  onSearchChange,
  onPageChange,
  onPageSizeChange,
  onSuggestCategories,
  onApplySuggestions,
  onCategorize,
  onSetTransfer,
  onSetLinks,
  onSyncFreeAgent,
  onSyncFreeAgentHistory,
}: {
  data: DashboardData | null;
  loading: boolean;
  pending: boolean;
  freeAgentConnected: boolean;
  uncategorizedCount: number;
  aiSuggestions: CategorySuggestion[];
  suggestionMap: Map<string, CategorySuggestion>;
  page: number;
  pageSize: (typeof FINANCE_TRANSACTION_PAGE_SIZES)[number];
  search: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: (typeof FINANCE_TRANSACTION_PAGE_SIZES)[number]) => void;
  onSuggestCategories: () => void;
  onApplySuggestions: () => void;
  onCategorize: (transactionId: string, categoryId: string | null) => void;
  onSetTransfer: (transactionId: string, isTransfer: boolean) => void;
  onSetLinks: (
    transactionId: string,
    clientId: string | null,
    projectId: string | null,
  ) => void;
  onSyncFreeAgent: () => void;
  onSyncFreeAgentHistory: () => void;
}) {
  const totalCount = data?.transactionTotalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const searchActive = search.trim().length > 0;

  return (
    <div className={cn(panelClass, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <h3 className="font-medium text-[var(--workspace-shell-text)]">Transactions</h3>
        <div className="flex flex-wrap items-center gap-2">
          {uncategorizedCount > 0 ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[color:var(--workspace-shell-border)]"
                disabled={pending || loading}
                onClick={onSuggestCategories}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Suggest categories ({uncategorizedCount})
              </Button>
              {aiSuggestions.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                  disabled={pending || loading}
                  onClick={onApplySuggestions}
                >
                  Apply suggestions
                </Button>
              ) : null}
            </>
          ) : null}
          {freeAgentConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  disabled={pending || loading}
                  aria-label="Transaction sync actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
              >
                <DropdownMenuItem disabled={pending} onClick={onSyncFreeAgent}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', pending && 'animate-spin')} />
                  Sync FreeAgent
                </DropdownMenuItem>
                <DropdownMenuItem disabled={pending} onClick={onSyncFreeAgentHistory}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', pending && 'animate-spin')} />
                  Sync all FreeAgent history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
          <Input
            placeholder="Search description..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-[color:var(--workspace-shell-border)] bg-transparent pl-9 text-[var(--workspace-shell-text)]"
          />
        </div>
        {searchActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange('')}
          >
            Clear search
          </Button>
        ) : null}
      </div>
      {!data?.transactions.length ? (
        <p className="p-4 text-sm text-[var(--workspace-shell-text-muted)]">
          {searchActive
            ? 'No transactions match your search in this date range.'
            : totalCount > 0
              ? 'No transactions on this page. Try an earlier page or widen the date range.'
              : 'No transactions in this range. Import a CSV, sync from FreeAgent in settings, or add manually.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-[var(--workspace-shell-text-muted)]">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => {
                const pence = tx.amount_pence as number;
                const isTransfer = Boolean(tx.is_transfer);
                const cat = data.categories.find((c) => c.id === tx.category_id);
                const suggestion = suggestionMap.get(tx.id as string);
                const suggestedCat = suggestion?.categoryId
                  ? data.categories.find((c) => c.id === suggestion.categoryId)
                  : null;
                const txClientId = (tx.client_id as string | null) ?? null;
                const txProjectId = (tx.project_id as string | null) ?? null;
                const projectOptions = (data.projects ?? []).filter(
                  (project) =>
                    !txClientId || !project.client_id || project.client_id === txClientId,
                );
                return (
                  <tr
                    key={tx.id as string}
                    className={cn(
                      'border-b border-[color:var(--workspace-shell-border)]',
                      isTransfer && 'bg-[var(--workspace-shell-sidebar-accent)]',
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--workspace-shell-text-muted)]">
                      {String(tx.transaction_date)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-[var(--workspace-shell-text)]">
                      {String(tx.description)}
                      {suggestedCat && !tx.category_id && !isTransfer ? (
                        <span className="mt-1 block text-xs text-[var(--ozer-accent-muted)]">
                          AI suggests: {String(suggestedCat.name)}
                          {suggestion?.confidence ? ` (${suggestion.confidence})` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-4 py-2 font-medium',
                        isTransfer
                          ? 'text-[var(--workspace-shell-text-muted)]'
                          : pence >= 0
                            ? 'text-emerald-400'
                            : 'text-red-300',
                      )}
                    >
                      {formatPence(Math.abs(pence))}
                      {isTransfer ? ' transfer' : pence < 0 ? ' out' : ' in'}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={isTransfer ? 'transfer' : 'normal'}
                        onValueChange={(v) =>
                          onSetTransfer(tx.id as string, v === 'transfer')
                        }
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 w-32 border-[color:var(--workspace-shell-border)] bg-transparent text-xs text-[var(--workspace-shell-text)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Income / expense</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={(tx.category_id as string | null) ?? 'none'}
                        onValueChange={(v) =>
                          onCategorize(tx.id as string, v === 'none' ? null : v)
                        }
                        disabled={pending || isTransfer}
                      >
                        <SelectTrigger className="h-8 w-44 border-[color:var(--workspace-shell-border)] bg-transparent text-xs text-[var(--workspace-shell-text)]">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Uncategorised</SelectItem>
                          {(data.categories ?? []).map((c) => (
                            <SelectItem key={c.id as string} value={c.id as string}>
                              {String(c.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cat?.name ? (
                        <span className="sr-only">{String(cat.name)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={txClientId ?? 'none'}
                        onValueChange={(v) => {
                          const nextClientId = v === 'none' ? null : v;
                          const nextProjectId =
                            txProjectId &&
                            (data.projects ?? []).find((p) => p.id === txProjectId)
                              ?.client_id &&
                            (data.projects ?? []).find((p) => p.id === txProjectId)
                              ?.client_id !== nextClientId
                              ? null
                              : txProjectId;
                          onSetLinks(tx.id as string, nextClientId, nextProjectId);
                        }}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 w-36 border-[color:var(--workspace-shell-border)] bg-transparent text-xs text-[var(--workspace-shell-text)]">
                          <SelectValue placeholder="Client" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No client</SelectItem>
                          {(data.clients ?? []).map((clientRow) => (
                            <SelectItem
                              key={clientRow.id as string}
                              value={clientRow.id as string}
                            >
                              {String(clientRow.display_name ?? clientRow.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={txProjectId ?? 'none'}
                        onValueChange={(v) => {
                          if (v === 'none') {
                            onSetLinks(tx.id as string, txClientId, null);
                            return;
                          }
                          const project = (data.projects ?? []).find((p) => p.id === v);
                          onSetLinks(
                            tx.id as string,
                            project?.client_id ?? txClientId,
                            v,
                          );
                        }}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 w-40 border-[color:var(--workspace-shell-border)] bg-transparent text-xs text-[var(--workspace-shell-text)]">
                          <SelectValue placeholder="Project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {projectOptions.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2 text-xs capitalize text-[var(--workspace-shell-text-muted)]">
                      {String(tx.source)}
                      {tx.sync_status === 'push_failed' ? ' · sync failed' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--workspace-shell-border)] px-4 py-3">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {searchActive
              ? `Showing ${rangeStart}–${rangeEnd} of ${totalCount} matching`
              : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) =>
                onPageSizeChange(Number(value) as (typeof FINANCE_TRANSACTION_PAGE_SIZES)[number])
              }
            >
              <SelectTrigger className="h-8 w-[110px] border-[color:var(--workspace-shell-border)] bg-transparent text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCE_TRANSACTION_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)]"
              disabled={pending || loading || page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs tabular-nums text-[var(--workspace-shell-text-muted)]">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)]"
              disabled={pending || loading || page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof ArrowDownLeft;
  tone: 'positive' | 'negative';
}) {
  return (
    <div className={cn(panelClass, 'min-w-0 p-2.5 sm:p-4')}>
      <div className="flex items-center gap-1 text-[var(--workspace-shell-text-muted)] sm:gap-2">
        <Icon className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" />
        <span className="truncate text-[11px] sm:text-sm">{label}</span>
      </div>
      <p
        className={cn(
          'mt-1 truncate text-sm font-semibold tabular-nums sm:mt-2 sm:text-2xl',
          tone === 'positive' ? 'text-emerald-400' : 'text-red-300',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CsvImportSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountSlug: string;
  onImported: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [mappingPreview, setMappingPreview] = useState<string>('');

  const handleFile = (f: File | null) => {
    setFile(f);
    setMappingPreview('');
    if (!f) return;

    startTransition(async () => {
      const text = await f.text();
      const { headers, rows } = parseCsv(text);
      if (!headers.length) {
        toast.error('Could not parse CSV');
        return;
      }
      const suggestion = await suggestCsvMappingAction({ headers, sampleRows: rows });
      setMappingPreview(JSON.stringify(suggestion.mapping, null, 2));
    });
  };

  const importFile = () => {
    if (!file) return;
    startTransition(async () => {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);
      const suggestion = await suggestCsvMappingAction({ headers, sampleRows: rows });
      try {
        const result = await importCsvTransactionsAction({
          accountId,
          accountSlug,
          filename: file.name,
          headers,
          rows,
          mapping: suggestion.mapping,
          dateFormat: suggestion.dateFormat,
        });
        toast.success(`Imported ${result.imported} transactions`);
        onOpenChange(false);
        onImported();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Import failed');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import bank CSV</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            className="border-[color:var(--workspace-shell-border)]"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {mappingPreview ? (
            <div>
              <Label className="text-[var(--workspace-shell-text-muted)]">AI column mapping</Label>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3 text-xs text-[var(--workspace-shell-text-muted)]">
                {mappingPreview}
              </pre>
            </div>
          ) : null}
          <Button
            type="button"
            disabled={!file || pending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)]"
            onClick={importFile}
          >
            Import
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ManualTransactionSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accountId: string;
  accountSlug: string;
  categories: Array<{ id: string; name: string; kind: string }>;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState<string>('none');

  const save = () => {
    const pounds = parseFloat(amount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const amountPence =
      kind === 'expense' ? -Math.round(pounds * 100) : Math.round(pounds * 100);

    startTransition(async () => {
      try {
        await createManualTransactionAction({
          accountId,
          accountSlug,
          transactionDate: date,
          description: description || 'Manual entry',
          amountPence,
          categoryId: categoryId === 'none' ? null : categoryId,
        });
        toast.success('Transaction added');
        onOpenChange(false);
        onSaved();
      } catch {
        toast.error('Could not save');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 border-[color:var(--workspace-shell-border)]"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 border-[color:var(--workspace-shell-border)]"
            />
          </div>
          <div>
            <Label>Amount (£)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 border-[color:var(--workspace-shell-border)]"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            disabled={pending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)]"
            onClick={save}
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
