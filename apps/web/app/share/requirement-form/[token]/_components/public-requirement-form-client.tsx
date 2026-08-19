'use client';

import { useState, useTransition } from 'react';

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
import { Textarea } from '@kit/ui/textarea';

import {
  REQUIREMENT_LOCATION_RADIUS_OPTIONS,
  REQUIREMENT_PROPERTY_TYPES,
  tenureFromAvailability,
} from '~/lib/commercial/requirement-form-fields';

type Office = { id: string; name: string };

type Props = {
  token: string;
  agencyName: string;
  title: string;
  intro: string | null;
  privacyPolicyUrl: string | null;
  successMessage: string | null;
  offices: Office[];
};

export function PublicRequirementFormClient({
  token,
  agencyName,
  title,
  intro,
  privacyPolicyUrl,
  successMessage,
  offices,
}: Props) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [branchId, setBranchId] = useState(offices[0]?.id ?? '');
  const [propertyType, setPropertyType] = useState('all');
  const [forSale, setForSale] = useState(false);
  const [toRent, setToRent] = useState(true);
  const [locationText, setLocationText] = useState('');
  const [radiusMiles, setRadiusMiles] = useState('0');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [notes, setNotes] = useState('');
  const [optIn, setOptIn] = useState(false);

  function submit() {
    setError(null);
    if (!optIn) {
      setError('Please confirm you want to receive matching opportunities.');
      return;
    }

    const tenure = tenureFromAvailability(forSale, toRent);

    startTransition(async () => {
      try {
        const res = await fetch('/api/commercial/requirement-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            contactName,
            contactEmail,
            contactPhone: contactPhone || null,
            companyName: companyName || null,
            branchId: branchId || null,
            sector: propertyType === 'all' ? null : propertyType,
            tenure,
            locationText: locationText || null,
            searchRadiusMiles: Number(radiusMiles),
            sizeMinSqft: sizeMin ? Number(sizeMin) : null,
            sizeMaxSqft: sizeMax ? Number(sizeMax) : null,
            budgetMinPence: budgetMin
              ? Math.round(Number(budgetMin) * 100)
              : null,
            budgetMaxPence: budgetMax
              ? Math.round(Number(budgetMax) * 100)
              : null,
            notes: notes || null,
            marketingOptIn: true,
          }),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        if (!res.ok) {
          throw new Error(body?.error ?? 'Submission failed');
        }
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission failed');
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--ozer-plum-900)]">
          Thank you
        </h1>
        <p className="mt-3 text-[var(--ozer-plum-900)]/70">
          {successMessage ||
            `We have received your requirement for ${agencyName}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-[var(--ozer-accent)] uppercase">
        {agencyName}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--ozer-plum-900)]">
        {title}
      </h1>
      {intro ? (
        <p className="mt-2 text-sm text-[var(--ozer-plum-900)]/70">{intro}</p>
      ) : null}

      <div className="mt-6 flex gap-2 text-xs text-[var(--ozer-plum-900)]/50">
        {['Contact', 'Requirement', 'Confirm'].map((label, i) => (
          <span
            key={label}
            className={
              i === step ? 'font-semibold text-[var(--ozer-accent)]' : undefined
            }
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="req-name">Full name *</Label>
              <Input
                id="req-name"
                data-test="requirement-contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="req-email">Email address *</Label>
              <Input
                id="req-email"
                data-test="requirement-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="req-phone">Telephone number</Label>
              <Input
                id="req-phone"
                data-test="requirement-contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="req-company">Company</Label>
              <Input
                id="req-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            {offices.length > 0 ? (
              <div className="grid gap-1.5">
                <Label>Office</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger data-test="requirement-office">
                    <SelectValue placeholder="Select office" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-[var(--ozer-plum-900)]">
                <Checkbox
                  checked={forSale}
                  onCheckedChange={(checked) => setForSale(checked === true)}
                />
                For sale
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--ozer-plum-900)]">
                <Checkbox
                  checked={toRent}
                  onCheckedChange={(checked) => setToRent(checked === true)}
                />
                To rent
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="req-size-min">Min floor area (sq ft)</Label>
                <Input
                  id="req-size-min"
                  type="number"
                  min={0}
                  value={sizeMin}
                  onChange={(e) => setSizeMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="req-size-max">Max floor area (sq ft)</Label>
                <Input
                  id="req-size-max"
                  type="number"
                  min={0}
                  value={sizeMax}
                  onChange={(e) => setSizeMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Property type</Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger data-test="requirement-property-type">
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
              <Label htmlFor="req-location">Location</Label>
              <Input
                id="req-location"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Town, area, or postcode"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Location radius</Label>
              <Select value={radiusMiles} onValueChange={setRadiusMiles}>
                <SelectTrigger data-test="requirement-location-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIREMENT_LOCATION_RADIUS_OPTIONS.map((option) => (
                    <SelectItem key={option.miles} value={String(option.miles)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="req-budget-min">Budget min (£)</Label>
                <Input
                  id="req-budget-min"
                  type="number"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="req-budget-max">Budget max (£)</Label>
                <Input
                  id="req-budget-max"
                  type="number"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="req-notes">Additional requirements</Label>
              <Textarea
                id="req-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-sm text-[var(--ozer-plum-900)]/80">
              By submitting this form you ask {agencyName} to store your
              requirement and email you commercial property opportunities that
              may match. You can unsubscribe at any time.
              {privacyPolicyUrl ? (
                <>
                  {' '}
                  See our{' '}
                  <a
                    href={privacyPolicyUrl}
                    className="text-[var(--ozer-accent)] underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    privacy notice
                  </a>
                  .
                </>
              ) : null}
            </p>
            <label className="flex items-start gap-2 text-sm text-[var(--ozer-plum-900)]">
              <Checkbox
                className="mt-1"
                checked={optIn}
                onCheckedChange={(checked) => setOptIn(checked === true)}
              />
              <span>
                I agree to the privacy notice and agree to let {agencyName} send
                me emails related to new properties that may be of interest to
                me.
              </span>
            </label>
          </>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              data-test="requirement-form-continue"
              disabled={
                pending ||
                (step === 0 && (!contactName.trim() || !contactEmail.trim()))
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              data-test="requirement-form-submit"
              disabled={pending}
              onClick={submit}
            >
              {pending ? 'Submitting…' : 'Register'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
