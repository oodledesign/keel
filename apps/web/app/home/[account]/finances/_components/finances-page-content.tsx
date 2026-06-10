'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Link2,
  RefreshCw,
  Upload,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
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
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

import {
  categorizeFinanceTransactionAction,
  createManualTransactionAction,
  disconnectFreeAgentAction,
  importCsvTransactionsAction,
  loadFinancesDashboardAction,
  suggestCsvMappingAction,
  syncFreeAgentAction,
} from '../_lib/server/finances-actions';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

type DashboardData = Awaited<ReturnType<typeof loadFinancesDashboardAction>>;

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultDateRange().from);
  const [dateTo, setDateTo] = useState(defaultDateRange().to);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadFinancesDashboardAction({
        accountId,
        dateFrom,
        dateTo,
      });
      setData(result);
    } catch {
      toast.error('Could not load finances');
    } finally {
      setLoading(false);
    }
  }, [accountId, dateFrom, dateTo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('finance_connected') === '1') {
      toast.success('FreeAgent connected');
      startTransition(async () => {
        try {
          await syncFreeAgentAction({ accountId, accountSlug });
          toast.success('Transactions imported from FreeAgent');
          await refresh();
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

  const forecast = useMemo(() => {
    if (!data?.transactions?.length) return null;
    const months = new Map<string, { income: number; expense: number }>();
    for (const tx of data.transactions) {
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
  }, [data?.transactions]);

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
        await refresh();
        toast.success('Category updated');
      } catch {
        toast.error('Could not update category');
      }
    });
  };

  const onSync = () => {
    startTransition(async () => {
      try {
        const result = await syncFreeAgentAction({ accountId, accountSlug });
        await refresh();
        toast.success(
          `Synced ${result.imported} new transaction${result.imported === 1 ? '' : 's'}`,
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Sync failed');
      }
    });
  };

  const connectUrl = `/api/integrations/freeagent/start?account=${encodeURIComponent(accountSlug)}`;

  return (
    <div className="space-y-6 px-4 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-zinc-400">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-400">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            onClick={() => void refresh()}
          >
            Apply
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            type="button"
            className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
            onClick={() => setManualOpen(true)}
          >
            Add transaction
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Income"
          value={formatPence(data?.summary.incomePence ?? 0)}
          icon={ArrowDownLeft}
          tone="positive"
        />
        <SummaryCard
          label="Expenses"
          value={formatPence(data?.summary.expensePence ?? 0)}
          icon={ArrowUpRight}
          tone="negative"
        />
        <SummaryCard
          label="Net"
          value={formatPence(data?.summary.netPence ?? 0)}
          icon={ArrowDownLeft}
          tone={(data?.summary.netPence ?? 0) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {forecast ? (
        <div className={cn(panelClass, 'p-4')}>
          <h3 className="text-sm font-medium text-white">Forecast (monthly average)</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Based on selected range: ~{formatPence(forecast.avgIncomePence)} income,{' '}
            ~{formatPence(forecast.avgExpensePence)} expenses → projected net{' '}
            <span className="text-[#5eead4]">
              {formatPence(forecast.projectedNetPence)}
            </span>{' '}
            / month
          </p>
        </div>
      ) : null}

      <div className={cn(panelClass, 'p-4')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-white">FreeAgent</h3>
            <p className="text-sm text-zinc-400">
              {data?.connection
                ? `Connected to ${data.connection.freeagent_company_name ?? 'FreeAgent'}. Keel is your UI; FreeAgent stays the ledger.`
                : 'Connect FreeAgent to import bank transactions. Categorise in Keel and sync back.'}
            </p>
          </div>
          <div className="flex gap-2">
            {data?.connection ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10"
                  disabled={pending}
                  onClick={onSync}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync now
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-zinc-400"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await disconnectFreeAgentAction({ accountId, accountSlug });
                      await refresh();
                      toast.success('Disconnected');
                    })
                  }
                >
                  Disconnect
                </Button>
              </>
            ) : data?.freeAgentConfigured ? (
              <Button type="button" asChild className="bg-[#2A9D8F] text-white">
                <a href={connectUrl}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect FreeAgent
                </a>
              </Button>
            ) : (
              <p className="text-xs text-zinc-500">
                Set FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET to enable.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={cn(panelClass, 'overflow-hidden')}>
        <div className="border-b border-white/6 px-4 py-3">
          <h3 className="font-medium text-white">Transactions</h3>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-zinc-400">Loading…</p>
        ) : !data?.transactions.length ? (
          <p className="p-4 text-sm text-zinc-400">
            No transactions in this range. Import a CSV, connect FreeAgent, or add
            manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/6 text-left text-zinc-400">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => {
                  const pence = tx.amount_pence as number;
                  const cat = data.categories.find(
                    (c) => c.id === tx.category_id,
                  );
                  return (
                    <tr key={tx.id as string} className="border-b border-white/4">
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-300">
                        {String(tx.transaction_date)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2 text-white">
                        {String(tx.description)}
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-4 py-2 font-medium',
                          pence >= 0 ? 'text-emerald-400' : 'text-red-300',
                        )}
                      >
                        {formatPence(Math.abs(pence))}
                        {pence < 0 ? ' out' : ' in'}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={(tx.category_id as string | null) ?? 'none'}
                          onValueChange={(v) =>
                            onCategorize(
                              tx.id as string,
                              v === 'none' ? null : v,
                            )
                          }
                          disabled={pending}
                        >
                          <SelectTrigger className="h-8 w-44 border-white/10 bg-transparent text-xs text-white">
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
                      <td className="px-4 py-2 text-xs capitalize text-zinc-500">
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
      </div>

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        onImported={() => void refresh()}
      />

      <ManualTransactionSheet
        open={manualOpen}
        onOpenChange={setManualOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        categories={data?.categories ?? []}
        onSaved={() => void refresh()}
      />
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
    <div className={cn(panelClass, 'p-4')}>
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold',
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
      <SheetContent className="border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import bank CSV</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            className="border-white/10"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {mappingPreview ? (
            <div>
              <Label className="text-zinc-400">AI column mapping</Label>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
                {mappingPreview}
              </pre>
            </div>
          ) : null}
          <Button
            type="button"
            disabled={!file || pending}
            className="bg-[#2A9D8F] text-white"
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
      <SheetContent className="border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="mt-1 border-white/10">
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
              className="mt-1 border-white/10"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 border-white/10"
            />
          </div>
          <div>
            <Label>Amount (£)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 border-white/10"
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1 border-white/10">
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
            className="bg-[#2A9D8F] text-white"
            onClick={save}
          >
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
