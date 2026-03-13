'use client';

import { useCallback, useEffect, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { FileText, Filter, PlusCircle, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { If } from '@kit/ui/if';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';

import { createInvoice, listInvoices } from '../_lib/server/server-actions';
import { getErrorMessage } from '../_lib/error-message';

type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  total_pence: number;
  created_at: string;
  updated_at: string;
  clients: { display_name: string | null } | null;
};

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatPence(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Overdue: due_at < today and status is sent (V1: UI-computed only). */
function displayStatus(inv: { status: string; due_at: string | null }): string {
  if (inv.status !== 'sent') return inv.status;
  if (!inv.due_at) return inv.status;
  const due = new Date(inv.due_at);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today ? 'overdue' : inv.status;
}

export function InvoicesPageContent({
  accountSlug,
  accountId,
  canViewInvoices,
  canEditInvoices,
  canManageInvoiceStatus,
}: {
  accountSlug: string;
  accountId: string;
  canViewInvoices: boolean;
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [clientOptions, setClientOptions] = useState<{ id: string; display_name: string | null }[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const pageSize = 20;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listInvoices({
        accountId,
        page,
        pageSize,
        query: searchDebounced || undefined,
        status: statusFilter || undefined,
      });
      if (result?.data !== undefined) {
        setInvoices((result.data ?? []) as unknown as InvoiceRow[]);
        setTotal(result.total ?? 0);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load invoices');
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accountId, searchDebounced, page, pageSize, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const openCreateSheet = useCallback(async () => {
    setCreateSheetOpen(true);
    setSelectedClientId('');
    setClientsError(null);
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
    } catch (err) {
      setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
      toast.error(getErrorMessage(err));
      setClientOptions([]);
    } finally {
      setClientsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!canEditInvoices || searchParams.get('create') !== 'invoice') {
      return;
    }

    void openCreateSheet();

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    const nextPath = nextParams.toString()
      ? `${pathname}?${nextParams.toString()}`
      : pathname;

    router.replace(nextPath, { scroll: false });
  }, [canEditInvoices, openCreateSheet, pathname, router, searchParams]);

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
        setCreateSheetOpen(false);
        const editPath = pathsConfig.app.accountInvoiceEdit
          .replace('[account]', accountSlug)
          .replace('[id]', invoice.id);
        router.push(editPath);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setStatusTab = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };
  const editPathBase = pathsConfig.app.accountInvoiceEdit.replace('[account]', accountSlug);

  if (!canViewInvoices) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-8">
        <p className="text-center text-zinc-400">
          You don&apos;t have access to invoices in this account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-700 p-4 md:p-6">
          <div className="inline-flex rounded-full border border-white/8 bg-[var(--workspace-control-surface)]/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusTab('')}
              className={`px-3 py-1.5 font-medium transition-colors rounded-full ${
                statusFilter === ''
                  ? 'bg-emerald-500 text-[#05120b]'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('draft')}
              className={`px-3 py-1.5 font-medium transition-colors rounded-full ${
                statusFilter === 'draft'
                  ? 'bg-emerald-500 text-[#05120b]'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('paid')}
              className={`px-3 py-1.5 font-medium transition-colors rounded-full ${
                statusFilter === 'paid'
                  ? 'bg-emerald-500 text-[#05120b]'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Paid
            </button>
          </div>

          <If condition={canEditInvoices}>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={openCreateSheet}
              disabled={creating}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create invoice
            </Button>
          </If>
        </div>

        <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
          <SheetContent className="border-zinc-700 bg-[var(--workspace-shell-panel)]">
            <SheetHeader>
              <SheetTitle className="text-white">Create invoice</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-zinc-300">Client (required)</Label>
                <div className="mt-1">
                  <ClientCombobox
                    clients={clientOptions}
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                    loading={clientsLoading}
                    placeholder="Search or select client"
                    emptyMessage="No clients found."
                    addClientHref={pathsConfig.app.accountClients.replace(
                      '[account]',
                      accountSlug,
                    )}
                  />
                </div>
                {clientsError && (
                  <p className="mt-1.5 text-sm text-amber-500">{clientsError}</p>
                )}
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                onClick={handleCreateInvoice}
                disabled={creating || !selectedClientId}
              >
                {creating ? 'Creating…' : 'Create and edit'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="border-b border-zinc-700 px-4 py-3 md:px-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search by invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {loading ? (
            <p className="text-zinc-400">Loading…</p>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] py-12">
              <FileText className="h-12 w-12 text-zinc-500" />
              <p className="mt-2 text-zinc-400">
                {searchDebounced || statusFilter
                  ? 'No invoices match your filters.'
                  : 'No invoices yet. Create your first invoice to get started.'}
              </p>
              <If condition={canEditInvoices}>
                <Button
                  size="sm"
                  className="mt-4 bg-emerald-600 hover:bg-emerald-500"
                  onClick={openCreateSheet}
                  disabled={creating}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create invoice
                </Button>
              </If>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-y-1 border-spacing-x-0">
                <thead>
                  <tr className="text-zinc-400">
                    <th className="pb-2 pr-4 font-medium">Number</th>
                    <th className="pb-2 pr-4 font-medium">Client</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 pr-4 font-medium">Due date</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Updated</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="bg-[var(--workspace-shell-panel)]/70 hover:bg-[var(--workspace-shell-panel-hover)] transition-colors"
                    >
                      <td className="rounded-l-xl py-2.5 pl-3 pr-4 font-medium text-white">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {inv.clients?.display_name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {formatPence(inv.total_pence)}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-300">
                        {formatDate(inv.due_at)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            (() => {
                              const status = displayStatus(inv);
                              return status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : status === 'sent'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : status === 'draft'
                                    ? 'bg-zinc-500/20 text-zinc-400'
                                    : status === 'overdue'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : 'bg-zinc-600/20 text-zinc-400';
                            })()
                          }`}
                        >
                          {displayStatus(inv)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-500">
                        {formatDate(inv.updated_at)}
                      </td>
                      <td className="rounded-r-xl py-2.5 pr-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-white"
                          onClick={() =>
                            router.push(editPathBase.replace('[id]', inv.id))
                          }
                        >
                          {canEditInvoices && inv.status === 'draft' && !canManageInvoiceStatus
                            ? 'Edit'
                            : canEditInvoices && inv.status === 'draft'
                              ? 'Edit'
                              : 'View'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
              <span>
                Page {page} of {totalPages} ({total} invoices)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="border-zinc-600 text-zinc-300"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-zinc-600 text-zinc-300"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
