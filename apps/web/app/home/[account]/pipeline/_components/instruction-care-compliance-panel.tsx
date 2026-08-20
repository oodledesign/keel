'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  type InstructionCareLogEntry,
  type InstructionComplianceItem,
  addInstructionCareLogEntry,
  ensureInstructionComplianceItems,
  listInstructionCareLog,
  setInstructionComplianceChecked,
} from '../_lib/server/instruction-care-compliance.actions';

type Props = {
  instructionId: string;
  accountSlug?: string;
  onCareLogAdded?: (createdAt: string) => void;
};

function formatCareDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function InstructionCareCompliancePanel({
  instructionId,
  accountSlug,
  onCareLogAdded,
}: Props) {
  const [entries, setEntries] = useState<InstructionCareLogEntry[]>([]);
  const [items, setItems] = useState<InstructionComplianceItem[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [care, compliance] = await Promise.all([
        listInstructionCareLog({ instructionId, accountSlug }),
        ensureInstructionComplianceItems({ instructionId, accountSlug }),
      ]);
      setEntries(care.entries);
      setItems(compliance.items);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not load client care / compliance',
      );
    } finally {
      setLoading(false);
    }
  }, [instructionId, accountSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddNote = () => {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error('Enter a client care note');
      return;
    }
    startTransition(async () => {
      try {
        const result = await addInstructionCareLogEntry({
          instructionId,
          accountSlug,
          note: trimmed,
        });
        setEntries((prev) => [result.entry, ...prev]);
        setNote('');
        onCareLogAdded?.(result.entry.createdAt);
        toast.success('Client care note added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add note',
        );
      }
    });
  };

  const handleToggle = (item: InstructionComplianceItem, checked: boolean) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              isChecked: checked,
              checkedAt: checked ? new Date().toISOString() : null,
            }
          : row,
      ),
    );
    startTransition(async () => {
      try {
        const result = await setInstructionComplianceChecked({
          instructionId,
          accountSlug,
          itemId: item.id,
          isChecked: checked,
        });
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? result.item : row)),
        );
      } catch (error) {
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  isChecked: item.isChecked,
                  checkedAt: item.checkedAt,
                }
              : row,
          ),
        );
        toast.error(
          error instanceof Error ? error.message : 'Could not update checklist',
        );
      }
    });
  };

  if (loading) {
    return (
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Loading client care…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Client care log
        </p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Record last contact and updates. Newest entries appear first.
        </p>
        <div className="space-y-2">
          <Label
            htmlFor={`care-note-${instructionId}`}
            className="text-[var(--workspace-shell-text-muted)]"
          >
            New note
          </Label>
          <Textarea
            id={`care-note-${instructionId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Called landlord — awaiting EPC"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || !note.trim()}
            onClick={handleAddNote}
          >
            Add note
          </Button>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            No client care notes yet.
          </p>
        ) : (
          <ul className="max-h-40 space-y-2 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border border-[color:var(--workspace-shell-border)]/60 bg-[var(--workspace-control-surface)] px-2.5 py-2"
              >
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {formatCareDate(entry.createdAt)}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                  {entry.note}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Compliance checklist
        </p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Placeholder items for demo — replace with Bracketts list once
          confirmed.
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`compliance-${item.id}`}
                checked={item.isChecked}
                disabled={isPending}
                onCheckedChange={(value) => handleToggle(item, value === true)}
                className="mt-0.5"
              />
              <Label
                htmlFor={`compliance-${item.id}`}
                className="text-sm leading-snug font-normal text-[var(--workspace-shell-text)]"
              >
                {item.label}
              </Label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
