import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  sendBookingReminderEmail,
  type NotificationSettings,
} from '../../app/book/_lib/server/booking-emails';
import { loadBookingByManagementToken } from '../../app/book/_lib/server/public-booking.service';

type ClaimedReminder = {
  id: string;
  booking_id: string;
  recipient: 'invitee' | 'host';
  status: string;
};

type LooseRpc = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function table(client: unknown, name: string) {
  return (
    client as {
      from: (n: string) => {
        select: (columns: string) => {
          eq: (column: string, value: unknown) => {
            maybeSingle: () => Promise<{
              data: unknown;
              error: { message: string } | null;
            }>;
          };
        };
        update: (values: Record<string, unknown>) => {
          eq: (
            column: string,
            value: unknown,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  ).from(name);
}

async function loadSettings(accountId: string): Promise<NotificationSettings> {
  const client = getSupabaseServerAdminClient();
  const { data } = await table(client, 'booking_notification_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (!data) {
    return {
      sendConfirmationToInvitee: true,
      sendConfirmationToHost: true,
      sendCancellationEmails: true,
      replyToEmail: null,
    };
  }

  const row = data as Record<string, unknown>;
  return {
    sendConfirmationToInvitee: row.send_confirmation_to_invitee !== false,
    sendConfirmationToHost: row.send_confirmation_to_host !== false,
    sendCancellationEmails: row.send_cancellation_emails !== false,
    replyToEmail: (row.reply_to_email as string | null) ?? null,
  };
}

async function markReminder(
  reminderId: string,
  status: 'sent' | 'failed' | 'cancelled',
) {
  const client = getSupabaseServerAdminClient();
  await table(client, 'booking_reminders')
    .update({
      status,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .eq('id', reminderId);
}

export async function runBookingReminderDispatch(limit = 50) {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await (client as unknown as LooseRpc).rpc(
    'claim_due_booking_reminders',
    { p_limit: limit },
  );

  if (error) {
    throw new Error(error.message);
  }

  const claimed = (data ?? []) as ClaimedReminder[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of claimed) {
    try {
      const { data: bookingRow, error: bookingError } = await table(
        client,
        'bookings',
      )
        .select('management_token, status, booking_pages(host_user_id)')
        .eq('id', reminder.booking_id)
        .maybeSingle();

      if (bookingError || !bookingRow) {
        await markReminder(reminder.id, 'failed');
        failed += 1;
        continue;
      }

      const row = bookingRow as {
        management_token: string;
        status: string;
        booking_pages:
          | { host_user_id?: string }
          | { host_user_id?: string }[]
          | null;
      };

      if (row.status !== 'confirmed') {
        await markReminder(reminder.id, 'cancelled');
        skipped += 1;
        continue;
      }

      const booking = await loadBookingByManagementToken(row.management_token);
      if (!booking || booking.status !== 'confirmed') {
        await markReminder(reminder.id, 'cancelled');
        skipped += 1;
        continue;
      }

      const pages = Array.isArray(row.booking_pages)
        ? row.booking_pages[0]
        : row.booking_pages;
      const hostUserId = pages?.host_user_id ?? '';
      const settings = await loadSettings(booking.accountId);

      await sendBookingReminderEmail({
        booking,
        recipient: reminder.recipient,
        hostUserId,
        settings,
      });

      await markReminder(reminder.id, 'sent');
      sent += 1;
    } catch (err) {
      console.error('[booking-reminders] send failed', {
        reminderId: reminder.id,
        error: err instanceof Error ? err.message : String(err),
      });
      await markReminder(reminder.id, 'failed');
      failed += 1;
    }
  }

  return {
    claimed: claimed.length,
    sent,
    failed,
    skipped,
  };
}
