'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  PlusCircle,
  Repeat,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '@kit/ui/radio-group';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import { listClients } from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/jobs/_components/client-combobox';
import { listJobs } from '~/home/[account]/jobs/_lib/server/server-actions';
import {
  type InvoiceLineType,
  calculateInvoiceLineTotalPence,
  invoiceItemsQuantityHeader,
  invoiceItemsShowUnitPriceColumn,
  invoiceLineQuantityColumnLabel,
  invoiceLineShowsUnitPrice,
  normalizeInvoiceLineType,
  normalizeInvoiceQuantity,
  parseInvoiceQuantityInput,
  resolveInvoiceLineUnitPricePence,
} from '~/lib/invoices/invoice-quantity';

import { getErrorMessage } from '../_lib/error-message';
import {
  INVOICE_CURRENCY_OPTIONS,
  type InvoiceCurrency,
  formatInvoiceMoney,
  invoiceCurrencySymbol,
  normalizeInvoiceCurrency,
} from '../_lib/invoice-currency';
import {
  DEFAULT_INVOICE_EMAIL_BODY,
  DEFAULT_INVOICE_EMAIL_SIGNATURE,
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  DEFAULT_INVOICE_FOOTER_MESSAGE,
  resolveInvoiceEmailField,
} from '../_lib/invoice-smart-fields';
import {
  type DepositType,
  type DiscountType,
  type LateFeeType,
  computeInvoiceTotals,
} from '../_lib/invoice-totals';
import {
  getInvoicePortalLink,
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
  line_type: InvoiceLineType;
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
  project_id: string | null;
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
  project?: { id: string; title: string | null } | null;
  preferred_send_email?: string | null;
  preferred_send_source?: string | null;
  preferred_send_name?: string | null;
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

function addMonths(isoDate: string, months: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return date.toISOString();
}

function clientDisplayName(client: ClientInfo | null): string {
  if (!client) return '—';
  return (
    client.display_name ??
    ([client.first_name, client.last_name].filter(Boolean).join(' ') ||
      'Unnamed')
  );
}

function mapInvoiceItemFromServer(
  it: InvoiceItem & { line_type?: string | null },
  defaultHourlyRatePence: number | null | undefined,
): InvoiceItem {
  const line_type = normalizeInvoiceLineType(it.line_type);
  const quantity = normalizeInvoiceQuantity(Number(it.quantity));
  const unit_price_pence = resolveInvoiceLineUnitPricePence({
    lineType: line_type,
    unitPricePence: it.unit_price_pence,
    defaultHourlyRatePence,
  });

  return {
    id: it.id,
    job_id: it.job_id ?? null,
    sort_order: it.sort_order,
    description: it.description,
    description_detail: it.description_detail ?? '',
    line_type,
    quantity,
    unit_price_pence,
    total_pence: calculateInvoiceLineTotalPence(quantity, unit_price_pence),
  };
}

export function InvoiceEditIndyContent({
  accountSlug,
  accountId,
  invoice: initialInvoice,
  canEditInvoices,
  canManageInvoiceStatus,
  brandLogoUrl = null,
  brandName = null,
  sender = null,
  defaultHourlyRatePence = null,
}: {
  accountSlug: string;
  accountId: string;
  invoice: Record<string, unknown>;
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
  brandLogoUrl?: string | null;
  brandName?: string | null;
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  defaultHourlyRatePence?: number | null;
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
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'
  >('monthly');
  const [recurringStartDate, setRecurringStartDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [recurringDurationMode, setRecurringDurationMode] = useState<
    'months' | 'until_stopped'
  >('months');
  const [recurringMonths, setRecurringMonths] = useState('12');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const [title, setTitle] = useState(invoice.title ?? '');
  const [referenceNumber, setReferenceNumber] = useState(
    invoice.reference_number?.trim() || invoice.invoice_number || '',
  );
  const [issuedAt, setIssuedAt] = useState(
    toDateInputValue(invoice.issued_at) ||
      new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = useState(toDateInputValue(invoice.due_at));
  const [currency, setCurrency] = useState<InvoiceCurrency>(
    normalizeInvoiceCurrency(invoice.currency),
  );
  const currencySymbol = invoiceCurrencySymbol(currency);
  const [clientId, setClientId] = useState(invoice.client_id ?? '');
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [footerMessage, setFooterMessage] = useState(
    invoice.footer_message ?? DEFAULT_INVOICE_FOOTER_MESSAGE,
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

  const [showReferenceField, setShowReferenceField] = useState(true);
  const [showIssuedField, setShowIssuedField] = useState(true);
  const [showDueField, setShowDueField] = useState(true);
  const [showNotesField, setShowNotesField] = useState(true);
  const [showFooterField, setShowFooterField] = useState(true);
  const [showLogoField, setShowLogoField] = useState(true);
  const [showPaymentLinkField, setShowPaymentLinkField] = useState(true);

  const [emailSubject, setEmailSubject] = useState(() =>
    resolveInvoiceEmailField(
      invoice.email_subject,
      DEFAULT_INVOICE_EMAIL_SUBJECT,
    ),
  );
  const [emailBody, setEmailBody] = useState(() =>
    resolveInvoiceEmailField(invoice.email_body, DEFAULT_INVOICE_EMAIL_BODY),
  );
  const [emailSignature, setEmailSignature] = useState(() =>
    resolveInvoiceEmailField(
      invoice.email_signature,
      DEFAULT_INVOICE_EMAIL_SIGNATURE,
    ),
  );

  const [items, setItems] = useState<InvoiceItem[]>(() =>
    (invoice.items ?? []).map((it: InvoiceItem) =>
      mapInvoiceItemFromServer(it, defaultHourlyRatePence),
    ),
  );

  const quantityColumnLabel = invoiceItemsQuantityHeader(items);
  const showUnitPriceColumn = invoiceItemsShowUnitPriceColumn(items);

  const [unitPriceDrafts, setUnitPriceDrafts] = useState<
    Record<string, string>
  >({});

  const unitPriceRowKey = (row: InvoiceItem, index: number) =>
    row.id ?? `new-${index}`;

  const unitPriceInputValue = (row: InvoiceItem, index: number) => {
    const key = unitPriceRowKey(row, index);
    if (key in unitPriceDrafts) return unitPriceDrafts[key]!;
    if (row.unit_price_pence === 0) return '';
    return (row.unit_price_pence / 100).toFixed(2);
  };

  const commitUnitPriceDraft = (index: number) => {
    const row = items[index];
    if (!row) return;
    const key = unitPriceRowKey(row, index);
    const raw = unitPriceDrafts[key];
    if (raw === undefined) return;

    const trimmed = raw.trim();
    const pence =
      trimmed === ''
        ? 0
        : (() => {
            const v = parseFloat(trimmed);
            return Number.isFinite(v)
              ? Math.round(v * 100)
              : row.unit_price_pence;
          })();

    updateItem(index, { unit_price_pence: Math.max(0, pence) });
    setUnitPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const [clients, setClients] = useState<
    { id: string; display_name: string | null }[]
  >([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<
    { id: string; title: string; client_id: string | null }[]
  >([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [projectId, setProjectId] = useState(invoice.project_id ?? '');

  const readOnly = previewMode || !canModifyInvoice;

  const jobsForClient = useMemo(
    () => jobs.filter((j) => j.client_id === clientId),
    [jobs, clientId],
  );

  const lineSubtotalPence = useMemo(
    () =>
      items.reduce(
        (sum, row) =>
          sum +
          calculateInvoiceLineTotalPence(row.quantity, row.unit_price_pence),
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
    if (!accountId || !clientId) {
      setJobs([]);
      setJobsLoading(false);
      return;
    }
    setJobsLoading(true);
    listJobs({
      accountId,
      tab: 'all',
      page: 1,
      pageSize: 200,
      query: undefined,
      status: undefined,
      priority: undefined,
      clientId,
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
  }, [accountId, clientId]);

  useEffect(() => {
    const openStatuses = new Set(['draft', 'sent', 'read', 'overdue']);
    if (!openStatuses.has(invoice.status)) return;

    let cancelled = false;
    void getInvoicePortalLink({ accountId, invoiceId: invoice.id })
      .then((result) => {
        if (cancelled) return;
        const token =
          (result as { token?: string } | null)?.token ??
          (result as { data?: { token?: string } } | null)?.data?.token;
        if (!token) return;
        setPaymentUrl(
          `${window.location.origin}/portal/invoices/${encodeURIComponent(token)}`,
        );
      })
      .catch(() => {
        if (!cancelled) setPaymentUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, invoice.id, invoice.status]);

  const resolvedReference = referenceNumber.trim() || invoice.invoice_number;

  const pdfQuery = useMemo(() => {
    const params = new URLSearchParams({
      showReference: showReferenceField ? '1' : '0',
      showDueDate: showDueField ? '1' : '0',
      showIssuedDate: showIssuedField ? '1' : '0',
      showNotes: showNotesField ? '1' : '0',
      showFooter: showFooterField ? '1' : '0',
      showLogo: showLogoField ? '1' : '0',
      showPaymentLink: showPaymentLinkField ? '1' : '0',
    });
    return params.toString();
  }, [
    showReferenceField,
    showDueField,
    showIssuedField,
    showNotesField,
    showFooterField,
    showLogoField,
    showPaymentLinkField,
  ]);

  const updateItem = useCallback(
    (index: number, updates: Partial<InvoiceItem>) => {
      setItems((prev) => {
        const next = [...prev];
        const row = { ...next[index]!, ...updates };
        row.total_pence = calculateInvoiceLineTotalPence(
          row.quantity,
          row.unit_price_pence,
        );
        next[index] = row;
        return next;
      });
    },
    [],
  );

  const addRow = useCallback(
    (lineType: InvoiceLineType = 'quantity') => {
      const unit_price_pence = resolveInvoiceLineUnitPricePence({
        lineType,
        unitPricePence: 0,
        defaultHourlyRatePence,
      });
      const quantity = 1;

      setItems((prev) => [
        ...prev,
        {
          sort_order: prev.length,
          description: '',
          description_detail: '',
          line_type: lineType,
          quantity,
          unit_price_pence,
          total_pence: calculateInvoiceLineTotalPence(
            quantity,
            unit_price_pence,
          ),
        },
      ]);
    },
    [defaultHourlyRatePence],
  );

  const removeRow = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((row, i) => ({ ...row, sort_order: i }));
    });
  }, []);

  const handleEmailDraftChange = useCallback(
    (email: { subject: string; body: string; signature: string }) => {
      setEmailSubject(email.subject);
      setEmailBody(email.body);
      setEmailSignature(email.signature);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!canModifyInvoice) return false;
    if (!clientId.trim()) {
      toast.error('Please select a client');
      return false;
    }

    setSaving(true);
    try {
      await updateInvoice({
        accountId,
        invoiceId: invoice.id,
        client_id: clientId.trim(),
        project_id: projectId || null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        currency,
        notes: notes.trim() || null,
        title: title.trim() || null,
        reference_number: referenceNumber.trim() || invoice.invoice_number,
        footer_message: footerMessage.trim() || null,
        private_note: privateNote.trim() || null,
        discount_type: showDiscount && discountType ? discountType : null,
        discount_value:
          showDiscount && discountType ? parsedDiscountValue : null,
        tax_rate_bp: showTax ? parsedTaxRateBp : null,
        deposit_type: showDeposit && depositType ? depositType : null,
        deposit_value: showDeposit && depositType ? parsedDepositValue : null,
        late_fee_type: showLateFee && lateFeeType ? lateFeeType : null,
        late_fee_value: showLateFee && lateFeeType ? parsedLateFeeValue : null,
        email_subject: emailSubject.trim() || null,
        email_body: emailBody.trim() || null,
        email_signature: emailSignature.trim() || null,
      });

      const itemsPayload = items.map((row, i) => {
        const lineType = normalizeInvoiceLineType(row.line_type);
        const unitPricePence = resolveInvoiceLineUnitPricePence({
          lineType,
          unitPricePence: row.unit_price_pence,
          defaultHourlyRatePence,
        });
        const quantity = normalizeInvoiceQuantity(row.quantity);

        return {
          id: row.id,
          job_id: row.job_id ?? null,
          sort_order: i,
          description: row.description.trim() || 'Item',
          description_detail: row.description_detail?.trim() || null,
          line_type: lineType,
          quantity,
          unit_price_pence: Math.max(0, unitPricePence),
          total_pence: calculateInvoiceLineTotalPence(quantity, unitPricePence),
        };
      });

      await upsertInvoiceItems({
        accountId,
        invoiceId: invoice.id,
        items: itemsPayload,
      });

      toast.success('Invoice saved');
      router.refresh();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    accountId,
    canModifyInvoice,
    clientId,
    currency,
    defaultHourlyRatePence,
    dueAt,
    emailBody,
    emailSignature,
    emailSubject,
    footerMessage,
    invoice.id,
    invoice.invoice_number,
    items,
    notes,
    parsedDepositValue,
    parsedDiscountValue,
    parsedLateFeeValue,
    parsedTaxRateBp,
    privateNote,
    projectId,
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

    if (canModifyInvoice) {
      const saved = await handleSave();
      if (!saved) return;
    }

    if (!recurringStartDate) {
      toast.error('Choose a start date');
      return;
    }

    const startDate = new Date(`${recurringStartDate}T12:00:00`);
    if (Number.isNaN(startDate.getTime())) {
      toast.error('Choose a valid start date');
      return;
    }

    const months = Math.max(1, parseInt(recurringMonths, 10) || 1);
    const endAt =
      recurringDurationMode === 'months'
        ? addMonths(recurringStartDate, months)
        : null;

    setCreatingRecurring(true);
    try {
      await upsertRecurringSeriesAction({
        accountId,
        client_id: clientId,
        title: title.trim() || `Invoice ${invoice.invoice_number}`,
        currency,
        frequency: recurringFrequency,
        next_issue_at: startDate.toISOString(),
        end_at: endAt,
        max_occurrences: null,
        auto_send: false,
        template: {
          project_id: projectId || null,
          title: title.trim() || null,
          reference_number: referenceNumber.trim() || invoice.invoice_number,
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          notes: notes.trim() || null,
          footer_message: footerMessage.trim() || null,
          discount_type: showDiscount && discountType ? discountType : null,
          discount_value: parsedDiscountValue,
          tax_rate_bp: parsedTaxRateBp,
          deposit_type: showDeposit && depositType ? depositType : null,
          deposit_value: parsedDepositValue,
          late_fee_type: showLateFee && lateFeeType ? lateFeeType : null,
          late_fee_value: parsedLateFeeValue,
          email_subject: emailSubject,
          email_body: emailBody,
          email_signature: emailSignature,
          items: items.map((row, i) => ({
            job_id: row.job_id ?? null,
            sort_order: i,
            description: row.description,
            description_detail: row.description_detail,
            line_type: row.line_type,
            quantity: row.quantity,
            unit_price_pence: row.unit_price_pence,
            total_pence: row.total_pence,
          })),
        },
      });
      toast.success('Recurring series created');
      setRecurringDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreatingRecurring(false);
    }
  }, [
    accountId,
    canEditInvoices,
    canModifyInvoice,
    clientId,
    handleSave,
    recurringStartDate,
    recurringFrequency,
    recurringDurationMode,
    recurringMonths,
    currency,
    dueAt,
    emailBody,
    emailSignature,
    emailSubject,
    footerMessage,
    invoice.invoice_number,
    items,
    notes,
    parsedDepositValue,
    parsedDiscountValue,
    parsedLateFeeValue,
    parsedTaxRateBp,
    projectId,
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
    invoice.preferred_send_email ??
    (invoice.client as ClientInfo | null)?.email ??
    '';

  const handleDownloadPdf = useCallback(async () => {
    setDownloadingPdf(true);
    try {
      const href = `/api/invoices/pdf?invoiceId=${encodeURIComponent(invoice.id)}&${pdfQuery}`;
      const link = document.createElement('a');
      link.href = href;
      link.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloadingPdf(false);
    }
  }, [invoice.id, invoice.invoice_number, pdfQuery]);

  const canvasClassName =
    'rounded-xl border border-[color:var(--ozer-border-on-light)] bg-white p-8 text-[var(--ozer-text-on-light)] shadow-sm';

  const inputClassName =
    'border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)] placeholder:text-[var(--workspace-shell-text-muted)]';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-[color:var(--workspace-shell-border)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            <Link href={invoicesPath}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to invoices
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1.5">
              <Eye className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
              <Label
                htmlFor="preview-mode"
                className="text-sm text-[var(--workspace-shell-text-muted)]"
              >
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
                  className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
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
                    onClick={() => setRecurringDialogOpen(true)}
                  >
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
            <h1 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
              Invoice #{invoice.invoice_number} ·{' '}
              {formatInvoiceMoney(totals.total_pence, currency)}
            </h1>
            {title.trim() ? (
              <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                {title}
              </p>
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
                        ? 'bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)]'
                        : complete
                          ? 'bg-[color-mix(in_srgb,var(--ozer-accent)_22%,transparent)] text-[var(--ozer-accent)]'
                          : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]'
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < STATUS_STEPS.length - 1 ? (
                    <span className="hidden text-[var(--workspace-shell-text-muted)] sm:inline">
                      →
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {isLocked ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/60 bg-amber-200/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          {invoice.status === 'paid'
            ? 'This invoice has been paid and is locked.'
            : invoice.status === 'cancelled' || invoice.status === 'void'
              ? 'This invoice is no longer editable.'
              : 'This invoice has been sent. Line items and amounts are read-only — use the menu to resend or update status.'}
        </div>
      ) : null}

      {showSendPanel && isDraft ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <InvoiceSendPanel
            accountId={accountId}
            invoiceId={invoice.id}
            clientId={invoice.client_id}
            invoiceNumber={invoice.invoice_number}
            totalPence={totals.total_pence}
            dueAt={invoice.due_at}
            currency={currency}
            defaultEmail={defaultSendEmail}
            defaultRecipientName={
              invoice.preferred_send_name ??
              invoice.client?.display_name ??
              [invoice.client?.first_name, invoice.client?.last_name]
                .filter(Boolean)
                .join(' ') ??
              null
            }
            client={invoice.client}
            sender={sender}
            initialSubject={emailSubject}
            initialBody={emailBody}
            initialSignature={emailSignature}
            onEmailChange={handleEmailDraftChange}
            pdfQuery={pdfQuery}
            isDraft={isDraft}
            onSent={() => {
              setShowSendPanel(false);
              router.refresh();
            }}
            onMarkedSent={() => router.refresh()}
            onClose={() => setShowSendPanel(false)}
          />
          <aside className="space-y-4">
            <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Continue editing
              </h2>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Need to change line items or due date before sending?
              </p>
              <Button
                className="mt-4 w-full border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                variant="outline"
                onClick={() => setShowSendPanel(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to edit invoice
              </Button>
            </section>
            <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Private note
              </h2>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Only visible to your team — not shown to clients.
              </p>
              <Textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                disabled={readOnly}
                rows={5}
                placeholder="Internal notes about this invoice"
                className="mt-3 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
              />
            </section>
          </aside>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={canvasClassName}>
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {brandName && previewMode ? (
                    <p className="mb-2 text-sm font-medium text-[var(--workspace-shell-text-muted)]">
                      {brandName}
                    </p>
                  ) : null}
                  {readOnly ? (
                    <h2 className="text-2xl font-bold text-[var(--ozer-text-on-light)]">
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
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                    Invoice #{invoice.invoice_number}
                    {invoice.status === 'draft' ? ' · Draft' : ''}
                  </p>
                </div>
                {showLogoField && brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogoUrl}
                    alt=""
                    className="h-12 w-auto max-w-[140px] object-contain object-right"
                  />
                ) : showLogoField && brandName && !previewMode ? (
                  <p className="max-w-[140px] text-right text-sm font-semibold text-[var(--ozer-text-on-light)]">
                    {brandName}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {showReferenceField ? (
                  <div>
                    <Label className="text-[var(--workspace-shell-text-muted)]">
                      Reference
                    </Label>
                    {previewMode ? (
                      <p className="mt-1 text-sm font-medium text-[var(--ozer-text-on-light)]">
                        {resolvedReference}
                      </p>
                    ) : (
                      <Input
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        disabled={readOnly}
                        placeholder={invoice.invoice_number}
                        className={`mt-1 ${inputClassName}`}
                      />
                    )}
                    {!previewMode ? (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        Defaults to the invoice number. Used for bank payments.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className={`grid gap-3 ${showReferenceField ? 'grid-cols-2' : 'grid-cols-2 sm:col-span-2'}`}
                >
                  {showIssuedField ? (
                    <div>
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Issued
                      </Label>
                      {previewMode ? (
                        <p className="mt-1 text-sm text-[var(--ozer-text-on-light)]">
                          {issuedAt || '—'}
                        </p>
                      ) : (
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
                      )}
                      {!isLocked && !previewMode ? (
                        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                          Final issue date is set when you send.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {showDueField ? (
                    <div>
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Due
                      </Label>
                      {previewMode ? (
                        <p className="mt-1 text-sm font-medium text-[var(--ozer-text-on-light)]">
                          {dueAt || '—'}
                        </p>
                      ) : (
                        <Input
                          type="date"
                          value={dueAt}
                          onChange={(e) => setDueAt(e.target.value)}
                          disabled={readOnly}
                          className={`mt-1 ${inputClassName}`}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Bill to
                  </Label>
                  <div className="mt-1">
                    <ClientCombobox
                      clients={clients}
                      value={clientId}
                      onValueChange={(nextClientId) => {
                        setClientId(nextClientId);
                        const selectedProject = jobs.find(
                          (job) => job.id === projectId,
                        );
                        if (
                          selectedProject &&
                          selectedProject.client_id !== nextClientId
                        ) {
                          setProjectId('');
                        }
                      }}
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
                    <p className="mt-1.5 text-sm text-amber-600">
                      {clientsError}
                    </p>
                  ) : null}
                  {invoice.client && clientId === invoice.client_id ? (
                    <div className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
                      <p className="font-medium text-[var(--ozer-text-on-light)]">
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
                  <Label
                    htmlFor="invoice-currency"
                    className="text-[var(--workspace-shell-text-muted)]"
                  >
                    Currency
                  </Label>
                  {previewMode || readOnly ? (
                    <p className="mt-1 text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {INVOICE_CURRENCY_OPTIONS.find(
                        (o) => o.value === currency,
                      )?.label ?? currency.toUpperCase()}
                    </p>
                  ) : (
                    <select
                      id="invoice-currency"
                      value={currency}
                      onChange={(e) =>
                        setCurrency(e.target.value as InvoiceCurrency)
                      }
                      disabled={readOnly}
                      className={`mt-1 flex h-10 w-full rounded-md border px-3 text-sm ${inputClassName}`}
                    >
                      {INVOICE_CURRENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="sm:col-start-2">
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Project
                  </Label>
                  {previewMode || readOnly ? (
                    <p className="mt-1 text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {jobs.find((job) => job.id === projectId)?.title ??
                        invoice.project?.title ??
                        '—'}
                    </p>
                  ) : (
                    <>
                      <select
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                        disabled={readOnly || jobsLoading || !clientId}
                        className={`mt-1 h-10 w-full rounded-md border px-3 text-sm ${inputClassName}`}
                      >
                        <option value="">No project</option>
                        {jobsForClient.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        Shown on the invoice. Line items can still use their own
                        projects.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--ozer-border-on-light)] text-[var(--workspace-shell-text-muted)]">
                        <th className="pr-2 pb-2 font-medium">Description</th>
                        <th className="w-20 pr-2 pb-2 text-right font-medium">
                          {quantityColumnLabel}
                        </th>
                        {showUnitPriceColumn ? (
                          <th className="w-28 pr-2 pb-2 text-right font-medium">
                            Unit price
                          </th>
                        ) : null}
                        <th className="w-28 pr-2 pb-2 text-right font-medium">
                          Amount
                        </th>
                        {!readOnly ? <th className="w-10 pb-2" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={
                              readOnly
                                ? showUnitPriceColumn
                                  ? 4
                                  : 3
                                : showUnitPriceColumn
                                  ? 5
                                  : 4
                            }
                            className="py-6 text-center text-[var(--workspace-shell-text-muted)]"
                          >
                            No line items yet.
                          </td>
                        </tr>
                      ) : (
                        items.map((row, index) => {
                          const isHoursLine = !invoiceLineShowsUnitPrice(
                            row.line_type,
                          );
                          return (
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
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <select
                                    value={row.line_type}
                                    onChange={(e) => {
                                      const lineType = normalizeInvoiceLineType(
                                        e.target.value,
                                      );
                                      updateItem(index, {
                                        line_type: lineType,
                                        unit_price_pence:
                                          resolveInvoiceLineUnitPricePence({
                                            lineType,
                                            unitPricePence:
                                              row.unit_price_pence,
                                            defaultHourlyRatePence,
                                          }),
                                      });
                                    }}
                                    disabled={readOnly}
                                    className="w-full rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2 py-1.5 text-xs text-[var(--ozer-text-on-light)]"
                                  >
                                    <option value="quantity">Quantity</option>
                                    <option value="hours">Hours</option>
                                  </select>
                                  <select
                                    value={row.job_id ?? ''}
                                    onChange={(e) =>
                                      updateItem(index, {
                                        job_id: e.target.value || null,
                                      })
                                    }
                                    disabled={readOnly || jobsLoading}
                                    className="w-full rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2 py-1.5 text-xs text-[var(--ozer-text-on-light)]"
                                  >
                                    <option value="">
                                      Link to job (optional)
                                    </option>
                                    {jobsForClient.map((j) => (
                                      <option key={j.id} value={j.id}>
                                        {j.title}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="py-3 pr-2 text-right">
                                <span className="mb-1 block text-[10px] text-[var(--workspace-shell-text-muted)] sm:hidden">
                                  {invoiceLineQuantityColumnLabel(
                                    row.line_type,
                                  )}
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  inputMode="decimal"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateItem(index, {
                                      quantity: parseInvoiceQuantityInput(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  disabled={readOnly}
                                  className={`text-right ${inputClassName}`}
                                />
                              </td>
                              {showUnitPriceColumn ? (
                                <td className="py-3 pr-2 text-right">
                                  {isHoursLine ? (
                                    <span className="text-[var(--workspace-shell-text-muted)]">
                                      —
                                    </span>
                                  ) : (
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={unitPriceInputValue(row, index)}
                                      onChange={(e) => {
                                        const key = unitPriceRowKey(row, index);
                                        setUnitPriceDrafts((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }));
                                      }}
                                      onBlur={() => commitUnitPriceDraft(index)}
                                      disabled={readOnly}
                                      placeholder="0.00"
                                      className={`text-right ${inputClassName}`}
                                    />
                                  )}
                                </td>
                              ) : null}
                              <td className="py-3 pr-2 text-right font-medium text-[var(--ozer-text-on-light)]">
                                {formatInvoiceMoney(
                                  calculateInvoiceLineTotalPence(
                                    row.quantity,
                                    row.unit_price_pence,
                                  ),
                                  currency,
                                )}
                              </td>
                              {!readOnly ? (
                                <td className="py-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                                    onClick={() => removeRow(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })
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
                      onClick={() => addRow('quantity')}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add line
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow('hours')}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add hours
                    </Button>
                    {!defaultHourlyRatePence ? (
                      <p className="w-full text-xs text-[var(--workspace-shell-text-muted)]">
                        Set a default hourly rate in{' '}
                        <Link
                          href={pathsConfig.app.accountPaymentSettings.replace(
                            '[account]',
                            accountSlug,
                          )}
                          className="text-[var(--ozer-accent)] hover:underline"
                        >
                          payment settings
                        </Link>{' '}
                        to auto-fill hours lines.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDiscount((v) => !v)}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      {showDiscount ? 'Hide discount' : 'Add discount'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTax((v) => !v)}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      {showTax ? 'Hide tax' : 'Add tax'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeposit((v) => !v)}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      {showDeposit ? 'Hide deposit' : 'Request deposit'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLateFee((v) => !v)}
                      className="border-[color:var(--ozer-border-on-light)] text-[var(--ozer-text-on-light)] hover:bg-[var(--ozer-cream-50)]"
                    >
                      {showLateFee ? 'Hide late fees' : 'Add late fees'}
                    </Button>
                  </div>
                ) : null}
              </div>

              {(showDiscount || showTax || showDeposit || showLateFee) &&
              !readOnly ? (
                <div className="grid gap-4 rounded-lg border border-zinc-100 bg-[var(--ozer-cream-50)] p-4 sm:grid-cols-2">
                  {showDiscount ? (
                    <div className="space-y-2">
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Discount
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(e.target.value as DiscountType | '')
                          }
                          className="rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">
                            Fixed ({currencySymbol})
                          </option>
                        </select>
                        <Input
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={discountType === 'fixed' ? '0.00' : '10'}
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {showTax ? (
                    <div className="space-y-2">
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Tax rate (%)
                      </Label>
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
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Deposit
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={depositType}
                          onChange={(e) =>
                            setDepositType(e.target.value as DepositType | '')
                          }
                          className="rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">
                            Fixed ({currencySymbol})
                          </option>
                        </select>
                        <Input
                          value={depositValue}
                          onChange={(e) => setDepositValue(e.target.value)}
                          placeholder={depositType === 'fixed' ? '0.00' : '50'}
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  ) : null}

                  {showLateFee ? (
                    <div className="space-y-2">
                      <Label className="text-[var(--workspace-shell-text-muted)]">
                        Late fee
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={lateFeeType}
                          onChange={(e) =>
                            setLateFeeType(e.target.value as LateFeeType | '')
                          }
                          className="rounded-md border border-[color:var(--ozer-border-on-light)] bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Type</option>
                          <option value="percent">Percent</option>
                          <option value="fixed">
                            Fixed ({currencySymbol})
                          </option>
                        </select>
                        <Input
                          value={lateFeeValue}
                          onChange={(e) => setLateFeeValue(e.target.value)}
                          placeholder={lateFeeType === 'fixed' ? '0.00' : '5'}
                          className={inputClassName}
                        />
                      </div>
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        Applied when the invoice is overdue.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-[color:var(--ozer-border-on-light)] pt-4">
                <dl className="ml-auto max-w-sm space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--workspace-shell-text-muted)]">
                      Subtotal
                    </dt>
                    <dd className="font-medium text-[var(--ozer-text-on-light)]">
                      {formatInvoiceMoney(totals.subtotal_pence, currency)}
                    </dd>
                  </div>
                  {totals.discount_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-emerald-700">
                      <dt>Discount</dt>
                      <dd>
                        −{formatInvoiceMoney(totals.discount_pence, currency)}
                      </dd>
                    </div>
                  ) : null}
                  {totals.tax_pence > 0 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--workspace-shell-text-muted)]">
                        Tax
                      </dt>
                      <dd className="font-medium text-[var(--ozer-text-on-light)]">
                        {formatInvoiceMoney(totals.tax_pence, currency)}
                      </dd>
                    </div>
                  ) : null}
                  {totals.late_fee_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-amber-700">
                      <dt>Late fee</dt>
                      <dd>
                        {formatInvoiceMoney(totals.late_fee_pence, currency)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t border-[color:var(--ozer-border-on-light)] pt-2 text-base">
                    <dt className="font-semibold text-[var(--ozer-text-on-light)]">
                      Total
                    </dt>
                    <dd className="font-bold text-[var(--ozer-text-on-light)]">
                      {formatInvoiceMoney(totals.total_pence, currency)}
                    </dd>
                  </div>
                  {totals.deposit_due_pence > 0 ? (
                    <div className="flex justify-between gap-4 text-[var(--workspace-shell-text-muted)]">
                      <dt>Deposit due</dt>
                      <dd>
                        {formatInvoiceMoney(totals.deposit_due_pence, currency)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="grid gap-4 border-t border-[color:var(--ozer-border-on-light)] pt-4">
                {showNotesField ? (
                  <div>
                    <Label className="text-[var(--workspace-shell-text-muted)]">
                      Notes
                    </Label>
                    {previewMode ? (
                      notes.trim() ? (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                          {notes}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                          —
                        </p>
                      )
                    ) : (
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={readOnly}
                        rows={3}
                        placeholder="Notes visible to your client"
                        className={`mt-1 ${inputClassName}`}
                      />
                    )}
                  </div>
                ) : null}
                {showFooterField ? (
                  <div>
                    <Label className="text-[var(--workspace-shell-text-muted)]">
                      Footer message
                    </Label>
                    {previewMode ? (
                      footerMessage.trim() ? (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                          {footerMessage}
                        </p>
                      ) : null
                    ) : (
                      <Textarea
                        value={footerMessage}
                        onChange={(e) => setFooterMessage(e.target.value)}
                        disabled={readOnly}
                        rows={2}
                        placeholder="Thank you for your business"
                        className={`mt-1 ${inputClassName}`}
                      />
                    )}
                  </div>
                ) : null}
                {showPaymentLinkField ? (
                  <div className="rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-4">
                    <p className="text-sm font-semibold text-[var(--ozer-text-on-light)]">
                      Pay online
                    </p>
                    {paymentUrl ? (
                      <div className="mt-2 space-y-2">
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ozer-accent)] px-3 py-2 text-sm font-medium text-[var(--ozer-text-on-dark)]"
                        >
                          Open payment page
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <p className="text-xs break-all text-[var(--workspace-shell-text-muted)]">
                          {paymentUrl}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        Payment link will appear here once generated for preview
                        and PDF export.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Invoice actions
              </h2>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Manage visibility options, sending, and downloads.
              </p>
              <Button
                variant="outline"
                className="mt-4 w-full border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                onClick={() => setDisplaySettingsOpen(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Invoice display settings
              </Button>

              {isDraft && canEditInvoices ? (
                <Button
                  className="mt-5 w-full bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-accent-hover)]"
                  onClick={() => {
                    void (async () => {
                      const saved = await handleSave();
                      if (saved) setShowSendPanel(true);
                    })();
                  }}
                  disabled={saving || !canModifyInvoice}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Invoice sending
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="mt-2 w-full border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                disabled={downloadingPdf}
                onClick={() => void handleDownloadPdf()}
              >
                {downloadingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isDraft ? 'Download draft PDF' : 'Download PDF'}
              </Button>

              {canManageInvoiceStatus &&
              ['sent', 'read'].includes(invoice.status) ? (
                <div className="mt-4 space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-4">
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Quick status
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
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

            <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Private note
              </h2>
              <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                Only visible to your team — not shown to clients.
              </p>
              <Textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                disabled={readOnly}
                rows={5}
                placeholder="Internal notes about this invoice"
                className="mt-3 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
              />
            </section>
          </aside>
        </div>
      )}

      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="max-w-xl border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>Create recurring series</DialogTitle>
            <DialogDescription>
              Turn this invoice into a recurring template with a fixed schedule.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <RadioGroup
                value={recurringFrequency}
                onValueChange={(value) =>
                  setRecurringFrequency(
                    value as
                      | 'weekly'
                      | 'fortnightly'
                      | 'monthly'
                      | 'quarterly'
                      | 'yearly',
                  )
                }
              >
                {(
                  [
                    ['weekly', 'Weekly'],
                    ['fortnightly', 'Fortnightly'],
                    ['monthly', 'Monthly'],
                    ['quarterly', 'Quarterly'],
                    ['yearly', 'Yearly'],
                  ] as const
                ).map(([value, label]) => (
                  <RadioGroupItemLabel
                    key={value}
                    selected={recurringFrequency === value}
                    className="items-center gap-3"
                  >
                    <RadioGroupItem value={value} />
                    <span>{label}</span>
                  </RadioGroupItemLabel>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-start-date">First issue date</Label>
              <Input
                id="recurring-start-date"
                type="date"
                value={recurringStartDate}
                onChange={(event) => setRecurringStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <RadioGroup
                value={recurringDurationMode}
                onValueChange={(value) =>
                  setRecurringDurationMode(value as 'months' | 'until_stopped')
                }
              >
                <RadioGroupItemLabel
                  selected={recurringDurationMode === 'months'}
                  className="items-center gap-3"
                >
                  <RadioGroupItem value="months" />
                  <span>For a set number of months</span>
                </RadioGroupItemLabel>
                <RadioGroupItemLabel
                  selected={recurringDurationMode === 'until_stopped'}
                  className="items-center gap-3"
                >
                  <RadioGroupItem value="until_stopped" />
                  <span>Until stopped manually</span>
                </RadioGroupItemLabel>
              </RadioGroup>
            </div>

            {recurringDurationMode === 'months' ? (
              <div className="space-y-2">
                <Label htmlFor="recurring-months">Number of months</Label>
                <Input
                  id="recurring-months"
                  type="number"
                  min={1}
                  max={120}
                  value={recurringMonths}
                  onChange={(event) => setRecurringMonths(event.target.value)}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecurringDialogOpen(false)}
              disabled={creatingRecurring}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleMakeRecurring()}
              disabled={creatingRecurring || !clientId}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-accent-hover)]"
            >
              {creatingRecurring ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Repeat className="mr-2 h-4 w-4" />
              )}
              Create recurring series
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={displaySettingsOpen} onOpenChange={setDisplaySettingsOpen}>
        <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle>Invoice display settings</DialogTitle>
            <DialogDescription>
              Choose which fields appear on the invoice, preview, and PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(
              [
                ['Reference', showReferenceField, setShowReferenceField],
                ['Issue date', showIssuedField, setShowIssuedField],
                ['Due date', showDueField, setShowDueField],
                ['Notes', showNotesField, setShowNotesField],
                ['Footer', showFooterField, setShowFooterField],
                ['Company logo', showLogoField, setShowLogoField],
                ['Payment link', showPaymentLinkField, setShowPaymentLinkField],
              ] as const
            ).map(([label, checked, setter]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--workspace-shell-border)] px-3 py-2"
              >
                <Label className="text-sm text-[var(--workspace-shell-text)]">
                  {label}
                </Label>
                <Switch
                  checked={checked}
                  onCheckedChange={setter}
                  disabled={previewMode}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisplaySettingsOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
