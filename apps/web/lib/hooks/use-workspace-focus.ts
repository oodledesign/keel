'use client';

import { useEffect, useMemo, useState } from 'react';

import { autoDisableHolidayMode } from '~/home/[account]/settings/focus/actions';
import type { WorkspaceFocusSettings } from '~/home/[account]/settings/focus/actions';
import {
  computeWorkspaceFocusState,
  DEFAULT_WORKSPACE_FOCUS_STATE,
  findNextWorkStart,
  type WorkspaceFocusInput,
  type WorkspaceFocusState,
} from '~/lib/workspace-focus';

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
      settings.holiday_mode_until !== null &&
      new Date(settings.holiday_mode_until) <= new Date();

    if (!expired) {
      return;
    }

    setHolidayClearedLocally(true);
    void autoDisableHolidayMode(settings.account_id);
  }, [settings]);

  useEffect(() => {
    setHolidayClearedLocally(false);
  }, [
    settings?.id,
    settings?.holiday_mode_enabled,
    settings?.holiday_mode_until,
  ]);

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
