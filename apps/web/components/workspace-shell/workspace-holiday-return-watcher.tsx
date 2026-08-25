'use client';

import { useEffect, useRef } from 'react';

import {
  useWorkspaceFocusSettingsMap,
  useWorkspaceFocusSettingsMutations,
} from '~/components/workspace-shell/workspace-focus-context';
import { autoDisableHolidayMode } from '~/home/[account]/settings/focus/actions';
import { isHolidayUntilExpired } from '~/lib/workspace-focus';
import { markHolidayWelcomePending } from '~/lib/workspace-focus/holiday-welcome-storage';

/**
 * Clears expired holiday mode for any workspace in the shell and flags a
 * once-per-return welcome strip on the business home.
 */
export function WorkspaceHolidayReturnWatcher() {
  const byAccountId = useWorkspaceFocusSettingsMap();
  const { patchSettings } = useWorkspaceFocusSettingsMutations();
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const [accountId, settings] of byAccountId) {
      if (!settings.holiday_mode_enabled) {
        continue;
      }

      const until = settings.holiday_mode_until ?? null;
      if (!isHolidayUntilExpired(until)) {
        continue;
      }

      const attemptKey = `${accountId}:${until ?? 'none'}`;
      if (attempted.current.has(attemptKey)) {
        continue;
      }
      attempted.current.add(attemptKey);

      void autoDisableHolidayMode(accountId)
        .then((result) => {
          if (result.cleared) {
            markHolidayWelcomePending(accountId, until ?? 'none');
            patchSettings(accountId, {
              holiday_mode_enabled: false,
              holiday_mode_until: null,
            });
          } else {
            attempted.current.delete(attemptKey);
          }
        })
        .catch(() => {
          attempted.current.delete(attemptKey);
        });
    }
  }, [byAccountId, patchSettings]);

  return null;
}
