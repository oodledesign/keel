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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';

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

function shortSummary(summary: string, max = 140): string {
  const cleaned = summary.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
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
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ background: brand.secondaryColor || '#F4F4F1' }}
    >
      <div className="mx-auto w-full max-w-7xl">
        <header
          className="rounded-t-2xl px-6 py-5 sm:px-8"
          style={{ background: brand.primaryColor }}
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={agencyName} className="h-10 w-auto" />
          ) : (
            <p className="text-lg font-semibold text-white">{agencyName}</p>
          )}
        </header>

        <section className="rounded-b-2xl border border-[#E4E2DC] bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold tracking-tight text-[#09111F] sm:text-3xl">
              {contactName ? `Properties for ${contactName}` : 'Your matches'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#3D3D3D]">
              Your personal matches from {agencyName}. This page stays up to
              date as new opportunities appear, and is private to {email}.
            </p>
          </div>

          <Tabs defaultValue="matches" className="mt-8">
            <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-[#F4F4F1] p-1 sm:w-auto">
              <TabsTrigger value="matches" data-test="matches-tab-matches">
                Matches
                {listings.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[11px] font-medium">
                    {listings.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="requirement"
                data-test="matches-tab-requirement"
              >
                Your requirement
              </TabsTrigger>
              <TabsTrigger value="email" data-test="matches-tab-email">
                Email preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="mt-0 outline-none">
              {listings.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E4E2DC] bg-[#FAFAF8] px-5 py-10 text-center text-sm text-[#6B6B6B]">
                  There are no live properties matching your requirement right
                  now.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map((listing) => {
                    const meta = [listing.disposalTypeLabel, listing.sizeLabel]
                      .filter(Boolean)
                      .join(' · ');
                    const blurb = shortSummary(listing.summary);
                    const ctaLabel =
                      listing.viewUrlLabel?.trim() ||
                      (listing.websiteListingUrl
                        ? 'View on website'
                        : 'View details');

                    return (
                      <li
                        key={listing.listingId}
                        className="flex flex-col overflow-hidden rounded-2xl border border-[#E4E2DC] bg-white shadow-sm transition hover:shadow-md"
                      >
                        <div className="aspect-[16/10] bg-[#F4F4F1]">
                          {listing.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={listing.coverImageUrl}
                              alt={listing.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[#9A9A9A]">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h2 className="line-clamp-2 text-base font-semibold text-[#09111F]">
                            {listing.name}
                          </h2>
                          {meta ? (
                            <p className="mt-1 text-xs font-medium tracking-wide text-[#6B6B6B] uppercase">
                              {meta}
                            </p>
                          ) : null}
                          {listing.address ? (
                            <p className="mt-1 line-clamp-2 text-sm text-[#3D3D3D]">
                              {listing.address}
                            </p>
                          ) : null}
                          {blurb ? (
                            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-5 text-[#3D3D3D]">
                              {blurb}
                            </p>
                          ) : (
                            <div className="flex-1" />
                          )}
                          {listing.viewUrl ? (
                            <a
                              href={listing.viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
                              style={{ background: brand.accentColor }}
                            >
                              {ctaLabel}
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent
              value="requirement"
              className="mt-0 max-w-2xl outline-none"
            >
              <h2 className="text-base font-semibold text-[#09111F]">
                Your requirement
              </h2>
              {!initialRequirement ? (
                <p className="mt-3 text-sm text-[#6B6B6B]">
                  No requirement is linked to this address yet. Contact{' '}
                  {agencyName} if you need to register one.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
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
                        onCheckedChange={(checked) =>
                          setToRent(checked === true)
                        }
                        data-test="matches-req-to-rent"
                      />
                      To rent
                    </label>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Property type</Label>
                    <Select
                      value={propertyType}
                      onValueChange={setPropertyType}
                    >
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
            </TabsContent>

            <TabsContent value="email" className="mt-0 max-w-2xl outline-none">
              <h2 className="text-base font-semibold text-[#09111F]">
                Email preferences
              </h2>
              <div className="mt-4 space-y-4">
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
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </main>
  );
}
