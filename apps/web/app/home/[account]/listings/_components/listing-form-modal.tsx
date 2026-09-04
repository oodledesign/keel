'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { Upload } from 'lucide-react';

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

import { AddressSearchField } from '~/components/commercial/address-search-field';
import { ListingStatusBadge } from '~/components/commercial/listing-status-badge';
import pathsConfig from '~/config/paths.config';
import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';
import {
  COMMERCIAL_PROPERTY_TYPES,
  COMMERCIAL_USE_CLASSES,
  COMMERCIAL_USE_CLASS_LABELS,
  DISPOSAL_TYPES,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  LISTING_LET_TYPES,
  LISTING_LET_TYPE_LABELS,
  LISTING_STATUSES,
  type ListingLetType,
  type ListingStatus,
  disposalIncludesToLet,
  listingStatusPublishHint,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  type ListingFormState,
  formStateToListingPayload,
  listingEmptyForm,
  listingToFormState,
} from '../_lib/listing-form-shared';
import type { CommercialListing } from '../_lib/server/listings.service';
import { createListing, updateListing } from '../_lib/server/server-actions';

const emptyForm = listingEmptyForm;

interface ListingFormModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountSlug?: string;
  listing?: CommercialListing | null;
  onSaved: (listing: CommercialListing) => void;
  /** Prefill for create-from-instruction flows. */
  defaults?: Partial<typeof emptyForm>;
  instructingClientId?: string | null;
  /** When opening for edit after AI generate, override marketing copy fields. */
  marketingOverrides?: {
    summary?: string;
    description?: string;
    locationCopy?: string;
    keyPoints?: string[];
  } | null;
}

export function ListingFormModal({
  open,
  onClose,
  accountId,
  accountSlug,
  listing,
  onSaved,
  defaults,
  instructingClientId,
  marketingOverrides,
}: ListingFormModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            {listing ? 'Edit disposal' : 'Add disposal'}
          </DialogTitle>
        </DialogHeader>
        <ListingFormFields
          key={`${listing?.id ?? 'new'}-${open ? 'open' : 'closed'}-${marketingOverrides ? 'ai' : 'base'}`}
          accountId={accountId}
          accountSlug={accountSlug}
          listing={listing}
          onClose={onClose}
          onSaved={onSaved}
          defaults={defaults}
          instructingClientId={instructingClientId}
          marketingOverrides={marketingOverrides}
        />
      </DialogContent>
    </Dialog>
  );
}

