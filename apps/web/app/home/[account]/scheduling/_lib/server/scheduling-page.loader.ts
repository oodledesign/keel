import 'server-only';

import { redirect } from 'next/navigation';

import { getOptionalTeamsOAuthEnv, getOptionalZoomOAuthEnv } from '@kit/scheduling/conferencing';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getGoogleCalendarConnectionStatus } from '~/lib/integrations/google-calendar/connection';
import { getOptionalGoogleCalendarEnv } from '~/lib/integrations/google-calendar/env';
import { listUserGoogleCalendars } from '~/lib/integrations/google-calendar/events';

import { getTeamAccountAccess } from '../../../_lib/role-access';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';

export async function loadSchedulingAccess(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const account = workspace.account as {
    id: string;
    slug: string | null;
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(account);

  if (!access.canViewScheduling) {
    redirect(
      pathsConfig.app.accountHome.replace(
        '[account]',
        account.slug ?? accountSlug,
      ),
    );
  }

  return {
    accountId: account.id,
    accountSlug: account.slug ?? accountSlug,
    user: workspace.user,
    canEditScheduling: access.canEditScheduling,
  };
}

export async function loadGoogleCalendarStatusForScheduling(
  userId: string,
  accountSlug: string,
) {
  const client = getSupabaseServerClient();
  const [status, calendarList] = await Promise.all([
    getGoogleCalendarConnectionStatus(client, userId),
    listUserGoogleCalendars(client, userId),
  ]);
  const returnPath = encodeURIComponent(
    pathsConfig.app.accountSchedulingAccounts.replace('[account]', accountSlug),
  );

  return {
    configured: Boolean(getOptionalGoogleCalendarEnv()) && status.configured,
    connected: status.connected,
    accountCount: status.accountCount,
    connectHref: `/api/integrations/google-calendar/start?returnPath=${returnPath}`,
    accounts: calendarList.connected ? calendarList.accounts : [],
    calendars: calendarList.connected ? calendarList.calendars : [],
  };
}

export function loadConferencingOAuthStatus(accountSlug: string) {
  return {
    zoom: {
      configured: Boolean(getOptionalZoomOAuthEnv()),
      connectHref: `/api/integrations/zoom/start?account=${encodeURIComponent(accountSlug)}`,
    },
    teams: {
      configured: Boolean(getOptionalTeamsOAuthEnv()),
      connectHref: `/api/integrations/teams/start?account=${encodeURIComponent(accountSlug)}`,
    },
  };
}
