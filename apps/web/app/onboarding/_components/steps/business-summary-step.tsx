'use client';

import Link from 'next/link';

import { PrimaryButton } from '../primary-button';

interface BusinessSummaryStepProps {
  accountName: string;
  accountSlug: string;
  nextStepHref: string;
}

export function BusinessSummaryStep({
  accountName,
  accountSlug,
  nextStepHref,
}: BusinessSummaryStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Your business
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          You can edit this later in business settings.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Business name
          </label>
          <p className="mt-1 text-white">{accountName}</p>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            URL slug
          </label>
          <p className="mt-1 font-mono text-sm text-zinc-300">
            /home/{accountSlug || '—'}
          </p>
        </div>
      </div>

      <PrimaryButton asChild>
        <Link href={nextStepHref}>Continue</Link>
      </PrimaryButton>
    </div>
  );
}