function ListingFormFields({
  accountId,
  accountSlug,
  listing,
  onClose,
  onSaved,
  defaults,
  instructingClientId,
  marketingOverrides,
  presentation = 'modal',
  autosaveStatus,
  onFormChange,
  onDone,
}: {
  accountId: string;
  accountSlug?: string;
  listing?: CommercialListing | null;
  onClose: () => void;
  onSaved: (listing: CommercialListing) => void;
  defaults?: Partial<typeof emptyForm>;
  instructingClientId?: string | null;
  marketingOverrides?: {
    summary?: string;
    description?: string;
    locationCopy?: string;
    keyPoints?: string[];
  } | null;
  presentation?: 'modal' | 'page';
  autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onFormChange?: (form: ListingFormState) => void;
  onDone?: () => void;
}) {
  const isEdit = Boolean(listing);
  const isPage = presentation === 'page';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ListingFormState>(() => {
    if (listing) return listingToFormState(listing, marketingOverrides);
    return { ...emptyForm, ...defaults };
  });

  const previousStatus = listing?.status ?? null;

  const updateForm = (
    updater: ListingFormState | ((prev: ListingFormState) => ListingFormState),
  ) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onFormChange?.(next);
      return next;
    });
  };

  const field = (key: keyof ListingFormState, value: string | boolean) =>
    updateForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const shared = formStateToListingPayload(form);

        const saved =
          isEdit && listing
            ? await updateListing({
                listingId: listing.id,
                accountId,
                ...shared,
              })
            : await createListing({
                accountId,
                ...shared,
                instructingClientId: instructingClientId ?? undefined,
              });

        onSaved(saved);

        if (form.status === 'marketing' && previousStatus !== 'marketing') {
          const { maybeNudgeMoveInstructionToCurrent } =
            await import('../_lib/client/marketing-instruction-nudge');
          await maybeNudgeMoveInstructionToCurrent({
            accountId,
            listingId: saved.id,
          });
        }

        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  };

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

  function applyAddressSuggestion(suggestion: AddressSuggestion) {
    updateForm((prev) => ({
      ...prev,
      name:
        prev.name.trim() ||
        suggestion.nameHint?.trim() ||
        suggestion.addressLine1?.trim() ||
        suggestion.label,
      addressLine1: suggestion.addressLine1 ?? prev.addressLine1,
      addressLine2: suggestion.addressLine2 ?? '',
      town: suggestion.town ?? prev.town,
      county: suggestion.county ?? prev.county,
      postcode: suggestion.postcode ?? prev.postcode,
      country: suggestion.country || prev.country || 'GB',
      latitude: String(suggestion.latitude),
      longitude: String(suggestion.longitude),
    }));
  }

  const saveStatusLabel =
    autosaveStatus === 'saving'
      ? 'Saving…'
      : autosaveStatus === 'saved'
        ? 'All changes saved'
        : autosaveStatus === 'error'
          ? 'Could not save'
          : null;

  return (
    <form
      onSubmit={isPage ? (e) => e.preventDefault() : handleSubmit}
      className="space-y-5 pt-2"
    >
      <section className="space-y-4">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
          Basics
        </h3>
        <AddressSearchField
          onSelect={applyAddressSuggestion}
          inputClassName={inputClass}
        />
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            {isPage ? 'Name' : 'Name *'}
          </Label>
          <Input
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
            placeholder="e.g. 10 Example Street – Ground Floor"
            required={!isPage}
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
              County
            </Label>
            <Input
              value={form.county}
              onChange={(e) => field('county', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Country
            </Label>
            <Input
              value={form.country}
              onChange={(e) => field('country', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Latitude
            </Label>
            <Input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => field('latitude', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Longitude
            </Label>
            <Input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => field('longitude', e.target.value)}
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
              <SelectTrigger className={`${inputClass} h-auto min-h-10 py-2`}>
                <ListingStatusBadge status={form.status} size="md" />
              </SelectTrigger>
              <SelectContent>
                {LISTING_STATUSES.map((status) => (
                  <SelectItem key={status} value={status} className="py-2 pr-10">
                    <span className="flex w-full items-center justify-between gap-3">
                      <ListingStatusBadge status={status} size="md" />
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {listingStatusPublishHint(status)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Instruction
            </Label>
            <Select
              value={form.instructionNature}
              onValueChange={(v) => field('instructionNature', v)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclusive">Exclusive</SelectItem>
                <SelectItem value="joint">Joint</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              External ID
            </Label>
            <Input
              value={form.externalId}
              onChange={(e) => field('externalId', e.target.value)}
              placeholder="Property Hive / portal ID"
              className={inputClass}
            />
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
              Asking rent from (£)
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
              Asking rent to (£)
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.askingRentTo}
              onChange={(e) => field('askingRentTo', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              Service charge (£/sq ft)
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
              Rates payable (£/sq ft)
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
              Estate charge (£/sq ft)
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

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
            <input
              type="checkbox"
              checked={form.hideRentFromMarketing}
              onChange={(e) =>
                updateForm((prev) => ({
                  ...prev,
                  hideRentFromMarketing: e.target.checked,
                }))
              }
              className="rounded border-[color:var(--workspace-shell-border)]"
            />
            Hide rent from marketing (POA)
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/70">
            <input
              type="checkbox"
              checked={form.hidePriceFromMarketing}
              onChange={(e) =>
                updateForm((prev) => ({
                  ...prev,
                  hidePriceFromMarketing: e.target.checked,
                }))
              }
              className="rounded border-[color:var(--workspace-shell-border)]"
            />
            Hide price from marketing (POA)
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Min sq ft
            </Label>
            <Input
              type="number"
              min={0}
              step="any"
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
              step="any"
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
                <SelectItem value="site">Site area</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Insurance
            </Label>
            <Input
              value={form.insuranceType}
              onChange={(e) => field('insuranceType', e.target.value)}
              placeholder="FRI, IRI…"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Land size unit
            </Label>
            <Select
              value={form.landSizeMetric || 'unset'}
              onValueChange={(v) =>
                field('landSizeMetric', v === 'unset' ? '' : v)
              }
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="hectare">Hectare</SelectItem>
                <SelectItem value="acres">Acres</SelectItem>
                <SelectItem value="sqft">Sq ft</SelectItem>
                <SelectItem value="sqm">Sq m</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Land size from
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.landSizeMin}
              onChange={(e) => field('landSizeMin', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Land size to
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.landSizeMax}
              onChange={(e) => field('landSizeMax', e.target.value)}
              className={inputClass}
            />
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Use class
            </Label>
            <Select
              value={form.useClass || 'unset'}
              onValueChange={(v) => field('useClass', v === 'unset' ? '' : v)}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select use class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not set</SelectItem>
                {COMMERCIAL_USE_CLASSES.map((useClass) => (
                  <SelectItem key={useClass} value={useClass}>
                    {COMMERCIAL_USE_CLASS_LABELS[useClass]}
                  </SelectItem>
                ))}
                {form.useClass &&
                !(COMMERCIAL_USE_CLASSES as readonly string[]).includes(
                  form.useClass,
                ) ? (
                  <SelectItem value={form.useClass}>{form.useClass}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
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

        {disposalIncludesToLet(form.disposalType) ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Let type
              </Label>
              <Select
                value={form.letType || 'unset'}
                onValueChange={(v) =>
                  field('letType', v === 'unset' ? '' : (v as ListingLetType))
                }
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Ask agent (unset)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Ask agent (unset)</SelectItem>
                  {LISTING_LET_TYPES.map((letType) => (
                    <SelectItem key={letType} value={letType}>
                      {LISTING_LET_TYPE_LABELS[letType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Let contract length (months)
              </Label>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={form.letContractLengthMonths}
                onChange={(e) =>
                  field('letContractLengthMonths', e.target.value)
                }
                placeholder="e.g. 60"
                className={inputClass}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
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
              EPC rating
            </Label>
            <Input
              type="number"
              min={0}
              max={999}
              value={form.epcRating}
              onChange={(e) => field('epcRating', e.target.value)}
              placeholder="e.g. 125"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Possession
            </Label>
            <Input
              value={form.possession}
              onChange={(e) => field('possession', e.target.value)}
              placeholder="Immediate, by arrangement…"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Fitted space
            </Label>
            <Select
              value={form.fittedSpace || 'unset'}
              onValueChange={(v) =>
                field('fittedSpace', v === 'unset' ? '' : v)
              }
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[var(--workspace-shell-text)]/70">
              Build status
            </Label>
            <Input
              value={form.buildStatus}
              onChange={(e) => field('buildStatus', e.target.value)}
              placeholder="Complete, under construction…"
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
            Key points
          </Label>
          <Textarea
            value={form.keyPoints}
            onChange={(e) => field('keyPoints', e.target.value)}
            rows={4}
            placeholder="One bullet per line"
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

      {isPage ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] py-4">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {saveStatusLabel ?? 'Changes save automatically'}
          </p>
          <div className="flex gap-2">
            {accountSlug ? (
              <Button type="button" variant="ghost" asChild>
                <Link
                  href={pathsConfig.app.accountListings.replace(
                    '[account]',
                    accountSlug,
                  )}
                >
                  Back to list
                </Link>
              </Button>
            ) : null}
            {onDone ? (
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                onClick={onDone}
              >
                Open disposal
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <DialogFooter className="gap-2 sm:justify-between">
          {!isEdit && accountSlug ? (
            <Button
              type="button"
              variant="ghost"
              asChild
              className="justify-start text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]"
            >
              <Link
                href={pathsConfig.app.accountListingsImport.replace(
                  '[account]',
                  accountSlug,
                )}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add disposal'}
            </Button>
          </div>
        </DialogFooter>
      )}
    </form>
  );
}

export { ListingFormFields };
