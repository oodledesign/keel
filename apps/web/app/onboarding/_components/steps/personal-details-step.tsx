'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  updateOnboardingStep,
  upsertUserSettings,
} from '../../_lib/server/onboarding.actions';
import type { StepDef } from '../../_lib/onboarding-steps.config';
import { PrimaryButton } from '../primary-button';

interface PersonalDetailsStepProps {
  accountId: string;
  nextStep: number;
  initial?: {
    first_name: string | null;
    last_name: string | null;
    mobile: string | null;
  };
}

export function PersonalDetailsStep({
  accountId,
  nextStep,
  initial,
}: PersonalDetailsStepProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(
    initial?.first_name ?? '',
  );
  const [lastName, setLastName] = useState(
    initial?.last_name ?? '',
  );
  const [mobile, setMobile] = useState(initial?.mobile ?? '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await upsertUserSettings({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      mobile: mobile.trim() || null,
    });
    await updateOnboardingStep(accountId, nextStep);
    setLoading(false);
    router.push(`/onboarding?account_id=${accountId}&step=${nextStep}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Personal Details
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          How we can reach you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="first-name"
            className="text-sm font-medium text-zinc-300"
          >
            First name
          </label>
          <input
            id="first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            placeholder="eg. John"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="last-name"
            className="text-sm font-medium text-zinc-300"
          >
            Last name
          </label>
          <input
            id="last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            placeholder="eg. Smith"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="mobile"
          className="text-sm font-medium text-zinc-300"
        >
          Mobile
        </label>
        <input
          id="mobile"
          type="tel"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          placeholder="+44 7700 900000"
        />
      </div>

      <PrimaryButton type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Continue'}
      </PrimaryButton>
    </form>
  );
}
