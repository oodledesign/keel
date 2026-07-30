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

import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  ClientContactPicker,
  type ClientContactPickerValue,
  emptyClientContactPickerValue,
} from '../../clients/_components/client-contact-picker';
import type { CommercialRequirement } from '../_lib/server/requirements.service';
import {
  createRequirement,
  updateRequirement,
} from '../_lib/server/server-actions';

interface RequirementFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  requirement?: CommercialRequirement | null;
  onSaved: () => void;
}

type BriefForm = {
  locationText: string;
  sector: string;
  tenure: '' | 'rent' | 'buy' | 'both';
  sizeMinSqft: string;
  sizeMaxSqft: string;
  budgetMin: string;
  budgetMax: string;
  stage: RequirementStatus;
  notes: string;
};

function partyFromRequirement(
  requirement?: CommercialRequirement | null,
): ClientContactPickerValue {
  if (!requirement) return emptyClientContactPickerValue();
  return {
    clientId: requirement.clientId ?? '',
    contactId: requirement.contactId ?? '',
    companyName: requirement.companyName ?? '',
    contactName: requirement.contactName ?? '',
    contactEmail: requirement.contactEmail ?? '',
    contactPhone: requirement.contactPhone ?? '',
  };
}

function briefFromRequirement(
  requirement?: CommercialRequirement | null,
): BriefForm {
  if (!requirement) {
    return {
      locationText: '',
      sector: '',
      tenure: '',
      sizeMinSqft: '',
      sizeMaxSqft: '',
      budgetMin: '',
      budgetMax: '',
      stage: 'unactioned',
      notes: '',
    };
  }

  return {
    locationText: requirement.locationText ?? '',
    sector: requirement.sector ?? '',
    tenure: requirement.tenure ?? '',
    sizeMinSqft:
      requirement.sizeMinSqft != null ? String(requirement.sizeMinSqft) : '',
    sizeMaxSqft:
      requirement.sizeMaxSqft != null ? String(requirement.sizeMaxSqft) : '',
    budgetMin:
      requirement.budgetMinPence != null
        ? String(requirement.budgetMinPence / 100)
        : '',
    budgetMax:
      requirement.budgetMaxPence != null
        ? String(requirement.budgetMaxPence / 100)
        : '',
    stage: requirement.stage,
    notes: requirement.notes ?? '',
  };
}

function RequirementFormFields({
  accountId,
  requirement,
  onClose,
  onSaved,
}: {
  accountId: string;
  requirement?: CommercialRequirement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(requirement);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [party, setParty] = useState(() => partyFromRequirement(requirement));
  const [form, setForm] = useState(() => briefFromRequirement(requirement));

  const field = (key: keyof BriefForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!party.clientId) {
      setError('Link a client, or create one below.');
      return;
    }

    startTransition(async () => {
      try {
        const shared = {
          clientId: party.clientId || null,
          contactId: party.contactId || null,
          companyName: party.companyName.trim() || null,
          contactName: party.contactName.trim() || null,
          contactEmail: party.contactEmail.trim() || null,
          contactPhone: party.contactPhone.trim() || null,
          locationText: form.locationText.trim() || null,
          sector: form.sector.trim() || null,
          tenure: form.tenure || null,
          sizeMinSqft: form.sizeMinSqft ? parseFloat(form.sizeMinSqft) : null,
          sizeMaxSqft: form.sizeMaxSqft ? parseFloat(form.sizeMaxSqft) : null,
          budgetMinPence: form.budgetMin
            ? Math.round(parseFloat(form.budgetMin) * 100)
            : null,
          budgetMaxPence: form.budgetMax
            ? Math.round(parseFloat(form.budgetMax) * 100)
            : null,
          stage: form.stage,
          notes: form.notes.trim() || null,
        };

        if (isEdit && requirement) {
          await updateRequirement({
            requirementId: requirement.id,
            accountId,
            ...shared,
          });
        } else {
          await createRequirement({ accountId, ...shared });
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <ClientContactPicker
        accountId={accountId}
        active
        value={party}
        onChange={setParty}
        onError={setError}
        showSummary
        allowNone={false}
      />

      <div className="space-y-1.5">
        <Label>Location</Label>
        <Input
          value={form.locationText}
          onChange={(e) => field('locationText', e.target.value)}
          placeholder="Areas / towns"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tenure</Label>
          <Select
            value={form.tenure || 'unset'}
            onValueChange={(v) => field('tenure', v === 'unset' ? '' : v)}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">—</SelectItem>
              <SelectItem value="rent">Rent</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Stage</Label>
          <Select value={form.stage} onValueChange={(v) => field('stage', v)}>
            <SelectTrigger className={inputClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUIREMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUIREMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Min sq ft</Label>
          <Input
            type="number"
            min={0}
            value={form.sizeMinSqft}
            onChange={(e) => field('sizeMinSqft', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max sq ft</Label>
          <Input
            type="number"
            min={0}
            value={form.sizeMaxSqft}
            onChange={(e) => field('sizeMaxSqft', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Budget min (£)</Label>
          <Input
            type="number"
            min={0}
            value={form.budgetMin}
            onChange={(e) => field('budgetMin', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Budget max (£)</Label>
          <Input
            type="number"
            min={0}
            value={form.budgetMax}
            onChange={(e) => field('budgetMax', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Sector</Label>
        <Input
          value={form.sector}
          onChange={(e) => field('sector', e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => field('notes', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className={workspaceBtnPrimaryMd}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add requirement'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RequirementFormModal({
  open,
  onClose,
  accountId,
  requirement,
  onSaved,
}: RequirementFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle>
            {requirement ? 'Edit requirement' : 'Add requirement'}
          </DialogTitle>
        </DialogHeader>
        {open ? (
          <RequirementFormFields
            key={requirement?.id ?? 'new'}
            accountId={accountId}
            requirement={requirement}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
