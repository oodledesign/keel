import 'server-only';

import { cache } from 'react';

import { getOptionalGoogleAuthEnv } from '@kit/google-auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import { getOptionalGoogleCalendarEnv } from '~/lib/integrations/google-calendar/env';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export type PersonalIntegrationsData = {
  calendar: {
    configured: boolean;
    connected: boolean;
    connectedAt: string | null;
  };
  gmail: {
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
    connectedAt: string | null;
    emailAssistantAllowed: boolean;
  };
};

export const loadPersonalIntegrationsData = cache(
  async (): Promise<PersonalIntegrationsData> => {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const [calendarConnection, gmailConnection, emailAssistantAllowed] =
      await Promise.all([
        client
          .from('google_calendar_connections')
          .select('user_id, connected_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        client
          .from('google_connections')
          .select('google_email, connected_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        canUseEmailAssistant(client, user.id),
      ]);

    const calendarRow = calendarConnection.data as
      | { connected_at?: string | null }
      | null;

    const gmailRow = gmailConnection.data as
      | { google_email?: string | null; connected_at?: string | null }
      | null;

    return {
      calendar: {
        configured: Boolean(getOptionalGoogleCalendarEnv()),
        connected: Boolean(calendarRow),
        connectedAt: calendarRow?.connected_at ?? null,
      },
      gmail: {
        configured: Boolean(getOptionalGoogleAuthEnv()),
        connected: Boolean(gmailRow?.google_email),
        googleEmail: gmailRow?.google_email?.trim() || null,
        connectedAt: gmailRow?.connected_at ?? null,
        emailAssistantAllowed,
      },
    };
  },
);
