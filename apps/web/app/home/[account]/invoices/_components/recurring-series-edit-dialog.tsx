'use client';

import { useEffect, useState, useTransition } from 'react';

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

import { getErrorMessage } from '../_lib/error-message';
import { normalizeInvoiceCurrency } from '../_lib/invoice-currency';
import { upsertRecurringSeriesAction } from '../_lib/server/server-actions';

type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

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
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!series || !open) return;
    setTitle(series.title ?? '');
    setFrequency((series.frequency as Frequency) || 'monthly');
    setNextIssueDate(toDateInput(series.next_issue_at));
    setDueDays(String(series.due_days ?? 7));
    setAutoSend(Boolean(series.auto_send));
    const end = toDateInput(series.end_at);
    setHasEndDate(Boolean(end));
    setEndDate(end);
  }, [series, open]);

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

    startTransition(async () => {
      try {
        await upsertRecurringSeriesAction({
          accountId,
          seriesId: series.id,
          client_id: series.client_id,
          title: title.trim(),
          currency: normalizeInvoiceCurrency(series.currency),
          frequency,
          next_issue_at: nextIssue.toISOString(),
          end_at: endAt,
          max_occurrences: series.max_occurrences ?? null,
          auto_send: autoSend,
          due_days: parsedDueDays,
          template:
            (series.template as Record<string, unknown> | null | undefined) ??
            {},
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
      <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <DialogHeader>
          <DialogTitle>Edit recurring series</DialogTitle>
          <DialogDescription>
            Update the schedule and due date for future invoices from this
            series. Line items stay as saved on the template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recurring-edit-title">Title</Label>
            <Input
              id="recurring-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

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
              <p className="text-sm font-medium">Auto-send</p>
              <p className="text-muted-foreground text-xs">
                Email each invoice when it is issued (requires a saved recipient
                on the template)
              </p>
            </div>
            <Switch checked={autoSend} onCheckedChange={setAutoSend} />
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
