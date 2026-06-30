'use client';

import { Mail } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { FocusStatusBadge } from '~/home/[account]/settings/focus/_components/FocusStatusBadge';
import { holidayEmoji } from '~/home/[account]/settings/focus/_lib/focus-form';
import { useWorkspaceFocusSnapshot } from '~/lib/hooks/use-workspace-focus';
import {
  computeWorkspaceFocusState,
  type WorkspaceFocusInput,
} from '~/lib/workspace-focus';

import { useWorkspaceFocusSettings } from './workspace-focus-context';

export function getWorkspaceFocusMutedClassName(
  settings: WorkspaceFocusInput | null,
  now = new Date(),
): string {
  if (!settings) {
    return '';
  }

  return computeWorkspaceFocusState(settings, now).isWorkspaceSilenced
    ? 'opacity-50'
    : '';
}

export function WorkspaceFocusSidebarDecorations({
  accountId,
  settings: settingsProp,
  className,
  hideSilencedBadge = false,
}: {
  accountId: string;
  settings?: WorkspaceFocusInput | null;
  className?: string;
  hideSilencedBadge?: boolean;
}) {
  const contextSettings = useWorkspaceFocusSettings(accountId);
  const settings = settingsProp ?? contextSettings;
  const state = useWorkspaceFocusSnapshot(settings);

  if (!settings) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {state.isWorkspaceSilenced && !hideSilencedBadge ? (
        <FocusStatusBadge settings={settings} compact />
      ) : null}

      {state.isHolidayModeActive ? (
        <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
          {holidayEmoji(settings.holiday_mode_label)}{' '}
          {settings.holiday_mode_label}
        </span>
      ) : null}

      {state.isOOOActive &&
      !state.isHolidayModeActive &&
      !state.isWorkspaceSilenced ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-sky-300/90">
          <Mail className="h-3 w-3" aria-hidden />
          OOO
        </span>
      ) : null}
    </div>
  );
}
