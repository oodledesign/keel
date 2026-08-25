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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';

import { COMMERCIAL_PROPERTY_TYPES } from '~/lib/commercial/commercial-constants';
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
  description: '',
  partFloor: false,
  sector: '',
  tenure: '',
  status: '',
  sizeSqft: '',
  askingRent: '',
  rentPerSqft: '',
  serviceChargePerSqft: '',
  ratesPayablePerSqft: '',
  estateChargePerSqft: '',
  epcBand: '',
  possession: '',
  buildStatus: '',
  planningStatus: '',
  fittedSpace: '' as '' | 'yes' | 'no',
  notes: '',
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
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
          description: unit.description ?? '',
          partFloor: unit.partFloor,
          sector: unit.sector ?? '',
          tenure: unit.tenure ?? '',
          status: unit.status ?? '',
          sizeSqft: unit.sizeSqft != null ? String(unit.sizeSqft) : '',
          askingRent:
            unit.askingRentPence != null
              ? String(unit.askingRentPence / 100)
              : '',
          rentPerSqft: unit.rentPerSqft != null ? String(unit.rentPerSqft) : '',
          serviceChargePerSqft:
            unit.serviceChargePerSqft != null
              ? String(unit.serviceChargePerSqft)
              : '',
          ratesPayablePerSqft:
            unit.ratesPayablePerSqft != null
              ? String(unit.ratesPayablePerSqft)
              : '',
          estateChargePerSqft:
            unit.estateChargePerSqft != null
              ? String(unit.estateChargePerSqft)
              : '',
          epcBand: unit.epcBand ?? '',
          possession: unit.possession ?? '',
          buildStatus: unit.buildStatus ?? '',
          planningStatus: unit.planningStatus ?? '',
          fittedSpace:
            unit.fittedSpace == null ? '' : unit.fittedSpace ? 'yes' : 'no',
          notes: unit.notes ?? '',
        }
      : emptyForm,
  );

  const field = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          label: form.label.trim(),
          floorOrUnit: form.floorOrUnit.trim() || null,
          description: form.description.trim() || null,
          partFloor: form.partFloor,
          sector: form.sector.trim() || null,
          tenure: form.tenure.trim() || null,
          status: form.status.trim() || null,
          sizeSqft: form.sizeSqft ? parseFloat(form.sizeSqft) : null,
          askingRentPence: form.askingRent
            ? Math.round(parseFloat(form.askingRent) * 100)
            : null,
          rentPerSqft: form.rentPerSqft ? parseFloat(form.rentPerSqft) : null,
          serviceChargePerSqft: form.serviceChargePerSqft
            ? parseFloat(form.serviceChargePerSqft)
            : null,
          ratesPayablePerSqft: form.ratesPayablePerSqft
            ? parseFloat(form.ratesPayablePerSqft)
            : null,
          estateChargePerSqft: form.estateChargePerSqft
            ? parseFloat(form.estateChargePerSqft)
            : null,
          epcBand: form.epcBand.trim() || null,
          possession: form.possession.trim() || null,
          buildStatus: form.buildStatus.trim() || null,
          planningStatus: form.planningStatus.trim() || null,
          fittedSpace:
            form.fittedSpace === '' ? null : form.fittedSpace === 'yes',
          notes: form.notes.trim() || null,
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Floor / unit
          </Label>
          <Input
            value={form.floorOrUnit}
            onChange={(e) => field('floorOrUnit', e.target.value)}
            placeholder="e.g. Ground, 1st"
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
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
        <input
          type="checkbox"
          checked={form.partFloor}
          onChange={(e) => field('partFloor', e.target.checked)}
          className="rounded border-[color:var(--workspace-shell-border)]"
        />
        Part floor
      </label>

      <div className="space-y-1.5">
        <Label className="text-[var(--workspace-shell-text)]/70">
          Description
        </Label>
        <Textarea
          value={form.description}
          onChange={(e) => field('description', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Property type
          </Label>
          <Select
            value={form.sector || 'unset'}
            onValueChange={(v) => field('sector', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Not set</SelectItem>
              {COMMERCIAL_PROPERTY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
              {form.sector &&
              !(COMMERCIAL_PROPERTY_TYPES as readonly string[]).includes(
                form.sector,
              ) ? (
                <SelectItem value={form.sector}>{form.sector}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Status
          </Label>
          <Input
            value={form.status}
            onChange={(e) => field('status', e.target.value)}
            placeholder="Available…"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Asking rent (£)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.askingRent}
            onChange={(e) => field('askingRent', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Rent (£/sq ft)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.rentPerSqft}
            onChange={(e) => field('rentPerSqft', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            SC (£/sq ft)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.serviceChargePerSqft}
            onChange={(e) => field('serviceChargePerSqft', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Rates (£/sq ft)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.ratesPayablePerSqft}
            onChange={(e) => field('ratesPayablePerSqft', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Estate (£/sq ft)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.estateChargePerSqft}
            onChange={(e) => field('estateChargePerSqft', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            EPC band
          </Label>
          <Input
            value={form.epcBand}
            onChange={(e) => field('epcBand', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Possession
          </Label>
          <Input
            value={form.possession}
            onChange={(e) => field('possession', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Build status
          </Label>
          <Input
            value={form.buildStatus}
            onChange={(e) => field('buildStatus', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Planning status
          </Label>
          <Input
            value={form.planningStatus}
            onChange={(e) => field('planningStatus', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Tenure
          </Label>
          <Input
            value={form.tenure}
            onChange={(e) => field('tenure', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Fitted space
          </Label>
          <Select
            value={form.fittedSpace || 'unset'}
            onValueChange={(v) => field('fittedSpace', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[var(--workspace-shell-text)]/70">Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => field('notes', e.target.value)}
          rows={2}
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
