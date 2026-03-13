'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Download,
  Link2,
  Loader2,
  PlusCircle,
  Send,
  Trash2,
} from 'lucide-react';

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
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { listJobs } from '~/home/[account]/jobs/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';

import { getErrorMessage } from '../_lib/error-message';
import {
  getInvoicePortalLink,
  sendInvoice,
  setInvoiceStatus,
  updateInvoice,
  upsertInvoiceItems,
} from '../_lib/server/server-actions';

type InvoiceItem = {
  id?: string;
  job_id?: string | null;
  sort_order: number;
  description: string;
  quantity: number;
  unit_price_pence: number;
  total_pence: number;
};

type ClientInfo = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
};

type InvoiceData = {
  id: string;
  account_id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  due_at: string | null;
  subtotal_pence: number;
  total_pence: number;
  currency: string;
  notes: string | null;
  items: InvoiceItem[];
  client: ClientInfo | null;
};

function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function InvoiceEditContent({
  accountSlug,
  accountId,
  invoice: initialInvoice,
  canEditInvoices,
  canManageInvoiceStatus,
}: {
  accountSlug: string;
  accountId: string;
  invoice: Record<string, unknown>;
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
}) {
  const router = useRouter();
  const invoice = initialInvoice as unknown as InvoiceData;
  const invoicesPath = pathsConfig.app.accountInvoices.replace(
    '[account]',
    accountSlug,
  );

  const [clientId, setClientId] = useState(invoice.client_id ?? '');
  const [dueAt, setDueAt] = useState(toDateInputValue(invoice.due_at));
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [items, setItems] = useState<InvoiceItem[]>(() =>
    (invoice.items ?? []).map((it: InvoiceItem) => ({
      id: it.id,
      job_id: it.job_id ?? null,
      sort_order: it.sort_order,
      description: it.description,
      quantity: it.quantity,
      unit_price_pence: it.unit_price_pence,
      total_pence: it.total_pence,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState(
    (invoice.client as ClientInfo)?.email ?? '',
  );
  const [clients, setClients] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<
    { id: string; title: string; client_id: string | null }[]
  >([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState<
    null | 'cancelled' | 'cash' | 'bank_transfer'
  >(null);

  const jobsForClient = useMemo(
    () => jobs.filter((j) => j.client_id === clientId),
    [jobs, clientId],
  );

  const subtotalPence = useMemo(
    () => items.reduce((sum, row) => sum + row.quantity * row.unit_price_pence, 0),
    [items],
  );

  useEffect(() => {
    if (!accountId) return;
    setClientsLoading(true);
    setClientsError(null);
    listClients({ accountId, page: 1, pageSize: 100 })
      .then((r: unknown) => {
        const raw = r as { data?: unknown } | unknown[];
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
        setClients((list ?? []) as { id: string; display_name: string | null }[]);
      })
      .catch((err) => {
        setClientsError(
          err instanceof Error ? err.message : 'Failed to load clients',
        );
        setClients([]);
        toast.error(getErrorMessage(err));
      })
      .finally(() => setClientsLoading(false));
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    setJobsLoading(true);
    listJobs({
      accountId,
      tab: 'active',
      page: 1,
      pageSize: 100,
    })
      .then((r: unknown) => {
        const raw = r as { data?: unknown };
        const list = Array.isArray(raw?.data) ? raw.data : [];
        setJobs(
          list as { id: string; title: string; client_id: string | null }[],
        );
      })
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, [accountId]);

  const updateItem = useCallback(
    (index: number, updates: Partial<InvoiceItem>) => {
      setItems((prev) => {
        const next = [...prev];
        const row = { ...next[index]!, ...updates };
        row.total_pence = row.quantity * row.unit_price_pence;
        next[index] = row;
        return next;
      });
    },
    [],
  );

  const addRow = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        sort_order: prev.length,
        description: '',
        quantity: 1,
        unit_price_pence: 0,
        total_pence: 0,
      },
    ]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((row, i) => ({ ...row, sort_order: i }));
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!(canEditInvoices && invoice.status === 'draft')) return;
    if (!clientId.trim()) {
      toast.error('Please select a client');
      return;
    }
    setSaving(true);
    try {
      await updateInvoice({
        accountId,
        invoiceId: invoice.id,
        client_id: clientId.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      const itemsPayload = items.map((row, i) => ({
        id: row.id,
        job_id: row.job_id ?? null,
        sort_order: i,
        description: row.description.trim() || 'Item',
        quantity: Math.max(0, row.quantity),
        unit_price_pence: Math.max(0, row.unit_price_pence),
        total_pence: Math.max(0, row.quantity) * Math.max(0, row.unit_price_pence),
      }));
      await upsertInvoiceItems({
        accountId,
        invoiceId: invoice.id,
        items: itemsPayload,
      });
      toast.success('Invoice saved');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    accountId,
    canEditInvoices,
    clientId,
    dueAt,
    invoice.status,
    invoice.id,
    items,
    notes,
    router,
  ]);

  const handleSend = useCallback(async () => {
    if (!canEditInvoices || !sendEmail.trim()) {
      toast.error('Please enter the recipient email');
      return;
    }
    const email = sendEmail.trim();
    const valid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSending(true);
    try {
      await sendInvoice({
        accountId,
        invoiceId: invoice.id,
        sent_to_email: email,
      });
      toast.success('Invoice sent');
      setSendDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }, [accountId, canEditInvoices, invoice.id, router, sendEmail]);

  const isDraft = invoice.status === 'draft';
  const isLocked = invoice.status !== 'draft';
  const canModifyInvoice = canEditInvoices && !isLocked;
  const canSend = isDraft && canEditInvoices;
  const isOverdue =
    invoice.status === 'sent' &&
    invoice.due_at &&
    new Date(invoice.due_at) < new Date(new Date().toDateString());

  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';
  const canCreatePaymentLink =
    invoice.status === 'sent' && canEditInvoices && !isPaid;
  const canCancelInvoice =
    canManageInvoiceStatus && invoice.status === 'sent';
  const canMarkPaidManually =
    canManageInvoiceStatus && invoice.status === 'sent';

  const handleCreatePaymentLink = useCallback(async () => {
    if (!canCreatePaymentLink) {
      toast.error('You can only create a payment link for a sent invoice');
      return;
    }
    setCreatingPaymentLink(true);
    try {
      const result = await getInvoicePortalLink({
        accountId,
        invoiceId: invoice.id,
      });
      const token =
        (result as { token?: string } | null)?.token ??
        (result as { data?: { token?: string } } | null)?.data?.token;
      if (!token) {
        toast.error('Could not generate payment link');
        return;
      }
      const origin =
        typeof window !== 'undefined' && window.location.origin
          ? window.location.origin
          : '';
      const url = `${origin}/portal/invoices/${encodeURIComponent(token)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Payment link copied to clipboard');
      } catch {
        toast.success(`Payment link ready: ${url}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreatingPaymentLink(false);
    }
  }, [accountId, canCreatePaymentLink, invoice.id]);

  const handleStatusChange = useCallback(
    async (
      status: 'cancelled' | 'paid',
      paymentMethod?: 'cash' | 'bank_transfer',
    ) => {
      if (
        status === 'cancelled' &&
        !window.confirm(
          'Cancel this invoice? The public payment link will stop accepting payments.',
        )
      ) {
        return;
      }

      if (
        status === 'paid' &&
        !window.confirm(
          `Mark this invoice as paid via ${
            paymentMethod === 'cash' ? 'cash' : 'bank transfer'
          }?`,
        )
      ) {
        return;
      }

      setStatusActionLoading(status === 'cancelled' ? 'cancelled' : paymentMethod ?? null);

      try {
        await setInvoiceStatus({
          accountId,
          invoiceId: invoice.id,
          status,
          payment_method: paymentMethod,
        });

        toast.success(
          status === 'cancelled'
            ? 'Invoice cancelled'
            : `Invoice marked as paid via ${
                paymentMethod === 'cash' ? 'cash' : 'bank transfer'
              }`,
        );

        router.refresh();
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setStatusActionLoading(null);
      }
    },
    [accountId, invoice.id, router],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" size="sm" asChild className="text-zinc-400 hover:text-white">
          <Link href={invoicesPath}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to invoices
          </Link>
        </Button>
        {canEditInvoices && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !canModifyInvoice}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
            {canSend && (
              <Button
                size="sm"
                variant="outline"
                className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
                onClick={() => {
                  setSendEmail(
                    (invoice.client as ClientInfo)?.email ?? sendEmail,
                  );
                  setSendDialogOpen(true);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send invoice
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              asChild
              className="border border-emerald-400/40 bg-transparent text-emerald-300 hover:bg-emerald-500/10"
            >
              <a
                href={`/api/invoices/pdf?invoiceId=${encodeURIComponent(invoice.id)}`}
                download={`invoice-${invoice.invoice_number}.pdf`}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canCreatePaymentLink || creatingPaymentLink}
              onClick={handleCreatePaymentLink}
              className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)] disabled:text-zinc-500"
            >
              <Link2 className="mr-2 h-4 w-4" />
              {creatingPaymentLink ? 'Creating…' : 'Create payment link'}
            </Button>
            {canCancelInvoice && (
              <Button
                size="sm"
                variant="outline"
                disabled={statusActionLoading !== null}
                onClick={() => void handleStatusChange('cancelled')}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                {statusActionLoading === 'cancelled' ? 'Cancelling…' : 'Cancel invoice'}
              </Button>
            )}
            {canMarkPaidManually && (
              <Button
                size="sm"
                variant="outline"
                disabled={statusActionLoading !== null}
                onClick={() => void handleStatusChange('paid', 'bank_transfer')}
                className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                {statusActionLoading === 'bank_transfer'
                  ? 'Updating…'
                  : 'Paid by bank transfer'}
              </Button>
            )}
            {canMarkPaidManually && (
              <Button
                size="sm"
                variant="outline"
                disabled={statusActionLoading !== null}
                onClick={() => void handleStatusChange('paid', 'cash')}
                className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                {statusActionLoading === 'cash' ? 'Updating…' : 'Paid by cash'}
              </Button>
            )}
          </div>
        )}
      </div>

      {isLocked && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {isCancelled
            ? 'This invoice has been cancelled and is now locked.'
            : isPaid
              ? 'This invoice has been paid and is now locked.'
              : 'This invoice has been sent and can no longer be edited. If needed, you can cancel it or mark it paid manually from the actions above.'}
        </div>
      )}

      <div className="rounded-lg border border-zinc-700 bg-[var(--workspace-shell-panel)] p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-zinc-400">Invoice</h2>
            <p className="mt-1 text-xl font-semibold text-white">
              {invoice.invoice_number}
            </p>
            {invoice.status !== 'draft' && (
              <span
                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  invoice.status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isOverdue
                      ? 'bg-amber-500/20 text-amber-400'
                      : invoice.status === 'sent'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                }`}
              >
                {isOverdue ? 'overdue' : invoice.status}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-zinc-300">Client</Label>
            <div className="mt-1">
              <ClientCombobox
                clients={clients}
                value={clientId}
                onValueChange={setClientId}
                loading={clientsLoading}
                disabled={!canModifyInvoice}
                placeholder="Select client"
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
          <div>
            <Label htmlFor="due_at" className="text-zinc-300">
              Due date
            </Label>
            <Input
              id="due_at"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              disabled={!canModifyInvoice}
              className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="notes" className="text-zinc-300">
            Notes (optional)
          </Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canModifyInvoice}
            rows={2}
            className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-white placeholder:text-zinc-500"
            placeholder="Internal or customer notes"
          />
        </div>

        {/* Bill to (read-only from client) */}
        {invoice.client && (
          <div className="mt-6 rounded-md border border-zinc-700 bg-[var(--workspace-shell-panel)] p-4">
            <h3 className="text-sm font-medium text-zinc-400">Bill to</h3>
            <p className="mt-1 font-medium text-white">
              {(invoice.client as ClientInfo).display_name ??
                ([(invoice.client as ClientInfo).first_name, (invoice.client as ClientInfo).last_name]
                  .filter(Boolean)
                  .join(' ') || 'Unnamed')}
            </p>
            {(invoice.client as ClientInfo).company_name && (
              <p className="text-sm text-zinc-300">
                {(invoice.client as ClientInfo).company_name}
              </p>
            )}
            {(invoice.client as ClientInfo).email && (
              <p className="text-sm text-zinc-400">
                {(invoice.client as ClientInfo).email}
              </p>
            )}
          </div>
        )}

        {/* Line items */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-400">Line items</h3>
            {canModifyInvoice && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add row
              </Button>
            )}
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-2 font-medium">Description</th>
                  <th className="w-40 pb-2 pr-2 font-medium">Job</th>
                  <th className="w-24 pb-2 pr-2 font-medium text-right">
                    Qty
                  </th>
                  <th className="w-32 pb-2 pr-2 font-medium text-right">
                    Unit price
                  </th>
                  <th className="w-28 pb-2 pr-2 font-medium text-right">
                    Total
                  </th>
                  {canModifyInvoice && <th className="w-10 pb-2"></th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canModifyInvoice ? 6 : 5}
                      className="py-4 text-center text-zinc-500"
                    >
                      No line items. Add a row to get started.
                    </td>
                  </tr>
                ) : (
                  items.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-zinc-700/70 hover:bg-[var(--workspace-shell-panel-hover)]/70"
                    >
                      <td className="py-2 pr-2">
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            updateItem(index, {
                              description: e.target.value,
                            })
                          }
                          disabled={!canModifyInvoice}
                          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                          placeholder="Description"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          value={row.job_id ?? ''}
                          onChange={(e) =>
                            updateItem(index, {
                              job_id: e.target.value || null,
                            })
                          }
                          disabled={!canModifyInvoice}
                          className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-2 py-1.5 text-sm text-white"
                        >
                          <option value="">—</option>
                          {jobsForClient.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          value={row.quantity}
                          onChange={(e) =>
                            updateItem(index, {
                              quantity: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          disabled={!canModifyInvoice}
                          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-right text-white"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={
                            row.unit_price_pence === 0
                              ? ''
                              : (row.unit_price_pence / 100).toFixed(2)
                          }
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const pence = Number.isFinite(v)
                              ? Math.round(v * 100)
                              : 0;
                            updateItem(index, {
                              unit_price_pence: pence,
                            });
                          }}
                          disabled={!canModifyInvoice}
                          className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-right text-white"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right text-zinc-300">
                        {formatPence(row.quantity * row.unit_price_pence)}
                      </td>
                      {canModifyInvoice && (
                        <td className="py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                            onClick={() => removeRow(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div className="mt-4 flex justify-end border-t border-zinc-700 pt-4">
              <div className="text-right">
                <p className="text-lg font-semibold text-white">
                  Total {formatPence(subtotalPence)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent className="border-zinc-700 bg-[var(--workspace-shell-panel)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Send invoice
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              The client will receive an email with a link to view and pay the
              invoice. Once sent, the invoice will become locked and can no
              longer be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="send_email" className="text-zinc-300">
              Send to email
            </Label>
            <Input
              id="send_email"
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="client@example.com"
              className="mt-2 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
            />
            <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Warning: sending this invoice will lock its line items, client,
              due date, and notes from further editing.
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-600 text-zinc-300">
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
