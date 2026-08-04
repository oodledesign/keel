'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Plus, Trash2 } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  type InvoiceLineType,
  calculateInvoiceLineTotalPence,
  normalizeInvoiceLineType,
  normalizeInvoiceQuantity,
} from '~/lib/invoices/invoice-quantity';

import { getErrorMessage } from '../_lib/error-message';
import {
  invoiceCurrencySymbol,
  normalizeInvoiceCurrency,
} from '../_lib/invoice-currency';
import { upsertRecurringSeriesAction } from '../_lib/server/server-actions';

type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

type TemplateLineItem = {
  key: string;
  job_id: string | null;
  description: string;
  description_detail: string;
  line_type: InvoiceLineType;
  quantity: string;
  unit_price: string;
};

export type RecurringSeriesEditModel = {
  id: string;
  client_id: string;
  title: string;
  currency?: string | null;
  frequency: Frequency | string;
  next_issue_at: string;
  end_at?: string | null;
  auto_send?: boolean | null;
  due_days?: number | null;
  max_occurrences?: number | null;
  template?: Record<string, unknown> | null;
};

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function penceToPoundsInput(pence: number): string {
  if (!Number.isFinite(pence) || pence === 0) return '';
  return (pence / 100).toFixed(2);
}

function poundsInputToPence(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function newLineKey() {
  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

function mapTemplateItems(
  template: Record<string, unknown> | null | undefined,
) {
  const raw = Array.isArray(template?.items) ? template.items : [];
  if (raw.length === 0) {
    return [
      {
        key: newLineKey(),
        job_id: null,
        description: '',
        description_detail: '',
        line_type: 'quantity' as InvoiceLineType,
        quantity: '1',
        unit_price: '',
      },
    ];
  }

  return raw.map((item, index) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const quantity =
      typeof row.quantity === 'number'
        ? row.quantity
        : Number.parseFloat(String(row.quantity ?? '1'));
    const unitPricePence =
      typeof row.unit_price_pence === 'number'
        ? row.unit_price_pence
        : Number.parseInt(String(row.unit_price_pence ?? '0'), 10);

    return {
      key:
        typeof row.id === 'string'
          ? row.id
          : `template-${index}-${newLineKey()}`,
      job_id: typeof row.job_id === 'string' ? row.job_id : null,
      description: typeof row.description === 'string' ? row.description : '',
      description_detail:
        typeof row.description_detail === 'string'
          ? row.description_detail
          : '',
      line_type: normalizeInvoiceLineType(
        typeof row.line_type === 'string' ? row.line_type : 'quantity',
      ),
      quantity: Number.isFinite(quantity) ? String(quantity) : '1',
      unit_price: penceToPoundsInput(
        Number.isFinite(unitPricePence) ? unitPricePence : 0,
      ),
    };
  });
}

export function RecurringSeriesEditDialog({
  open,
  onOpenChange,
  accountId,
  series,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  series: RecurringSeriesEditModel | null;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [nextIssueDate, setNextIssueDate] = useState('');
  const [dueDays, setDueDays] = useState('7');
  const [autoSend, setAutoSend] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<TemplateLineItem[]>([]);

  const currency = normalizeInvoiceCurrency(series?.currency);
  const currencySymbol = invoiceCurrencySymbol(currency);

  useEffect(() => {
    if (!series || !open) return;
    setTitle(series.title ?? '');
    setFrequency((series.frequency as Frequency) || 'monthly');
    setNextIssueDate(toDateInput(series.next_issue_at));
    setDueDays(String(series.due_days ?? 7));
    setAutoSend(Boolean(series.auto_send));
    const template = (series.template ?? {}) as Record<string, unknown>;
    const existingRecipient =
      (typeof template.sent_to_email === 'string' && template.sent_to_email) ||
      (Array.isArray(template.sent_to_emails) &&
      typeof template.sent_to_emails[0] === 'string'
        ? template.sent_to_emails[0]
        : '');
    setRecipientEmail(existingRecipient);
    const end = toDateInput(series.end_at);
    setHasEndDate(Boolean(end));
    setEndDate(end);
    setNotes(typeof template.notes === 'string' ? template.notes : '');
    setItems(mapTemplateItems(template));
  }, [series, open]);

  const lineTotalPreview = useMemo(() => {
    return items.reduce((sum, row) => {
      const quantity = normalizeInvoiceQuantity(
        Number.parseFloat(row.quantity) || 0,
      );
      const unitPricePence = poundsInputToPence(row.unit_price);
      return sum + calculateInvoiceLineTotalPence(quantity, unitPricePence);
    }, 0);
  }, [items]);

  const updateItem = (key: string, patch: Partial<TemplateLineItem>) => {
    setItems((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = () => {
    if (!series) return;
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!nextIssueDate) {
      toast.error('Choose a next issue date');
      return;
    }

    const nextIssue = new Date(`${nextIssueDate}T12:00:00`);
    if (Number.isNaN(nextIssue.getTime())) {
      toast.error('Choose a valid next issue date');
      return;
    }

    const parsedDueDays = Math.min(
      365,
      Math.max(0, parseInt(dueDays, 10) || 0),
    );

    let endAt: string | null = null;
    if (hasEndDate) {
      if (!endDate) {
        toast.error('Choose an end date or turn off end date');
        return;
      }
      const end = new Date(`${endDate}T12:00:00`);
      if (Number.isNaN(end.getTime())) {
        toast.error('Choose a valid end date');
        return;
      }
      endAt = end.toISOString();
    }

    const cleanedItems = items
      .map((row, index) => {
        const description = row.description.trim();
        const quantity = normalizeInvoiceQuantity(
          Number.parseFloat(row.quantity) || 0,
        );
        const unit_price_pence = poundsInputToPence(row.unit_price);
        return {
          job_id: row.job_id,
          sort_order: index,
          description,
          description_detail: row.description_detail.trim() || null,
          line_type: row.line_type,
          quantity,
          unit_price_pence,
          total_pence: calculateInvoiceLineTotalPence(
            quantity,
            unit_price_pence,
          ),
        };
      })
      .filter((row) => row.description.length > 0);

    if (cleanedItems.length === 0) {
      toast.error('Add at least one line item with a description');
      return;
    }

    const cleanedRecipient = recipientEmail.trim().toLowerCase();
    if (autoSend && !cleanedRecipient) {
      toast.error('Add a recipient email when email-when-generated is on');
      return;
    }

    const existingTemplate =
      (series.template as Record<string, unknown> | null | undefined) ?? {};

    startTransition(async () => {
      try {
        await upsertRecurringSeriesAction({
          accountId,
          seriesId: series.id,
          client_id: series.client_id,
          title: title.trim(),
          currency,
          frequency,
          next_issue_at: nextIssue.toISOString(),
          end_at: endAt,
          max_occurrences: series.max_occurrences ?? null,
          auto_send: autoSend,
          due_days: parsedDueDays,
          template: {
            ...existingTemplate,
            title: title.trim(),
            notes: notes.trim() || null,
            items: cleanedItems,
            sent_to_email: cleanedRecipient || null,
            sent_to_emails: cleanedRecipient ? [cleanedRecipient] : [],
          },
        });
        toast.success('Recurring series updated');
        onOpenChange(false);
        onSaved();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <DialogHeader>
          <DialogTitle>Edit recurring series</DialogTitle>
          <DialogDescription>
            Changes apply to future invoices from this series. Already issued
            invoices are not updated.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="recurring-edit-title">Title</Label>
            <Input
              id="recurring-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as Frequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurring-edit-next">Next issue date</Label>
              <Input
                id="recurring-edit-next"
                type="date"
                value={nextIssueDate}
                onChange={(e) => setNextIssueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-edit-due-days">Due date</Label>
            <div className="flex items-center gap-2">
              <Input
                id="recurring-edit-due-days"
                type="number"
                min={0}
                max={365}
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="max-w-[7rem] font-mono"
              />
              <span className="text-muted-foreground text-sm">
                days after each issue
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Line items</Label>
                <p className="text-muted-foreground text-xs">
                  Used on each future invoice from this series
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      key: newLineKey(),
                      job_id: null,
                      description: '',
                      description_detail: '',
                      line_type: 'quantity',
                      quantity: '1',
                      unit_price: '',
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((row) => (
                <div
                  key={row.key}
                  className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={row.description}
                      onChange={(e) =>
                        updateItem(row.key, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground shrink-0"
                      disabled={items.length <= 1}
                      onClick={() =>
                        setItems((prev) =>
                          prev.filter((item) => item.key !== row.key),
                        )
                      }
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">
                        Type
                      </Label>
                      <Select
                        value={row.line_type}
                        onValueChange={(value) =>
                          updateItem(row.key, {
                            line_type: value as InvoiceLineType,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quantity">Quantity</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground text-xs">
                        {row.line_type === 'hours' ? 'Hours' : 'Qty'}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) =>
                          updateItem(row.key, { quantity: e.target.value })
                        }
                        className="font-mono"
                      />
                    </div>
                    <div className="col-span-2 space-y-1 sm:col-span-1">
                      <Label className="text-muted-foreground text-xs">
                        Rate ({currencySymbol})
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.unit_price}
                        onChange={(e) =>
                          updateItem(row.key, { unit_price: e.target.value })
                        }
                        placeholder="0.00"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground text-right text-xs">
              Line total preview:{' '}
              <span className="font-mono text-[var(--workspace-shell-text)]">
                {currencySymbol}
                {(lineTotalPreview / 100).toFixed(2)}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-edit-notes">Notes on invoice</Label>
            <Textarea
              id="recurring-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes shown on each issued invoice"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm font-medium">End date</p>
              <p className="text-muted-foreground text-xs">
                Stop issuing after this date
              </p>
            </div>
            <Switch checked={hasEndDate} onCheckedChange={setHasEndDate} />
          </div>

          {hasEndDate ? (
            <div className="space-y-2">
              <Label htmlFor="recurring-edit-end">Ends on</Label>
              <Input
                id="recurring-edit-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
            <div>
              <p className="text-sm font-medium">Automatic email</p>
              <p className="text-muted-foreground text-xs">
                On: email each invoice when it is created. Off: create as a draft
                for manual send. Requires a recipient on the template.
              </p>
            </div>
            <Switch checked={autoSend} onCheckedChange={setAutoSend} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-edit-recipient">Recipient email</Label>
            <Input
              id="recurring-edit-recipient"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="billing@client.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
