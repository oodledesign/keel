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
    accountCount: number;
    emails: string[];
  };
  gmail: {
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
    connectedAt: string | null;
    emailAssistantAllowed: boolean;
  };
  /** Read-only status for the separate business mailbox (managed in workspace Emails). */
  businessGmail: {
    connected: boolean;
    googleEmail: string | null;
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
          .select('user_id, connected_at, google_account_email')
          .eq('user_id', user.id)
          .order('is_primary', { ascending: false })
          .limit(5),
        client
          .from('google_connections')
          .select('google_email, connected_at, mailbox_kind')
          .eq('user_id', user.id),
        canUseEmailAssistant(client, user.id),
      ]);

    const calendarRows = (calendarConnection.data ?? []) as Array<{
      connected_at?: string | null;
      google_account_email?: string | null;
    }>;

    const gmailRows = (gmailConnection.data ?? []) as Array<{
      google_email?: string | null;
      connected_at?: string | null;
      mailbox_kind?: string | null;
    }>;
    const personalGmail = gmailRows.find(
      (row) => row.mailbox_kind === 'personal',
    );
    const businessGmail = gmailRows.find(
      (row) => row.mailbox_kind === 'business',
    );

    return {
      calendar: {
        configured: Boolean(getOptionalGoogleCalendarEnv()),
        connected: calendarRows.length > 0,
        connectedAt: calendarRows[0]?.connected_at ?? null,
        accountCount: calendarRows.length,
        emails: calendarRows
          .map((row) => row.google_account_email?.trim())
          .filter((email): email is string => Boolean(email)),
      },
      gmail: {
        configured: Boolean(getOptionalGoogleAuthEnv()),
        connected: Boolean(personalGmail?.google_email),
        googleEmail: personalGmail?.google_email?.trim() || null,
        connectedAt: personalGmail?.connected_at ?? null,
        emailAssistantAllowed,
      },
      businessGmail: {
        connected: Boolean(businessGmail?.google_email),
        googleEmail: businessGmail?.google_email?.trim() || null,
      },
    };
  },
);
