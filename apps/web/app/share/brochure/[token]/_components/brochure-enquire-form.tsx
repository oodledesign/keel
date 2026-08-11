'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { submitBrochureEnquiry } from '../_lib/server/brochure-enquiry-action';

type BrochureEnquireFormProps = {
  token: string;
  listingName: string;
};

export function BrochureEnquireForm({
  token,
  listingName,
}: BrochureEnquireFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-2xl border border-[var(--ozer-border-on-dark)]/40 bg-[var(--ozer-plum-950)]/60 p-6 text-center">
        <p className="font-heading text-lg font-bold text-[var(--ozer-text-on-dark)]">
          Thank you
        </p>
        <p className="mt-2 text-sm text-[var(--ozer-text-on-dark-muted)]">
          Your enquiry about {listingName} has been sent. An agent will be in
          touch shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        startTransition(async () => {
          try {
            await submitBrochureEnquiry({
              token,
              contactName: String(data.get('contactName') ?? ''),
              contactEmail: String(data.get('contactEmail') ?? ''),
              contactPhone: String(data.get('contactPhone') ?? ''),
              message: String(data.get('message') ?? ''),
              website: String(data.get('website') ?? ''),
            });
            setSent(true);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : 'Something went wrong. Please try again.',
            );
          }
        });
      }}
    >
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label
            htmlFor="brochure-name"
            className="text-[var(--ozer-text-on-dark-muted)]"
          >
            Name
          </Label>
          <Input
            id="brochure-name"
            name="contactName"
            required
            disabled={pending}
            className="border-[var(--ozer-border-on-dark)]/50 bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label
            htmlFor="brochure-email"
            className="text-[var(--ozer-text-on-dark-muted)]"
          >
            Email
          </Label>
          <Input
            id="brochure-email"
            name="contactEmail"
            type="email"
            required
            disabled={pending}
            className="border-[var(--ozer-border-on-dark)]/50 bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="brochure-phone"
          className="text-[var(--ozer-text-on-dark-muted)]"
        >
          Phone <span className="opacity-60">(optional)</span>
        </Label>
        <Input
          id="brochure-phone"
          name="contactPhone"
          type="tel"
          disabled={pending}
          className="border-[var(--ozer-border-on-dark)]/50 bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]"
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="brochure-message"
          className="text-[var(--ozer-text-on-dark-muted)]"
        >
          Message <span className="opacity-60">(optional)</span>
        </Label>
        <Textarea
          id="brochure-message"
          name="message"
          rows={3}
          disabled={pending}
          placeholder="Tell us what you’re looking for…"
          className="border-[var(--ozer-border-on-dark)]/50 bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]"
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--ozer-coral-400)]">{error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)] sm:w-auto sm:px-8"
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </Button>
    </form>
  );
}
