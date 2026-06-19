import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getGoogleCalendarConnectionStatus } from '~/lib/integrations/google-calendar/connection';
import { getOptionalGoogleCalendarEnv } from '~/lib/integrations/google-calendar/env';
import { listUserGoogleCalendars } from '~/lib/integrations/google-calendar/events';
import {
  loadAccountTaskAutomationSettings,
  type AccountTaskAutomationSettings,
} from '~/lib/recorder/task-automation-settings';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type TaskAutomationSettingsPageData = {
  accountId: string;
  accountSlug: string;
  settings: AccountTaskAutomationSettings;
  calendar: {
    configured: boolean;
    connected: boolean;
    calendars: Array<{
      id: string;
      summary: string;
      primary: boolean;
      selected: boolean;
    }>;
    busyCalendarIds: string[];
    personalCalendarIds: string[];
    connectHref: string;
  };
};

export async function loadTaskAutomationSettingsPageData(
  accountSlug: string,
): Promise<TaskAutomationSettingsPageData> {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();

  const [settings, calendarStatus, calendarList] = await Promise.all([
    loadAccountTaskAutomationSettings(client, accountId),
    getGoogleCalendarConnectionStatus(client, user.id),
    listUserGoogleCalendars(client, user.id),
  ]);

  const settingsReturnPath = encodeURIComponent(
    `/app/${accountSlug}/settings/task-automation`,
  );

  return {
    accountId,
    accountSlug,
    settings,
    calendar: {
      configured: Boolean(getOptionalGoogleCalendarEnv()),
      connected: calendarStatus.connected,
      calendars: calendarList.connected ? calendarList.calendars : [],
      busyCalendarIds: calendarList.connected ? calendarList.busyCalendarIds : [],
      personalCalendarIds: calendarList.connected
        ? calendarList.personalCalendarIds
        : [],
      connectHref: `/api/integrations/google-calendar/start?returnPath=${settingsReturnPath}`,
    },
  };
}
