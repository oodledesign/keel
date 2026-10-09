'use client';

import { type FormEvent, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '../_lib/error-message';
import { invoiceCurrencySymbol } from '../_lib/invoice-currency';
import { formatPence } from '../_lib/invoice-totals';
import { recordInvoicePaymentAction } from '../_lib/server/server-actions';

type ManualPaymentMethod = 'bank_transfer' | 'cash';

function todayLocalIsoDate() {
  return new Date().toLocaleDateString('en-CA');
}

/** Accepts "1234.5", "1,234.50" and decimal-comma "1234,50". */
function moneyInputToPence(value: string): number | null {
  let cleaned = value.replace(/\s/g, '');
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d{0,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

type RecordPaymentFormProps = {
  onOpenChange: (open: boolean) => void;
  accountId: string;
  invoiceId: string;
  invoiceNumber: string;
  totalPence: number;
  amountPaidPence: number;
  currency: string;
  onRecorded: () => void;
};

export function RecordInvoicePaymentDialog({
  open,
  ...formProps
}: RecordPaymentFormProps & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={formProps.onOpenChange}>
      <DialogContent className="max-w-md border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <RecordPaymentForm {...formProps} />
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentForm({
  onOpenChange,
  accountId,
  invoiceId,
  invoiceNumber,
  totalPence,
  amountPaidPence,
  currency,
  onRecorded,
}: RecordPaymentFormProps) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ManualPaymentMethod>('bank_transfer');
  const [paidOn, setPaidOn] = useState(todayLocalIsoDate);
  const [note, setNote] = useState('');

  const remainingPence = Math.max(0, totalPence - amountPaidPence);
  const amountPence = moneyInputToPence(amount);
  const clearsBalance = amountPence !== null && amountPence === remainingPence;
  const tooMuch = amountPence !== null && amountPence > remainingPence;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (amountPence === null || amountPence <= 0) {
      toast.error('Enter the amount received');
      return;
    }
    if (tooMuch) {
      toast.error(
        `That is more than the ${formatPence(remainingPence, currency)} still owed`,
      );
      return;
    }

    startTransition(async () => {
      try {
        const result = await recordInvoicePaymentAction({
          accountId,
          invoiceId,
          amount_pence: amountPence,
          payment_method: method,
          paid_on: paidOn || undefined,
          note: note.trim() || undefined,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(
          result.fullyPaid
            ? 'Payment recorded. Invoice is now paid in full'
            : `Payment recorded. ${formatPence(result.remaining, currency)} still owed`,
        );
        onOpenChange(false);
        onRecorded();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-[var(--workspace-shell-text)]">
          Record a payment
        </DialogTitle>
        <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
          Invoice {invoiceNumber}. Log money you received outside the payment
          page, such as a bank transfer.
        </DialogDescription>
      </DialogHeader>

      <dl className="grid grid-cols-3 gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
            Total
          </dt>
          <dd className="font-mono text-[var(--workspace-shell-text)]">
            {formatPence(totalPence, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
            Paid so far
          </dt>
          <dd className="font-mono text-[var(--workspace-shell-text)]">
            {formatPence(amountPaidPence, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--workspace-shell-text-muted)]">
            Still owed
          </dt>
          <dd className="font-mono font-medium text-[var(--workspace-shell-text)]">
            {formatPence(remainingPence, currency)}
          </dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="record-payment-amount">Amount received</Label>
            <button
              type="button"
              className="text-xs text-[var(--ozer-accent)] hover:underline"
              onClick={() => setAmount((remainingPence / 100).toFixed(2))}
            >
              Use full balance
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-[var(--workspace-shell-text-muted)]">
              {invoiceCurrencySymbol(currency)}
            </span>
            <Input
              id="record-payment-amount"
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
              aria-invalid={tooMuch || undefined}
            />
          </div>
          {tooMuch ? (
            <p className="text-destructive text-xs">
              More than the {formatPence(remainingPence, currency)} still owed
            </p>
          ) : amountPence !== null && amountPence > 0 ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Recording {formatPence(amountPence, currency)}
              {clearsBalance
                ? '. This clears the balance and marks the invoice as paid'
                : `. ${formatPence(remainingPence - amountPence, currency)} will still be owed`}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="record-payment-method">Method</Label>
            <Select
              value={method}
              onValueChange={(value) => setMethod(value as ManualPaymentMethod)}
            >
              <SelectTrigger id="record-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="record-payment-date">Received on</Label>
            <Input
              id="record-payment-date"
              type="date"
              max={todayLocalIsoDate()}
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="record-payment-note">Note (optional)</Label>
          <Textarea
            id="record-payment-note"
            rows={2}
            maxLength={500}
            placeholder="e.g. First instalment"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || tooMuch}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-accent-hover)]"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Record payment
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
