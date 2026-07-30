'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { CommercialListingUnit } from '../_lib/server/listings.service';
import {
  createListingUnit,
  updateListingUnit,
} from '../_lib/server/server-actions';

interface ListingUnitFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  listingId: string;
  unit?: CommercialListingUnit | null;
  onSaved: (unit: CommercialListingUnit) => void;
}

const emptyForm = {
  label: '',
  floorOrUnit: '',
  sizeSqft: '',
};

export function ListingUnitFormModal({
  open,
  onClose,
  accountId,
  listingId,
  unit,
  onSaved,
}: ListingUnitFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {unit ? 'Edit unit' : 'Add unit'}
          </DialogTitle>
        </DialogHeader>
        <ListingUnitFormFields
          key={`${unit?.id ?? 'new'}-${open ? 'open' : 'closed'}`}
          accountId={accountId}
          listingId={listingId}
          unit={unit}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ListingUnitFormFields({
  accountId,
  listingId,
  unit,
  onClose,
  onSaved,
}: {
  accountId: string;
  listingId: string;
  unit?: CommercialListingUnit | null;
  onClose: () => void;
  onSaved: (unit: CommercialListingUnit) => void;
}) {
  const isEdit = Boolean(unit);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    unit
      ? {
          label: unit.label,
          floorOrUnit: unit.floorOrUnit ?? '',
          sizeSqft: unit.sizeSqft != null ? String(unit.sizeSqft) : '',
        }
      : emptyForm,
  );

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          label: form.label.trim(),
          floorOrUnit: form.floorOrUnit.trim() || null,
          sizeSqft: form.sizeSqft ? parseFloat(form.sizeSqft) : null,
        };

        const saved =
          isEdit && unit
            ? await updateListingUnit({
                unitId: unit.id,
                accountId,
                ...payload,
              })
            : await createListingUnit({
                accountId,
                listingId,
                ...payload,
              });

        onSaved(saved);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save unit');
      }
    });
  };

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label className="text-[var(--workspace-shell-text)]/70">Label *</Label>
        <Input
          value={form.label}
          onChange={(e) => field('label', e.target.value)}
          placeholder="e.g. Ground floor retail"
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[var(--workspace-shell-text)]/70">
          Floor / unit
        </Label>
        <Input
          value={form.floorOrUnit}
          onChange={(e) => field('floorOrUnit', e.target.value)}
          placeholder="e.g. Ground, 1st, Unit 3"
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[var(--workspace-shell-text)]/70">
          Size (sq ft)
        </Label>
        <Input
          type="number"
          min={0}
          value={form.sizeSqft}
          onChange={(e) => field('sizeSqft', e.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending || !form.label.trim()}
          className={workspaceBtnPrimaryMd}
        >
          {pending ? 'Saving…' : isEdit ? 'Save' : 'Add unit'}
        </Button>
      </DialogFooter>
    </form>
  );
}
