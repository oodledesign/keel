'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Briefcase, Heart, UsersRound } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  updateOnboardingStep,
  upsertUserSettings,
} from '../../_lib/server/onboarding.actions';
import { PrimaryButton } from '../primary-button';

export interface KeelContextsInitial {
  use_ozer_for_work: boolean;
  use_ozer_for_family: boolean;
  use_ozer_for_community: boolean;
}

interface OzerContextsStepProps {
  accountId: string;
  nextStep: number;
  initial?: KeelContextsInitial;
}

const options = [
  {
    key: 'use_ozer_for_work' as const,
    title: 'Work',
    description:
      'Jobs, clients, quotes, and billing for your trade or business.',
    Icon: Briefcase,
  },
  {
    key: 'use_ozer_for_family' as const,
    title: 'Family',
    description: 'Household planning, shared tasks, and life admin at home.',
    Icon: Heart,
  },
  {
    key: 'use_ozer_for_community' as const,
    title: 'Community groups',
    description: 'Clubs, volunteers, neighbours — organising together.',
    Icon: UsersRound,
  },
];

export function OzerContextsStep({
  accountId,
  nextStep,
  initial,
}: OzerContextsStepProps) {
  const router = useRouter();
  const [work, setWork] = useState(initial?.use_ozer_for_work ?? false);
  const [family, setFamily] = useState(initial?.use_ozer_for_family ?? false);
  const [community, setCommunity] = useState(
    initial?.use_ozer_for_community ?? false,
  );
  const [loading, setLoading] = useState(false);

  const values = {
    use_ozer_for_work: work,
    use_ozer_for_family: family,
    use_ozer_for_community: community,
  };

  const setters = {
    use_ozer_for_work: setWork,
    use_ozer_for_family: setFamily,
    use_ozer_for_community: setCommunity,
  };

  const goNext = async (save: boolean) => {
    setLoading(true);
    if (save) {
      await upsertUserSettings(values);
    }
    await updateOnboardingStep(accountId, nextStep);
    setLoading(false);
    router.push(`/onboarding?account_id=${accountId}&step=${nextStep}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          How do you want to use Ozer?
        </h2>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Not everyone is here for work — pick anything that fits. You can
          change this anytime in Settings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-1">
        {options.map(({ key, title, description, Icon }) => {
          const on = values[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setters[key](!on)}
              className={cn(
                'flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors',
                'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_18px_50px_rgba(4,10,24,0.24)]',
                on
                  ? 'border-[var(--ozer-accent)]/40 ring-1 ring-[var(--ozer-accent)]/30'
                  : 'hover:border-[color:var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-panel)]/90',
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  on
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                    : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[var(--workspace-shell-text)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-sm font-normal text-[var(--workspace-shell-text-muted)]">
                  {description}
                </span>
              </span>
              <span
                className={cn(
                  'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold',
                  on
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[#060C18]'
                    : 'border-[color:var(--workspace-shell-border)] text-transparent',
                )}
                aria-hidden
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={loading}
          onClick={() => goNext(false)}
          className="text-sm font-medium text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:text-[var(--workspace-shell-text-muted)] hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
        <PrimaryButton
          type="button"
          disabled={loading}
          onClick={() => goNext(true)}
        >
          {loading ? 'Saving…' : 'Continue'}
        </PrimaryButton>
      </div>
    </div>
  );
}
