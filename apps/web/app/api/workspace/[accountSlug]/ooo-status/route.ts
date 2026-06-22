import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { computeWorkspaceFocusState } from '~/lib/workspace-focus';
import { loadWorkspaceFocusSettingsForAccount } from '~/lib/workspace-focus/load-workspace-focus-settings';

export const runtime = 'nodejs';

export const GET = enhanceRouteHandler(
  async ({ params, user }) => {
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountSlug = params.accountSlug;

    if (!accountSlug || typeof accountSlug !== 'string') {
      return Response.json({ error: 'Invalid account slug' }, { status: 400 });
    }

    const workspace = await loadTeamWorkspace(accountSlug);

    if (!workspace) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const client = getSupabaseServerClient();
    const focusSettings = await loadWorkspaceFocusSettingsForAccount(
      client,
      user.id,
      workspace.account.id,
    );

    const state = computeWorkspaceFocusState(focusSettings, new Date());

    return Response.json({
      isOOOActive: state.isOOOActive,
      effectiveMessage: state.effectiveOOOMessage,
      holidayModeActive: state.isHolidayModeActive,
      holidayLabel: focusSettings?.holiday_mode_enabled
        ? focusSettings.holiday_mode_label
        : null,
      returnDate: focusSettings?.holiday_mode_until ?? null,
      senderName: focusSettings?.ooo_sender_name ?? null,
      ccEmail: focusSettings?.ooo_cc_email ?? null,
    });
  },
  { auth: true },
);
