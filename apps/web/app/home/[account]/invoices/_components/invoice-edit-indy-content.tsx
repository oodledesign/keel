'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Eye,
  Loader2,
  PlusCircle,
  Repeat,
  Send,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';
import { listJobs } from '~/home/[account]/jobs/_lib/server/server-actions';

import { getErrorMessage } from '../_lib/error-message';
import {
  computeInvoiceTotals,
  formatPence,
  type DepositType,
  type DiscountType,
  type LateFeeType,
} from '../_lib/invoice-totals';
import {
  setInvoiceStatus,
  updateInvoice,
  upsertInvoiceItems,
  upsertRecurringSeriesAction,
} from '../_lib/server/server-actions';
import { InvoiceRowMenu } from './invoice-row-menu';
import { InvoiceSendPanel } from './invoice-send-panel';

type InvoiceItem = {
  id?: string;
  job_id?: string | null;
  sort_order: number;
  description: string;
  description_detail?: string | null;
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
  issued_at: string | null;
  subtotal_pence: number;
  total_pence: number;
  currency: string;
  notes: string | null;
  title: string | null;
  reference_number: string | null;
  footer_message: string | null;
  private_note: string | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  tax_rate_bp: number | null;
  deposit_type: DepositType | null;
  deposit_value: number | null;
  late_fee_type: LateFeeType | null;
  late_fee_value: number | null;
  email_subject: string | null;
  email_body: string | null;
  email_signature: string | null;
  sent_to_email: string | null;
  items: InvoiceItem[];
  client: ClientInfo | null;
};

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'read', label: 'Read' },
  { key: 'paid', label: 'Paid' },
] as const;

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function statusStepIndex(status: string): number {
  if (status === 'paid') return 3;
  if (status === 'read') return 2;
  if (status === 'sent' || status === 'overdue') return 1;
  return 0;
}

function penceToPoundsInput(pence: number): string {
  if (pence === 0) return '';
  return (pence / 100).toFixed(2);
}

function poundsInputToPence(value: string): number {
  const v = parseFloat(value);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
}

