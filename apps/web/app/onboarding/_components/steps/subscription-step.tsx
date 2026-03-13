'use client';

import Link from 'next/link';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import {
  createTestSubscription,
  updateOnboardingStep,
} from '../../_lib/server/onboarding.actions';
import { PrimaryButton } from '../primary-button';

const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_ALLOW_TEST_SUBSCRIPTION === 'true';

interface SubscriptionStepProps {
  accountId: string;
  accountSlug: string;
  hasActiveSubscription: boolean;
}

export function SubscriptionStep({
  accountId,
  accountSlug,
  hasActiveSubscription,
}: SubscriptionStepProps) {
  const router = useRouter();
  const billingPath = pathsConfig.app.accountBilling.replace(
    '[account]',
    accountSlug,
  );

  const handleContinue = async () => {
    await updateOnboardingStep(accountId, 6);
    router.push(`/onboarding?account_id=${accountId}&step=6`);
    router.refresh();
  };

  const handleTestSubscription = async () => {
    const result = await createTestSubscription(accountId);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Subscription
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          You need an active trial or subscription to continue.
        </p>
      </div>

      {hasActiveSubscription ? (
        <>
          <p className="text-sm text-emerald-400">
            You have an active subscription. You can continue onboarding.
          </p>
          <div className="flex justify-end">
            <PrimaryButton
              onClick={handleContinue}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            Start a trial or subscribe to unlock your workspace.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton asChild className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500">
              <Link href={billingPath}>
                Go to billing
                <ChevronRight className="h-4 w-4" />
              </Link>
            </PrimaryButton>
            {isDev && (
              <button
                type="button"
                onClick={handleTestSubscription}
                className="rounded-lg border border-dashed border-zinc-600 px-4 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
              >
                Add test subscription (dev only)
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            After you have an active subscription, return here to continue.
          </p>
        </>
      )}
    </div>
  );
}
