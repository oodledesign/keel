'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { WorkspaceFocusSettings } from '~/home/[account]/settings/focus/_lib/focus-settings.schema';
import { autoDisableHolidayMode } from '~/home/[account]/settings/focus/actions';
import {
  DEFAULT_WORKSPACE_FOCUS_STATE,
  type WorkspaceFocusInput,
  type WorkspaceFocusState,
  computeWorkspaceFocusState,
  findNextWorkStart,
  isHolidayUntilExpired,
} from '~/lib/workspace-focus';
import { markHolidayWelcomePending } from '~/lib/workspace-focus/holiday-welcome-storage';

export type { WorkspaceFocusState } from '~/lib/workspace-focus';

export function useWorkspaceFocusSnapshot(
  settings: WorkspaceFocusInput | null,
): WorkspaceFocusState {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return useMemo(
    () => computeWorkspaceFocusState(settings, now),
    [settings, now],
  );
}

export default function useWorkspaceFocus(
  settings: WorkspaceFocusSettings | null,
): WorkspaceFocusState {
  const [now, setNow] = useState(() => new Date());
  const [holidayClearedLocally, setHolidayClearedLocally] = useState(false);
  const disableAttemptKey = useRef<string | null>(null);

  const memoizedNextWorkStart = useMemo(() => {
    if (!settings) {
      return null;
    }

    return findNextWorkStart(settings, new Date());
  }, [settings]);

  useEffect(() => {
    if (!settings) {
      return;
    }

    const expired =
      settings.holiday_mode_enabled &&
      isHolidayUntilExpired(settings.holiday_mode_until);

    if (!expired) {
      disableAttemptKey.current = null;
      setHolidayClearedLocally(false);
      return;
    }

    const attemptKey = `${settings.account_id}:${settings.holiday_mode_until ?? 'none'}`;
    if (disableAttemptKey.current === attemptKey) {
      return;
    }

    disableAttemptKey.current = attemptKey;
    setHolidayClearedLocally(true);

    void autoDisableHolidayMode(settings.account_id).then((result) => {
      if (!result.cleared || !result.gmailSynced) {
        // Allow a retry on the next settings refresh / remount.
        disableAttemptKey.current = null;
      }
      if (result.cleared) {
        markHolidayWelcomePending(
          settings.account_id,
          settings.holiday_mode_until ?? 'none',
        );
      }
    });
  }, [settings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  if (!settings) {
    return DEFAULT_WORKSPACE_FOCUS_STATE;
  }

  return computeWorkspaceFocusState(settings, now, {
    holidayClearedLocally,
    nextWorkStart: memoizedNextWorkStart,
  });
}
