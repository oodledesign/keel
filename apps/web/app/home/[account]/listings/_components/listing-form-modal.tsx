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
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
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
  onSaved: (listing: CommercialListing) => void;
}

const emptyForm = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  postcode: '',
  sector: '',
  tenure: '',
  disposalType: 'to_let' as DisposalType,
  status: 'draft' as ListingStatus,
  askingRent: '',
  askingPrice: '',
  rentFrequency: 'per_annum',
  sizeMinSqft: '',
  sizeMaxSqft: '',
  measurementStandard: 'gia',
  useClass: '',
  availableFrom: '',
  epcBand: '',
  summary: '',
  description: '',
  locationCopy: '',
  notes: '',
};

export function ListingFormModal({
  open,
  onClose,
  accountId,
  listing,
  onSaved,
}: ListingFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {listing ? 'Edit listing' : 'Add listing'}
          </DialogTitle>
        </DialogHeader>
        <ListingFormFields
          key={`${listing?.id ?? 'new'}-${open ? 'open' : 'closed'}`}
          accountId={accountId}
          listing={listing}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ListingFormFields({
  accountId,
  listing,
  onClose,
  onSaved,
}: {
  accountId: string;
  listing?: CommercialListing | null;
  onClose: () => void;
  onSaved: (listing: CommercialListing) => void;
}) {
  const isEdit = Boolean(listing);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    listing
      ? {
          name: listing.name,
          addressLine1: listing.addressLine1 ?? '',
          addressLine2: listing.addressLine2 ?? '',
          town: listing.town ?? '',
          postcode: listing.postcode ?? '',
          sector: listing.sector ?? '',
          tenure: listing.tenure ?? '',
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
          rentFrequency: listing.rentFrequency ?? 'per_annum',
          sizeMinSqft:
            listing.sizeMinSqft != null ? String(listing.sizeMinSqft) : '',
          sizeMaxSqft:
            listing.sizeMaxSqft != null ? String(listing.sizeMaxSqft) : '',
          measurementStandard: listing.measurementStandard ?? 'gia',
          useClass: listing.useClass ?? '',
          availableFrom: listing.availableFrom ?? '',
          epcBand: listing.epcBand ?? '',
          summary: listing.summary ?? '',
          description: listing.description ?? '',
          locationCopy: listing.locationCopy ?? '',
          notes: listing.notes ?? '',
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
        const shared = {
          name: form.name.trim(),
          addressLine1: form.addressLine1.trim() || null,
          addressLine2: form.addressLine2.trim() || null,
          town: form.town.trim() || null,
          postcode: form.postcode.trim() || null,
          sector: form.sector.trim() || null,
          tenure: form.tenure.trim() || null,
          disposalType: form.disposalType,
          status: form.status,
          askingRentPence: form.askingRent
            ? Math.round(parseFloat(form.askingRent) * 100)
            : null,
          askingPricePence: form.askingPrice
            ? Math.round(parseFloat(form.askingPrice) * 100)
            : null,
          rentFrequency: form.rentFrequency || null,
          sizeMinSqft: form.sizeMinSqft ? parseFloat(form.sizeMinSqft) : null,
          sizeMaxSqft: form.sizeMaxSqft ? parseFloat(form.sizeMaxSqft) : null,
          measurementStandard: form.measurementStandard || null,
          useClass: form.useClass.trim() || null,
          availableFrom: form.availableFrom.trim() || null,
          epcBand: form.epcBand.trim() || null,
          summary: form.summary.trim() || null,
          description: form.description.trim() || null,
          locationCopy: form.locationCopy.trim() || null,
          notes: form.notes.trim() || null,
        };

        const saved =
          isEdit && listing
            ? await updateListing({
                listingId: listing.id,
                accountId,
                ...shared,
              })
            : await createListing({ accountId, ...shared });

        onSaved(saved);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  return (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              Basics
            </h3>
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
              <Input
                value={form.addressLine2}
                onChange={(e) => field('addressLine2', e.target.value)}
                placeholder="Address line 2"
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
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              Pricing & size
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                  Rent frequency
                </Label>
                <Select
                  value={form.rentFrequency}
                  onValueChange={(v) => field('rentFrequency', v)}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_annum">Per annum</SelectItem>
                    <SelectItem value="per_month">Per month</SelectItem>
                    <SelectItem value="per_sqft">Per sq ft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  Measurement
                </Label>
                <Select
                  value={form.measurementStandard}
                  onValueChange={(v) => field('measurementStandard', v)}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gia">GIA</SelectItem>
                    <SelectItem value="nia">NIA</SelectItem>
                    <SelectItem value="gea">GEA</SelectItem>
                    <SelectItem value="ipms">IPMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              Specs
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
                  Tenure / lease type
                </Label>
                <Input
                  value={form.tenure}
                  onChange={(e) => field('tenure', e.target.value)}
                  placeholder="New lease, freehold…"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  EPC band
                </Label>
                <Input
                  value={form.epcBand}
                  onChange={(e) => field('epcBand', e.target.value)}
                  placeholder="A–G"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--workspace-shell-text)]/70">
                  Available from
                </Label>
                <Input
                  type="date"
                  value={form.availableFrom}
                  onChange={(e) => field('availableFrom', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
              Marketing copy
            </h3>
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
                Description / terms
              </Label>
              <Textarea
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
                rows={4}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Location copy
              </Label>
              <Textarea
                value={form.locationCopy}
                onChange={(e) => field('locationCopy', e.target.value)}
                rows={3}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Internal notes
              </Label>
              <Textarea
                value={form.notes}
                onChange={(e) => field('notes', e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>
          </section>

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
  );
}
