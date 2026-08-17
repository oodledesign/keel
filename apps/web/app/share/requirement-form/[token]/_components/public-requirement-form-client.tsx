'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
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

type Props = {
  token: string;
  agencyName: string;
  title: string;
  intro: string | null;
  privacyPolicyUrl: string | null;
  successMessage: string | null;
};

export function PublicRequirementFormClient({
  token,
  agencyName,
  title,
  intro,
  privacyPolicyUrl,
  successMessage,
}: Props) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState('');
  const [tenure, setTenure] = useState<'rent' | 'buy' | 'both'>('rent');
  const [locationText, setLocationText] = useState('');
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
            sector: sector || null,
            tenure,
            locationText: locationText || null,
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
              i === step
                ? 'font-semibold text-[var(--ozer-accent)]'
                : undefined
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
              <Label>Your name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Work email</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Company</Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="grid gap-1.5">
              <Label>Sector</Label>
              <Input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. Industrial, Office"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tenure</Label>
              <Select
                value={tenure}
                onValueChange={(v) => setTenure(v as typeof tenure)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">To let</SelectItem>
                  <SelectItem value="buy">For sale</SelectItem>
                  <SelectItem value="both">Either</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Input
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Town, area, or postcode"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Size min (sq ft)</Label>
                <Input
                  type="number"
                  value={sizeMin}
                  onChange={(e) => setSizeMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Size max (sq ft)</Label>
                <Input
                  type="number"
                  value={sizeMax}
                  onChange={(e) => setSizeMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Budget min (£)</Label>
                <Input
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Budget max (£)</Label>
                <Input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
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
              <input
                type="checkbox"
                className="mt-1"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
              />
              <span>
                I want to receive matching commercial opportunities from{' '}
                {agencyName}.
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
              disabled={
                pending ||
                (step === 0 && (!contactName.trim() || !contactEmail.trim()))
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? 'Submitting…' : 'Submit requirement'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
