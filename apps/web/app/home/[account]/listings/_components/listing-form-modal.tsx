'use client';

import { useEffect, useState, useTransition } from 'react';

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
  DISPOSAL_TYPE_LABELS,
  DISPOSAL_TYPES,
  LISTING_STATUS_LABELS,
  LISTING_STATUSES,
  type DisposalType,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { createListing, updateListing } from '../_lib/server/server-actions';

interface ListingFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  listing?: CommercialListing | null;
  onSaved: () => void;
}

const emptyForm = {
  name: '',
  addressLine1: '',
  town: '',
  postcode: '',
  sector: '',
  disposalType: 'to_let' as DisposalType,
  status: 'draft' as ListingStatus,
  askingRent: '',
  askingPrice: '',
  sizeMinSqft: '',
  sizeMaxSqft: '',
  useClass: '',
  summary: '',
  notes: '',
};

export function ListingFormModal({
  open,
  onClose,
  accountId,
  listing,
  onSaved,
}: ListingFormModalProps) {
  const isEdit = Boolean(listing);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (listing) {
      setForm({
        name: listing.name,
        addressLine1: listing.addressLine1 ?? '',
        town: listing.town ?? '',
        postcode: listing.postcode ?? '',
        sector: listing.sector ?? '',
        disposalType: listing.disposalType,
        status: listing.status,
        askingRent:
          listing.askingRentPence != null
            ? String(listing.askingRentPence / 100)
            : '',
        askingPrice:
          listing.askingPricePence != null
            ? String(listing.askingPricePence / 100)
            : '',
        sizeMinSqft:
          listing.sizeMinSqft != null ? String(listing.sizeMinSqft) : '',
        sizeMaxSqft:
          listing.sizeMaxSqft != null ? String(listing.sizeMaxSqft) : '',
        useClass: listing.useClass ?? '',
        summary: listing.summary ?? '',
        notes: listing.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [listing, open]);

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const shared = {
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim() || null,
          town: form.town.trim() || null,
          postcode: form.postcode.trim() || null,
          sector: form.sector.trim() || null,
          disposalType: form.disposalType,
          status: form.status,
          askingRentPence: form.askingRent
            ? Math.round(parseFloat(form.askingRent) * 100)
            : null,
          askingPricePence: form.askingPrice
            ? Math.round(parseFloat(form.askingPrice) * 100)
            : null,
          sizeMinSqft: form.sizeMinSqft ? parseFloat(form.sizeMinSqft) : null,
          sizeMaxSqft: form.sizeMaxSqft ? parseFloat(form.sizeMaxSqft) : null,
          useClass: form.useClass.trim() || null,
          summary: form.summary.trim() || null,
          notes: form.notes.trim() || null,
        };

        if (isEdit && listing) {
          await updateListing({
            listingId: listing.id,
            accountId,
            ...shared,
          });
        } else {
          await createListing({ accountId, ...shared });
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {isEdit ? 'Edit listing' : 'Add listing'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Name *
            </Label>
            <Input
              value={form.name}
              onChange={(e) => field('name', e.target.value)}
              placeholder="e.g. 12 High Street – Ground Floor"
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Address
            </Label>
            <Input
              value={form.addressLine1}
              onChange={(e) => field('addressLine1', e.target.value)}
              placeholder="Address line 1"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Town
              </Label>
              <Input
                value={form.town}
                onChange={(e) => field('town', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Postcode
              </Label>
              <Input
                value={form.postcode}
                onChange={(e) => field('postcode', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Disposal
              </Label>
              <Select
                value={form.disposalType}
                onValueChange={(v) => field('disposalType', v)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {DISPOSAL_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => field('status', v)}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {LISTING_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Asking rent (£ pa)
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
                Asking price (£)
              </Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.askingPrice}
                onChange={(e) => field('askingPrice', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Min sq ft
              </Label>
              <Input
                type="number"
                min={0}
                value={form.sizeMinSqft}
                onChange={(e) => field('sizeMinSqft', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Max sq ft
              </Label>
              <Input
                type="number"
                min={0}
                value={form.sizeMaxSqft}
                onChange={(e) => field('sizeMaxSqft', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Use class
              </Label>
              <Input
                value={form.useClass}
                onChange={(e) => field('useClass', e.target.value)}
                placeholder="e.g. E"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Sector
            </Label>
            <Input
              value={form.sector}
              onChange={(e) => field('sector', e.target.value)}
              placeholder="Office, retail, industrial…"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Summary
            </Label>
            <Textarea
              value={form.summary}
              onChange={(e) => field('summary', e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Notes
            </Label>
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
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className={workspaceBtnPrimaryMd}
            >
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add listing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
