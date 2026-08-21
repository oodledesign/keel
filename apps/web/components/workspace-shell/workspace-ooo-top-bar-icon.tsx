'use client';

import { useEffect, useMemo, useState } from 'react';

import { Plane } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { holidayEmoji } from '~/home/[account]/settings/focus/_lib/focus-form';
import { useWorkspaceFocusSnapshot } from '~/lib/hooks/use-workspace-focus';
import { computeWorkspaceFocusState } from '~/lib/workspace-focus';

import {
  useWorkspaceFocusSettings,
  useWorkspaceFocusSettingsMap,
} from './workspace-focus-context';
import { useOptionalWorkspaceOooDialog } from './workspace-ooo-dialog-context';

type WorkspaceOooTopBarIconProps = {
  accountId?: string | null;
  className?: string;
};

export function WorkspaceOooTopBarIcon({
  accountId,
  className,
}: WorkspaceOooTopBarIconProps) {
  const oooDialog = useOptionalWorkspaceOooDialog();
  const scopedSettings = useWorkspaceFocusSettings(accountId);
  const settingsMap = useWorkspaceFocusSettingsMap();
  const scopedState = useWorkspaceFocusSnapshot(scopedSettings);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const activeAcrossWorkspaces = useMemo(() => {
    for (const [id, settings] of settingsMap) {
      const state = computeWorkspaceFocusState(settings, now);
      if (state.isHolidayModeActive || state.isOOOActive) {
        return { accountId: id, settings, state };
      }
    }

    return null;
  }, [now, settingsMap]);

  const active = scopedSettings
    ? scopedState.isHolidayModeActive || scopedState.isOOOActive
      ? {
          accountId: accountId ?? null,
          settings: scopedSettings,
          state: scopedState,
        }
      : null
    : activeAcrossWorkspaces;

  if (!oooDialog || !active) {
    return null;
  }

  const label = active.state.isHolidayModeActive
    ? active.settings.holiday_mode_label
    : active.state.currentStatusLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Out of office — ${label}`}
          className={cn(
            'relative h-8 w-8 rounded-md text-amber-800 hover:bg-amber-500/15 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-100',
            className,
          )}
          onClick={() => oooDialog.openOooDialog(active.accountId)}
        >
          {active.state.isHolidayModeActive ? (
            <span className="text-sm leading-none" aria-hidden>
              {holidayEmoji(active.settings.holiday_mode_label)}
            </span>
          ) : (
            <Plane className="h-4 w-4" aria-hidden />
          )}
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--ozer-accent)]" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {active.state.isHolidayModeActive
          ? `${label} — manage out of office`
          : 'Out of office on — manage'}
      </TooltipContent>
    </Tooltip>
  );
}
