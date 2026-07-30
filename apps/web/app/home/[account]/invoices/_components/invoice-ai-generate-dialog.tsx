'use client';

import { useState } from 'react';

import { Loader2, Sparkles, Trash2 } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';

import type { AiInvoiceDraftLine } from '~/lib/ai/invoice-generate-types';
import {
  calculateInvoiceLineTotalPence,
  normalizeInvoiceQuantity,
  parseInvoiceQuantityInput,
} from '~/lib/invoices/invoice-quantity';

import { getErrorMessage } from '../_lib/error-message';
import {
  type InvoiceCurrency,
  formatInvoiceMoney,
  invoiceCurrencySymbol,
} from '../_lib/invoice-currency';
import { generateInvoiceLineItemsAction } from '../_lib/server/invoice-ai-actions';

export type InvoiceAiApplyItem = {
  description: string;
  description_detail: string | null;
  line_type: 'quantity' | 'hours';
  quantity: number;
  unit_price_pence: number;
  total_pence: number;
};

type InvoiceAiGenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  invoiceId: string;
  currency: InvoiceCurrency;
  hasExistingItems: boolean;
  onApply: (result: {
    mode: 'replace' | 'append';
    items: InvoiceAiApplyItem[];
    title: string | null;
    notes: string | null;
  }) => void;
};

function toEditableLines(items: AiInvoiceDraftLine[]): InvoiceAiApplyItem[] {
  return items.map((item) => ({
    description: item.description,
    description_detail: item.description_detail,
    line_type: item.line_type,
    quantity: item.quantity,
    unit_price_pence: item.unit_price_pence,
    total_pence: item.total_pence,
  }));
}

export function InvoiceAiGenerateDialog({
  open,
  onOpenChange,
  accountId,
  invoiceId,
  currency,
  hasExistingItems,
  onApply,
}: InvoiceAiGenerateDialogProps) {
  const symbol = invoiceCurrencySymbol(currency);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<'replace' | 'append'>(
    hasExistingItems ? 'append' : 'replace',
  );
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [lines, setLines] = useState<InvoiceAiApplyItem[] | null>(null);

  const reset = () => {
    setPrompt('');
    setGenerating(false);
    setMode(hasExistingItems ? 'append' : 'replace');
    setTitle(null);
    setNotes(null);
    setLines(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const updateLine = (
    index: number,
    updates: Partial<InvoiceAiApplyItem>,
  ) => {
    setLines((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const row = { ...next[index]!, ...updates };
      row.total_pence = calculateInvoiceLineTotalPence(
        row.quantity,
        row.unit_price_pence,
      );
      next[index] = row;
      return next;
    });
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev?.filter((_, i) => i !== index) ?? null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const draft = await generateInvoiceLineItemsAction({
        accountId,
        invoiceId,
        prompt,
        currency,
      });
      setTitle(draft.title);
      setNotes(draft.notes);
      setLines(toEditableLines(draft.items));
      toast.success('Line items drafted — review before applying');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (!lines?.length) {
      toast.error('Generate line items first');
      return;
    }

    onApply({
      mode,
      items: lines.map((line, index) => ({
        ...line,
        description: line.description.trim() || `Line ${index + 1}`,
        quantity: normalizeInvoiceQuantity(line.quantity) || 1,
        total_pence: calculateInvoiceLineTotalPence(
          normalizeInvoiceQuantity(line.quantity) || 1,
          line.unit_price_pence,
        ),
      })),
      title,
      notes,
    });
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
            Generate invoice with AI
          </DialogTitle>
          <DialogDescription>
            Describe the work and costings — Ozer will draft line items you can
            edit before adding them to this invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-ai-prompt">Brief &amp; costings</Label>
            <Textarea
              id="invoice-ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              placeholder={`e.g. Website redesign for Arcanum — discovery £1,200, design 3 days at £650/day, build 5 days at £650/day, CMS training 2 hours. Total package if useful: £6,000 + VAT.`}
              className="resize-y"
              disabled={generating}
            />
          </div>

          {!lines ? (
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || prompt.trim().length < 8}
              className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {generating ? 'Generating…' : 'Generate line items'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Review draft
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={generating}
                  onClick={() => void handleGenerate()}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Regenerate
                </Button>
              </div>

              {title ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Suggested title: <span className="font-medium">{title}</span>
                </p>
              ) : null}

              <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
                {lines.map((line, index) => (
                  <div
                    key={`ai-line-${index}`}
                    className="grid gap-2 border-b border-[color:var(--workspace-shell-border)] pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_auto]"
                  >
                    <div className="space-y-1">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(index, { description: e.target.value })
                        }
                        placeholder="Description"
                      />
                      <Input
                        value={line.description_detail ?? ''}
                        onChange={(e) =>
                          updateLine(index, {
                            description_detail: e.target.value || null,
                          })
                        }
                        placeholder="Detail (optional)"
                        className="text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">
                        {line.line_type === 'hours' ? 'Hours' : 'Qty'}
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={String(line.quantity)}
                        onChange={(e) => {
                          const quantity =
                            parseInvoiceQuantityInput(e.target.value) ??
                            line.quantity;
                          updateLine(index, { quantity });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase">
                        Unit ({symbol})
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={(line.unit_price_pence / 100).toFixed(2)}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value);
                          updateLine(index, {
                            unit_price_pence: Number.isFinite(v)
                              ? Math.max(0, Math.round(v * 100))
                              : line.unit_price_pence,
                          });
                        }}
                      />
                      <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                        {formatInvoiceMoney(line.total_pence, currency)}
                      </p>
                    </div>
                    <div className="flex items-start justify-end pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-[var(--workspace-shell-text-muted)] hover:text-red-500"
                        onClick={() => removeLine(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {hasExistingItems ? (
                <div className="space-y-2">
                  <Label>Apply to invoice</Label>
                  <RadioGroup
                    value={mode}
                    onValueChange={(value) =>
                      setMode(value as 'replace' | 'append')
                    }
                    className="gap-2"
                  >
                    <RadioGroupItemLabel
                      selected={mode === 'append'}
                      className="items-center gap-3"
                    >
                      <RadioGroupItem value="append" />
                      <span className="text-sm">Append to existing lines</span>
                    </RadioGroupItemLabel>
                    <RadioGroupItemLabel
                      selected={mode === 'replace'}
                      className="items-center gap-3"
                    >
                      <RadioGroupItem value="replace" />
                      <span className="text-sm">Replace all existing lines</span>
                    </RadioGroupItemLabel>
                  </RadioGroup>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-[color:var(--workspace-shell-border)] px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!lines?.length || generating}
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
          >
            Apply to invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
