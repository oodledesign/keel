import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { runBookingReminderDispatch } from '~/lib/scheduling/run-booking-reminders';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Every 5 minutes: claim due booking_reminders and send invitee/host emails. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await runBookingReminderDispatch(50);
    return jsonOk(result);
  } catch (error) {
    console.error('[cron/booking-reminders]', error);
    return jsonErr(
      'BOOKING_REMINDERS_FAILED',
      error instanceof Error ? error.message : 'Reminder dispatch failed',
      500,
    );
  }
}