function clientDisplayName(client: ClientInfo | null): string {
  if (!client) return '—';
  return (
    client.display_name ??
    ([client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unnamed')
  );
}

export function InvoiceEditIndyContent({
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

  const isDraft = invoice.status === 'draft';
  const isLocked = invoice.status !== 'draft';
  const canModifyInvoice = canEditInvoices && isDraft;
  const currentStep = statusStepIndex(invoice.status);

  const [previewMode, setPreviewMode] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(invoice.title ?? '');
  const [referenceNumber, setReferenceNumber] = useState(
    invoice.reference_number ?? '',
  );
  const [issuedAt, setIssuedAt] = useState(
    toDateInputValue(invoice.issued_at) ||
      new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = useState(toDateInputValue(invoice.due_at));
  const [clientId, setClientId] = useState(invoice.client_id ?? '');
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [footerMessage, setFooterMessage] = useState(
    invoice.footer_message ?? '',
  );
  const [privateNote, setPrivateNote] = useState(invoice.private_note ?? '');

  const [discountType, setDiscountType] = useState<DiscountType | ''>(
    invoice.discount_type ?? '',
  );
  const [discountValue, setDiscountValue] = useState(
    invoice.discount_type === 'fixed'
      ? penceToPoundsInput(invoice.discount_value ?? 0)
      : String(invoice.discount_value ?? ''),
  );
  const [taxRatePercent, setTaxRatePercent] = useState(
    invoice.tax_rate_bp ? String(invoice.tax_rate_bp / 100) : '',
  );
  const [depositType, setDepositType] = useState<DepositType | ''>(
    invoice.deposit_type ?? '',
  );
  const [depositValue, setDepositValue] = useState(
    invoice.deposit_type === 'fixed'
      ? penceToPoundsInput(invoice.deposit_value ?? 0)
      : String(invoice.deposit_value ?? ''),
  );
  const [lateFeeType, setLateFeeType] = useState<LateFeeType | ''>(
    invoice.late_fee_type ?? '',
  );
  const [lateFeeValue, setLateFeeValue] = useState(
    invoice.late_fee_type === 'fixed'
      ? penceToPoundsInput(invoice.late_fee_value ?? 0)
      : String(invoice.late_fee_value ?? ''),
  );

  const [showDiscount, setShowDiscount] = useState(
    Boolean(invoice.discount_type && (invoice.discount_value ?? 0) > 0),
  );
  const [showTax, setShowTax] = useState(Boolean(invoice.tax_rate_bp));
  const [showDeposit, setShowDeposit] = useState(
    Boolean(invoice.deposit_type && (invoice.deposit_value ?? 0) > 0),
  );
  const [showLateFee, setShowLateFee] = useState(
    Boolean(invoice.late_fee_type && (invoice.late_fee_value ?? 0) > 0),
  );

  const [emailSubject, setEmailSubject] = useState(invoice.email_subject ?? '');
  const [emailBody, setEmailBody] = useState(invoice.email_body ?? '');
  const [emailSignature, setEmailSignature] = useState(
    invoice.email_signature ?? '',
  );

  const [items, setItems] = useState<InvoiceItem[]>(() =>
    (invoice.items ?? []).map((it: InvoiceItem) => ({
      id: it.id,
      job_id: it.job_id ?? null,
      sort_order: it.sort_order,
      description: it.description,
      description_detail: it.description_detail ?? '',
      quantity: it.quantity,
      unit_price_pence: it.unit_price_pence,
      total_pence: it.total_pence,
    })),
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

  const readOnly = previewMode || !canModifyInvoice;

  const jobsForClient = useMemo(
    () => jobs.filter((j) => j.client_id === clientId),
    [jobs, clientId],
  );

  const lineSubtotalPence = useMemo(
    () =>
      items.reduce(
        (sum, row) => sum + row.quantity * row.unit_price_pence,
        0,
      ),
    [items],
  );

  const parsedDiscountValue = useMemo(() => {
    if (!showDiscount || !discountType) return 0;
    if (discountType === 'fixed') return poundsInputToPence(discountValue);
    const n = parseInt(discountValue, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [discountType, discountValue, showDiscount]);

  const parsedTaxRateBp = useMemo(() => {
    if (!showTax) return 0;
    const n = parseFloat(taxRatePercent);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }, [showTax, taxRatePercent]);

  const parsedDepositValue = useMemo(() => {
    if (!showDeposit || !depositType) return 0;
    if (depositType === 'fixed') return poundsInputToPence(depositValue);
    const n = parseInt(depositValue, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [depositType, depositValue, showDeposit]);

  const parsedLateFeeValue = useMemo(() => {
    if (!showLateFee || !lateFeeType) return 0;
    if (lateFeeType === 'fixed') return poundsInputToPence(lateFeeValue);
    const n = parseInt(lateFeeValue, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [lateFeeType, lateFeeValue, showLateFee]);

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        subtotal_pence: lineSubtotalPence,
        discount_type: showDiscount ? discountType || null : null,
        discount_value: parsedDiscountValue,
        tax_rate_bp: parsedTaxRateBp,
        deposit_type: showDeposit ? depositType || null : null,
        deposit_value: parsedDepositValue,
        late_fee_type: showLateFee ? lateFeeType || null : null,
        late_fee_value: parsedLateFeeValue,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: invoice.status,
      }),
    [
      lineSubtotalPence,
      showDiscount,
      discountType,
      parsedDiscountValue,
      parsedTaxRateBp,
      showDeposit,
      depositType,
      parsedDepositValue,
      showLateFee,
      lateFeeType,
      parsedLateFeeValue,
      dueAt,
      invoice.status,
    ],
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
        setClients(
          (list ?? []) as { id: string; display_name: string | null }[],
        );
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
        description_detail: '',
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
    if (!canModifyInvoice) return;
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
        title: title.trim() || null,
        reference_number: referenceNumber.trim() || null,
        footer_message: footerMessage.trim() || null,
        private_note: privateNote.trim() || null,
        discount_type: showDiscount && discountType ? discountType : null,
        discount_value:
          showDiscount && discountType ? parsedDiscountValue : null,
        tax_rate_bp: showTax ? parsedTaxRateBp : null,
        deposit_type: showDeposit && depositType ? depositType : null,
        deposit_value:
          showDeposit && depositType ? parsedDepositValue : null,
        late_fee_type: showLateFee && lateFeeType ? lateFeeType : null,
        late_fee_value:
          showLateFee && lateFeeType ? parsedLateFeeValue : null,
        email_subject: emailSubject.trim() || null,
        email_body: emailBody.trim() || null,
        email_signature: emailSignature.trim() || null,
      });

      const itemsPayload = items.map((row, i) => ({
        id: row.id,
        job_id: row.job_id ?? null,
        sort_order: i,
        description: row.description.trim() || 'Item',
        description_detail: row.description_detail?.trim() || null,
        quantity: Math.max(0, row.quantity),
        unit_price_pence: Math.max(0, row.unit_price_pence),
        total_pence:
          Math.max(0, row.quantity) * Math.max(0, row.unit_price_pence),
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
    canModifyInvoice,
    clientId,
    dueAt,
    emailBody,
    emailSignature,
    emailSubject,
    footerMessage,
    invoice.id,
    items,
    notes,
    parsedDepositValue,
    parsedDiscountValue,
    parsedLateFeeValue,
    parsedTaxRateBp,
    privateNote,
    referenceNumber,
    router,
    showDeposit,
    showDiscount,
    showLateFee,
    showTax,
    depositType,
    discountType,
    lateFeeType,
    title,
  ]);

  const handleMakeRecurring = useCallback(async () => {
    if (!canEditInvoices || !clientId) {
      toast.error('Save the invoice with a client first');
      return;
    }
    const frequency = window.prompt(
      'Frequency: weekly, fortnightly, monthly, quarterly, or yearly',
      'monthly',
    );
    if (!frequency) return;
    const valid = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'];
    if (!valid.includes(frequency)) {
      toast.error('Invalid frequency');
      return;
    }
    try {
      await upsertRecurringSeriesAction({
        accountId,
        client_id: clientId,
        title: title.trim() || `Invoice ${invoice.invoice_number}`,
        currency: invoice.currency ?? 'gbp',
        frequency: frequency as 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly',
        next_issue_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        auto_send: false,
        template: {
          title: title.trim() || null,
          reference_number: referenceNumber.trim() || null,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          notes: notes.trim() || null,
          footer_message: footerMessage.trim() || null,
          discount_type: showDiscount ? discountType : null,
          discount_value: parsedDiscountValue,
          tax_rate_bp: parsedTaxRateBp,
          deposit_type: showDeposit ? depositType : null,
          deposit_value: parsedDepositValue,
          late_fee_type: showLateFee ? lateFeeType : null,
          late_fee_value: parsedLateFeeValue,
          email_subject: emailSubject,
          email_body: emailBody,
          email_signature: emailSignature,
          items: items.map((row, i) => ({
            job_id: row.job_id ?? null,
            sort_order: i,
            description: row.description,
            description_detail: row.description_detail,
            quantity: row.quantity,
            unit_price_pence: row.unit_price_pence,
            total_pence: row.total_pence,
          })),
        },
      });
      toast.success('Recurring series created');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [
    accountId,
    canEditInvoices,
    clientId,
    dueAt,
    emailBody,
    emailSignature,
    emailSubject,
    footerMessage,
    invoice.currency,
    invoice.invoice_number,
    items,
    notes,
    parsedDepositValue,
    parsedDiscountValue,
    parsedLateFeeValue,
    parsedTaxRateBp,
    referenceNumber,
    showDeposit,
    showDiscount,
    showLateFee,
    showTax,
    depositType,
    discountType,
    lateFeeType,
    title,
  ]);

  const defaultSendEmail =
    invoice.sent_to_email ??
    (invoice.client as ClientInfo | null)?.email ??
    '';

  const canvasClassName =
    'rounded-xl border border-zinc-200 bg-white p-8 text-[#1E293B] shadow-sm';

  const inputClassName =
    'border-zinc-200 bg-white text-[#1E293B] placeholder:text-zinc-400';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-zinc-400 hover:text-white"
          >
            <Link href={invoicesPath}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to invoices
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <Eye className="h-4 w-4 text-zinc-400" />
              <Label htmlFor="preview-mode" className="text-sm text-zinc-300">
                Preview
              </Label>
              <Switch
                id="preview-mode"
                checked={previewMode}
                onCheckedChange={setPreviewMode}
              />
            </div>

            {canEditInvoices ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !canModifyInvoice}
                  className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save
                </Button>

                {isDraft && canEditInvoices ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
                    onClick={() => setShowSendPanel(true)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send invoice
                  </Button>
                ) : null}

                {canEditInvoices ? (
                  <Button size="sm" variant="outline" onClick={() => void handleMakeRecurring()}>
                    <Repeat className="mr-2 h-4 w-4" />
                    Make recurring
                  </Button>
                ) : null}
              </>
            ) : null}

            <InvoiceRowMenu
              accountId={accountId}
              accountSlug={accountSlug}
              invoice={{
                id: invoice.id,
                status: invoice.status,
                invoice_number: invoice.invoice_number,
              }}
              canEditInvoices={canEditInvoices}
              canManageInvoiceStatus={canManageInvoiceStatus}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              Invoice #{invoice.invoice_number} ·{' '}
              {formatPence(totals.total_pence, invoice.currency ?? 'GBP')}
            </h1>
            {title.trim() ? (
              <p className="mt-1 text-sm text-zinc-400">{title}</p>
            ) : null}
          </div>

          <ol className="flex flex-wrap items-center gap-1 text-xs sm:gap-2">
            {STATUS_STEPS.map((step, index) => {
              const active = index === currentStep;
              const complete = index < currentStep;
              return (
                <li key={step.key} className="flex items-center gap-1 sm:gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      active
                        ? 'bg-[var(--keel-teal)]/20 text-[#5eead4]'
                        : complete
                          ? 'bg-white/10 text-zinc-300'
                          : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < STATUS_STEPS.length - 1 ? (
                    <span className="hidden text-zinc-600 sm:inline">→</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {isLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {invoice.status === 'paid'
            ? 'This invoice has been paid and is locked.'
            : invoice.status === 'cancelled' || invoice.status === 'void'
              ? 'This invoice is no longer editable.'
              : 'This invoice has been sent. Line items and amounts are read-only — use the menu to resend or update status.'}
        </div>
      ) : null}

      {showSendPanel && isDraft ? (
        <InvoiceSendPanel
          accountId={accountId}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          totalPence={totals.total_pence}
          defaultEmail={defaultSendEmail}
          initialSubject={emailSubject}
          initialBody={emailBody}
          initialSignature={emailSignature}
          onSent={() => {
            setShowSendPanel(false);
            router.refresh();
          }}
          onClose={() => setShowSendPanel(false)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={canvasClassName}>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {readOnly ? (
                    <h2 className="text-2xl font-bold text-[#1E293B]">
                      {title.trim() || `Invoice ${invoice.invoice_number}`}
                    </h2>
                  ) : (
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`Invoice ${invoice.invoice_number}`}
                      className={`text-2xl font-bold ${inputClassName}`}
                    />
                  )}
                </div>

                <div>
                  <Label className="text-zinc-600">Reference</Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    disabled={readOnly}
                    placeholder="PO-12345"
                    className={`mt-1 ${inputClassName}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-600">Issued</Label>
                    <Input
                      type="date"
                      value={
                        isLocked
                          ? toDateInputValue(invoice.issued_at)
                          : issuedAt
                      }
                      onChange={(e) => setIssuedAt(e.target.value)}
                      disabled={readOnly || isLocked}
                      className={`mt-1 ${inputClassName}`}
                    />
                    {!isLocked ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Final issue date is set when you send.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-zinc-600">Due</Label>
                    <Input
                      type="date"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                      disabled={readOnly}
                      className={`mt-1 ${inputClassName}`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-zinc-600">Bill to</Label>
                <div className="mt-1">
                  <ClientCombobox
                    clients={clients}
                    value={clientId}
                    onValueChange={setClientId}
                    loading={clientsLoading}
                    disabled={readOnly}
                    placeholder="Select client"
                    addClientHref={pathsConfig.app.accountClients.replace(
                      '[account]',
                      accountSlug,
                    )}
                  />
                </div>
                {clientsError ? (
                  <p className="mt-1.5 text-sm text-amber-600">{clientsError}</p>
                ) : null}
                {invoice.client && clientId === invoice.client_id ? (
                  <div className="mt-3 text-sm text-zinc-600">
                    <p className="font-medium text-[#1E293B]">
                      {clientDisplayName(invoice.client)}
                    </p>
                    {invoice.client.company_name ? (
                      <p>{invoice.client.company_name}</p>
                    ) : null}
                    {invoice.client.email ? (
                      <p>{invoice.client.email}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500">
                        <th className="pb-2 pr-2 font-medium">Description</th>
                        <th className="w-20 pb-2 pr-2 font-medium text-right">
                          Qty
                        </th>
                        <th className="w-28 pb-2 pr-2 font-medium text-right">
                          Unit price
                        </th>
                        <th className="w-28 pb-2 pr-2 font-medium text-right">
                          Amount
                        </th>
                        {!readOnly ? <th className="w-10 pb-2" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={readOnly ? 4 : 5}
                            className="py-6 text-center text-zinc-400"
                          >
                            No line items yet.
                          </td>
                        </tr>
                      ) : (
                        items.map((row, index) => (
                          <tr
                            key={row.id ?? index}
                            className="border-b border-zinc-100 align-top"
                          >
                            <td className="py-3 pr-2">
                              <Input
                                value={row.description}
                                onChange={(e) =>
                                  updateItem(index, {
                                    description: e.target.value,
                                  })
                                }
                                disabled={readOnly}
                                placeholder="Description"
                                className={`mb-2 ${inputClassName}`}
                              />
                              <Input
                                value={row.description_detail ?? ''}
                                onChange={(e) =>
                                  updateItem(index, {
                                    description_detail: e.target.value,
                                  })
                                }
                                disabled={readOnly}
                                placeholder="Additional details (optional)"
                                className={`text-xs ${inputClassName}`}
                              />
                              <div className="mt-2">
                                <select
                                  value={row.job_id ?? ''}
                                  onChange={(e) =>
                                    updateItem(index, {
                                      job_id: e.target.value || null,
                                    })
                                  }
                                  disabled={readOnly || jobsLoading}
                                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-[#1E293B]"
                                >
                                  <option value="">Link to job (optional)</option>
                                  {jobsForClient.map((j) => (
                                    <option key={j.id} value={j.id}>
                                      {j.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="py-3 pr-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={(e) =>
                                  updateItem(index, {
                                    quantity: parseInt(e.target.value, 10) || 0,
                                  })
                                }
                                disabled={readOnly}
                                className={`text-right ${inputClassName}`}
                              />
                            </td>
                            <td className="py-3 pr-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                value={penceToPoundsInput(row.unit_price_pence)}
                                onChange={(e) =>
                                  updateItem(index, {
                                    unit_price_pence: poundsInputToPence(
                                      e.target.value,
                                    ),
                                  })
                                }
                                disabled={readOnly}
                                placeholder="0.00"
                                className={`text-right ${inputClassName}`}
                              />
                            </td>
                            <td className="py-3 pr-2 text-right font-medium text-[#1E293B]">
                              {formatPence(
                                row.quantity * row.unit_price_pence,
                                invoice.currency ?? 'GBP',
                              )}
                            </td>
                            {!readOnly ? (
                              <td className="py-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500"
                                  onClick={() => removeRow(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!readOnly ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addRow}
                      className="border-zinc-200 text-[#1E293B] hover:bg-zinc-50"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add line
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDiscount((v) => !v)}
                      className="border-zinc-200 text-[#1E293B] hover:bg-zinc-50"
                    >
                      {showDiscount ? 'Hide discount' : 'Add discount'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTax((v) => !v)}
                      className="border-zinc-200 text-[#1E293B] hover:bg-zinc-50"
                    >
                      {showTax ? 'Hide tax' : 'Add tax'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeposit((v) => !v)}
                      className="border-zinc-200 text-[#1E293B] hover:bg-zinc-50"
                    >
                      {showDeposit ? 'Hide deposit' : 'Request deposit'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLateFee((v) => !v)}
                      className="border-zinc-200 text-[#1E293B] hover:bg-zinc-50"
                    >
                      {showLateFee ? 'Hide late fees' : 'Add late fees'}
                    </Button>
                  </div>
                ) : null}
              </div>

              {(showDiscount || showTax || showDeposit || showLateFee) &&
              !readOnly ? (
                <div className="grid gap-4 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2">
                  {showDiscount ? (
                    <div className="space-y-2">
                      <Label className="text-zinc-600">Discount</Label>
                      <div className="flex gap-2">
                        <select
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(e.target.value as DiscountType | '')
                          }
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed (£)</option>
                        </select>
                        <Input
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={
                            discountType === 'fixed' ? '0.00' : '10'
                          }
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {showTax ? (
                    <div className="space-y-2">
                      <Label className="text-zinc-600">Tax rate (%)</Label>
                      <Input
                        value={taxRatePercent}
                        onChange={(e) => setTaxRatePercent(e.target.value)}
                        placeholder="20"
                        className={inputClassName}
                      />
                    </div>
                  ) : null}

                  {showDeposit ? (
                    <div className="space-y-2">
                      <Label className="text-zinc-600">Deposit</Label>
                      <div className="flex gap-2">
                        <select
                          value={depositType}
                          onChange={(e) =>
                            setDepositType(e.target.value as DepositType | '')
                          }
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed (£)</option>
                        </select>
                        <Input
                          value={depositValue}
                          onChange={(e) => setDepositValue(e.target.value)}
                          placeholder={
                            depositType === 'fixed' ? '0.00' : '50'
                          }
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {showLateFee ? (
                    <div className="space-y-2">
                      <Label className="text-zinc-600">Late fee</Label>
                      <div className="flex gap-2">
                        <select
                          value={lateFeeType}
                          onChange={(e) =>
                            setLateFeeType(e.target.value as LateFeeType | '')
                          }
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">Fixed (£)</option>
                        </select>
                        <Input
                          value={lateFeeValue}
                          onChange={(e) => setLateFeeValue(e.target.value)}
                          placeholder={
                            lateFeeType === 'fixed' ? '0.00' : '5'
                          }
                          className={inputClassName}
                        />
                      </div>
                      <p className="text-xs text-zinc-500">
                        Applied when the invoice is overdue.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-zinc-200 pt-4">
                <dl className="ml-auto max-w-sm space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-600">Subtotal</dt>
                    <dd className="font-medium text-[#1E293B]">
                      {formatPence(
                        totals.subtotal_pence,
                        invoice.currency ?? 'GBP',
                      )}
                    </dd>
                  </div>
                  {totals.discount_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-emerald-700">
                      <dt>Discount</dt>
                      <dd>
                        −
                        {formatPence(
                          totals.discount_pence,
                          invoice.currency ?? 'GBP',
                        )}
                      </dd>
                    </div>
                  ) : null}
                  {totals.tax_pence > 0 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-600">Tax</dt>
                      <dd className="font-medium text-[#1E293B]">
                        {formatPence(
                          totals.tax_pence,
                          invoice.currency ?? 'GBP',
                        )}
                      </dd>
                    </div>
                  ) : null}
                  {totals.late_fee_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-amber-700">
                      <dt>Late fee</dt>
                      <dd>
                        {formatPence(
                          totals.late_fee_pence,
                          invoice.currency ?? 'GBP',
                        )}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t border-zinc-200 pt-2 text-base">
                    <dt className="font-semibold text-[#1E293B]">Total</dt>
                    <dd className="font-bold text-[#1E293B]">
                      {formatPence(
                        totals.total_pence,
                        invoice.currency ?? 'GBP',
                      )}
                    </dd>
                  </div>
                  {totals.deposit_due_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-zinc-600">
                      <dt>Deposit due</dt>
                      <dd>
                        {formatPence(
                          totals.deposit_due_pence,
                          invoice.currency ?? 'GBP',
                        )}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="grid gap-4 border-t border-zinc-200 pt-4">
                <div>
                  <Label className="text-zinc-600">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={readOnly}
                    rows={3}
                    placeholder="Notes visible to your client"
                    className={`mt-1 ${inputClassName}`}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600">Footer message</Label>
                  <Textarea
                    value={footerMessage}
                    onChange={(e) => setFooterMessage(e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    placeholder="Thank you for your business"
                    className={`mt-1 ${inputClassName}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-white">Settings</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Email content used when sending this invoice.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-zinc-300">Email subject</Label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    disabled={readOnly}
                    className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Email body</Label>
                  <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    disabled={readOnly}
                    rows={4}
                    className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                  />
                </div>
                <div>
                  <Label className="text-zinc-300">Email signature</Label>
                  <Textarea
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    disabled={readOnly}
                    rows={3}
                    className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                  />
                </div>
              </div>

              {canManageInvoiceStatus &&
              ['sent', 'read'].includes(invoice.status) ? (
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <p className="text-xs text-zinc-400">Quick status</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200"
                    onClick={() =>
                      void setInvoiceStatus({
                        accountId,
                        invoiceId: invoice.id,
                        status: 'paid',
                        payment_method: 'bank_transfer',
                      })
                        .then(() => {
                          toast.success('Marked as paid');
                          router.refresh();
                        })
                        .catch((err) => toast.error(getErrorMessage(err)))
                    }
                  >
                    Mark as paid
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-white">Private note</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Only visible to your team — not shown to clients.
              </p>
              <Textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                disabled={readOnly}
                rows={5}
                placeholder="Internal notes about this invoice"
                className="mt-3 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
              />
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
