'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';
import { toast } from '@kit/ui/sonner';

import {
  updateMembershipTradeRole,
  updateOnboardingStep,
} from '../../_lib/server/onboarding.actions';
import type { StepDef } from '../../_lib/onboarding-steps.config';
import { PrimaryButton } from '../primary-button';
import { SelectionCard } from '../selection-card';

const TRADES = [
  'General builder',
  'Plumber',
  'Electrician',
  'Carpenter',
  'Painter & decorator',
  'Landscaper',
  'Other',
];

const TRADE_STORAGE_KEY = 'onboarding_trade_role';

function getStoredTradeRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(TRADE_STORAGE_KEY);
    return v && TRADES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function setStoredTradeRole(role: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TRADE_STORAGE_KEY, role);
  } catch {
    // ignore
  }
}

interface TradeStepProps {
  accountId: string;
  currentStep: number;
  stepDef: StepDef;
  nextStep: number;
  canSkip: boolean;
  initialTradeRole?: string | null;
}

export function TradeStep({
  accountId,
  currentStep,
  stepDef,
  nextStep,
  canSkip,
  initialTradeRole,
}: TradeStepProps) {
  const router = useRouter();
  // Use only server-passed value for initial state so server and client first render match (avoids hydration error)
  const [selected, setSelected] = useState<string | null>(
    initialTradeRole ?? null,
  );
  const [loading, setLoading] = useState(false);

  // After mount, apply sessionStorage fallback so choice persists when going back (client-only, no hydration mismatch)
  useEffect(() => {
    const value = initialTradeRole ?? getStoredTradeRole();
    if (value) setSelected(value);
  }, [initialTradeRole]);

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    setStoredTradeRole(selected);
    try {
      const roleResult = await updateMembershipTradeRole(accountId, selected);
      if (roleResult?.error) {
        toast.error(roleResult.error);
        return;
      }
      const stepResult = await updateOnboardingStep(accountId, nextStep);
      if (stepResult?.error) {
        toast.error(stepResult.error);
        return;
      }
      router.push(`/onboarding?account_id=${accountId}&step=${nextStep}`);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!canSkip) return;
    setLoading(true);
    try {
      const stepResult = await updateOnboardingStep(accountId, nextStep);
      if (stepResult?.error) {
        toast.error(stepResult.error);
        return;
      }
      router.push(`/onboarding?account_id=${accountId}&step=${nextStep}`);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {stepDef.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose the option that best describes you.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TRADES.map((trade) => (
          <SelectionCard
            key={trade}
            title={trade}
            selected={selected === trade}
            onSelect={() => setSelected(trade)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canSkip && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-sm text-zinc-400 hover:text-zinc-300"
          >
            Skip for now
          </button>
        )}
        <PrimaryButton
          onClick={handleContinue}
          disabled={!selected || loading}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {loading ? 'Saving…' : 'Continue'}
          <span className="ml-0.5">→</span>
        </PrimaryButton>
      </div>
    </div>
  );
}
