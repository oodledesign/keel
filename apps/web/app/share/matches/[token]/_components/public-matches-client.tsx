'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
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

import {
  REQUIREMENT_LOCATION_RADIUS_OPTIONS,
  REQUIREMENT_PROPERTY_TYPES,
  availabilityFromTenure,
  radiusSelectValue,
  tenureFromAvailability,
} from '~/lib/commercial/requirement-form-fields';

import {
  updatePublicMatchRequirement,
  updatePublicMatchSettings,
} from '../_lib/server/public-matches-actions';

export type PublicMatchesListing = {
  listingId: string;
  name: string;
  summary: string;
  address: string;
  town: string | null;
  sector: string | null;
  disposalTypeLabel: string;
  sizeLabel: string | null;
  viewUrl: string | null;
  viewUrlLabel: string | null;
  websiteListingUrl: string | null;
  coverImageUrl: string | null;
};

export type PublicMatchesRequirement = {
  id: string;
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
};

type Brand = {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type Props = {
  token: string;
  email: string;
  contactName: string | null;
  agencyName: string;
  brand: Brand;
  initialUnsubscribed: boolean;
  initialNotifyOnNewMatch: boolean;
  initialRequirement: PublicMatchesRequirement | null;
  listings: PublicMatchesListing[];
};

function penceToPoundsInput(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(pence)) return '';
  return String(pence / 100);
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function PublicMatchesClient({
  token,
  email,
  contactName,
  agencyName,
  brand,
  initialUnsubscribed,
  initialNotifyOnNewMatch,
  initialRequirement,
  listings,
}: Props) {
  const router = useRouter();
  const [unsubscribed, setUnsubscribed] = useState(initialUnsubscribed);
  const [notifyOnNewMatch, setNotifyOnNewMatch] = useState(
    initialNotifyOnNewMatch,
  );
  const [pending, startTransition] = useTransition();
  const [requirementPending, startRequirementTransition] = useTransition();

  const initialAvailability = useMemo(
    () => availabilityFromTenure(initialRequirement?.tenure ?? null),
    [initialRequirement?.tenure],
  );

  const [forSale, setForSale] = useState(initialAvailability.forSale);
  const [toRent, setToRent] = useState(
    initialAvailability.toRent ||
      (!initialAvailability.forSale && !initialAvailability.toRent),
  );
  const [propertyType, setPropertyType] = useState(
    initialRequirement?.sector &&
      (REQUIREMENT_PROPERTY_TYPES as readonly string[]).includes(
        initialRequirement.sector,
      )
      ? initialRequirement.sector
      : 'all',
  );
  const [locationText, setLocationText] = useState(
    initialRequirement?.locationText ?? '',
  );
  const [radiusMiles, setRadiusMiles] = useState(
    radiusSelectValue(initialRequirement?.searchRadiusMiles),
  );
  const [sizeMin, setSizeMin] = useState(
    initialRequirement?.sizeMinSqft != null
      ? String(initialRequirement.sizeMinSqft)
      : '',
  );
  const [sizeMax, setSizeMax] = useState(
    initialRequirement?.sizeMaxSqft != null
      ? String(initialRequirement.sizeMaxSqft)
      : '',
  );
  const [budgetMin, setBudgetMin] = useState(
    penceToPoundsInput(initialRequirement?.budgetMinPence),
  );
  const [budgetMax, setBudgetMax] = useState(
    penceToPoundsInput(initialRequirement?.budgetMaxPence),
  );

  function saveEmailPrefs(next: {
    unsubscribed: boolean;
    notifyOnNewMatch: boolean;
  }) {
    const previous = { unsubscribed, notifyOnNewMatch };
    setUnsubscribed(next.unsubscribed);
    setNotifyOnNewMatch(next.notifyOnNewMatch);
    startTransition(async () => {
      try {
        await updatePublicMatchSettings({
          token,
          unsubscribed: next.unsubscribed,
          notifyOnNewMatch: next.notifyOnNewMatch,
        });
        toast.success('Preferences saved');
      } catch (error) {
        setUnsubscribed(previous.unsubscribed);
        setNotifyOnNewMatch(previous.notifyOnNewMatch);
        toast.error(
          error instanceof Error ? error.message : 'Could not save preferences',
        );
      }
    });
  }

  function saveRequirement() {
    if (!initialRequirement) return;
    if (!forSale && !toRent) {
      toast.error('Select for sale, to rent, or both.');
      return;
    }

    const sizeMinSqft = parseOptionalNumber(sizeMin);
    const sizeMaxSqft = parseOptionalNumber(sizeMax);
    const budgetMinPounds = parseOptionalNumber(budgetMin);
    const budgetMaxPounds = parseOptionalNumber(budgetMax);

    if (sizeMin !== '' && sizeMinSqft == null) {
      toast.error('Enter a valid minimum size.');
      return;
    }
    if (sizeMax !== '' && sizeMaxSqft == null) {
      toast.error('Enter a valid maximum size.');
      return;
    }
    if (budgetMin !== '' && budgetMinPounds == null) {
      toast.error('Enter a valid minimum budget.');
      return;
    }
    if (budgetMax !== '' && budgetMaxPounds == null) {
      toast.error('Enter a valid maximum budget.');
      return;
    }

    startRequirementTransition(async () => {
      try {
        await updatePublicMatchRequirement({
          token,
          sector:
            propertyType === 'all'
              ? null
              : (propertyType as (typeof REQUIREMENT_PROPERTY_TYPES)[number]),
          tenure: tenureFromAvailability(forSale, toRent),
          locationText: locationText.trim() || null,
          searchRadiusMiles: Number(radiusMiles),
          sizeMinSqft,
          sizeMaxSqft,
          budgetMinPence:
            budgetMinPounds == null ? null : Math.round(budgetMinPounds * 100),
          budgetMaxPence:
            budgetMaxPounds == null ? null : Math.round(budgetMaxPounds * 100),
        });
        toast.success('Requirement saved');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save requirement',
        );
      }
    });
  }

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6"
      style={{ background: brand.secondaryColor || '#F4F4F1' }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <header
          className="rounded-t-2xl px-6 py-5"
          style={{ background: brand.primaryColor }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={agencyName} className="h-10 w-auto" />
          ) : (
            <p className="text-lg font-semibold text-white">{agencyName}</p>
          )}
        </header>

        <section className="rounded-b-2xl border border-[#E4E2DC] bg-white px-6 py-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#09111F]">
            {contactName ? `Properties for ${contactName}` : 'Your matches'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3D3D3D]">
            Your personal matches from {agencyName}. This page stays up to date
            as new opportunities appear, and is private to {email}.
          </p>

          {listings.length === 0 ? (
            <p className="mt-6 text-sm text-[#6B6B6B]">
              There are no live properties matching your requirement right now.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {listings.map((listing) => (
                <li
                  key={listing.listingId}
                  className="overflow-hidden rounded-xl border border-[#E4E2DC]"
                >
                  {listing.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.coverImageUrl}
                      alt={listing.name}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : null}
                  <div className="p-4">
                    <h2 className="text-lg font-semibold text-[#09111F]">
                      {listing.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#6B6B6B]">
                      {[listing.disposalTypeLabel, listing.sizeLabel]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {listing.address ? (
                      <p className="mt-1 text-sm text-[#3D3D3D]">
                        {listing.address}
                      </p>
                    ) : null}
                    {listing.summary ? (
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[#3D3D3D]">
                        {listing.summary}
                      </p>
                    ) : null}
                    {listing.viewUrl ? (
                      <a
                        href={listing.viewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white"
                        style={{ background: brand.accentColor }}
                      >
                        {listing.viewUrlLabel?.trim() || 'View details'}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 space-y-4 border-t border-[#E4E2DC] pt-6">
            <h2 className="text-base font-semibold text-[#09111F]">
              Your requirement
            </h2>
            {!initialRequirement ? (
              <p className="text-sm text-[#6B6B6B]">
                No requirement is linked to this address yet. Contact{' '}
                {agencyName} if you need to register one.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm text-[#3D3D3D]">
                    <Checkbox
                      checked={forSale}
                      onCheckedChange={(checked) =>
                        setForSale(checked === true)
                      }
                      data-test="matches-req-for-sale"
                    />
                    For sale
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#3D3D3D]">
                    <Checkbox
                      checked={toRent}
                      onCheckedChange={(checked) => setToRent(checked === true)}
                      data-test="matches-req-to-rent"
                    />
                    To rent
                  </label>
                </div>

                <div className="grid gap-1.5">
                  <Label>Property type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger data-test="matches-req-property-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All property types</SelectItem>
                      {REQUIREMENT_PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="matches-req-location">Location</Label>
                  <Input
                    id="matches-req-location"
                    data-test="matches-req-location"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Town, area, or postcode"
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Location radius</Label>
                  <Select value={radiusMiles} onValueChange={setRadiusMiles}>
                    <SelectTrigger data-test="matches-req-radius">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUIREMENT_LOCATION_RADIUS_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.miles}
                          value={String(option.miles)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="matches-req-size-min">
                      Min floor area (sq ft)
                    </Label>
                    <Input
                      id="matches-req-size-min"
                      data-test="matches-req-size-min"
                      type="number"
                      min={0}
                      step="any"
                      value={sizeMin}
                      onChange={(e) => setSizeMin(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="matches-req-size-max">
                      Max floor area (sq ft)
                    </Label>
                    <Input
                      id="matches-req-size-max"
                      data-test="matches-req-size-max"
                      type="number"
                      min={0}
                      step="any"
                      value={sizeMax}
                      onChange={(e) => setSizeMax(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="matches-req-budget-min">
                      Budget min (£)
                    </Label>
                    <Input
                      id="matches-req-budget-min"
                      data-test="matches-req-budget-min"
                      type="number"
                      min={0}
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="matches-req-budget-max">
                      Budget max (£)
                    </Label>
                    <Input
                      id="matches-req-budget-max"
                      data-test="matches-req-budget-max"
                      type="number"
                      min={0}
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={requirementPending}
                  onClick={saveRequirement}
                  data-test="matches-req-save"
                  style={{ background: brand.accentColor }}
                  className="text-white"
                >
                  {requirementPending ? 'Saving…' : 'Save requirement'}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-4 border-t border-[#E4E2DC] pt-6">
            <h2 className="text-base font-semibold text-[#09111F]">
              Email preferences
            </h2>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-[#3D3D3D]">
                Email me when something new matches
              </span>
              <Switch
                checked={!unsubscribed && notifyOnNewMatch}
                disabled={pending || unsubscribed}
                onCheckedChange={(enabled) =>
                  saveEmailPrefs({
                    unsubscribed: false,
                    notifyOnNewMatch: enabled,
                  })
                }
                data-test="matches-notify-switch"
              />
            </label>
            <Button
              variant={unsubscribed ? 'outline' : 'destructive'}
              disabled={pending}
              onClick={() =>
                saveEmailPrefs({
                  unsubscribed: !unsubscribed,
                  notifyOnNewMatch: unsubscribed,
                })
              }
              data-test="matches-unsubscribe-button"
            >
              {unsubscribed
                ? 'Resubscribe to matching emails'
                : 'Unsubscribe from matching emails'}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
