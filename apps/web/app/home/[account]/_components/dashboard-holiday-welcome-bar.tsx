'use client';

import { useEffect, useState } from 'react';

import { ArrowUpRight, StickyNote, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import {
  clearHolidayWelcomePending,
  findPendingHolidayWelcomeUntil,
} from '~/lib/workspace-focus/holiday-welcome-storage';

type Props = {
  accountId: string;
  accountSlug: string;
};

export function DashboardHolidayWelcomeBar({ accountId, accountSlug }: Props) {
  const [untilKey, setUntilKey] = useState<string | null>(null);

  useEffect(() => {
    setUntilKey(findPendingHolidayWelcomeUntil(accountId));
  }, [accountId]);

  if (!untilKey) {
    return null;
  }

  const welcomeKey = untilKey;

  const notesHref = pathsConfig.app.accountNoteNew.replace(
    '[account]',
    accountSlug,
  );
  const plannerHref = pathsConfig.app.accountPlanner.replace(
    '[account]',
    accountSlug,
  );

  function dismiss() {
    clearHolidayWelcomePending(accountId, welcomeKey);
    setUntilKey(null);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))] px-4 py-3 text-sm text-[var(--workspace-shell-text)]">
      <div className="min-w-0">
        <p className="font-medium">Welcome back</p>
        <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
          Capture ideas from your time away, then get back into the plan.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="ozer-gradient-btn h-8">
          <HapticLink href={notesHref} onClick={dismiss}>
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            New note
          </HapticLink>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8">
          <HapticLink href={plannerHref} onClick={dismiss}>
            Planner
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </HapticLink>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-[var(--workspace-shell-text-muted)]"
          aria-label="Dismiss welcome"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
