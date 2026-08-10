'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  CancelBookingSchema,
  CheckBookingPageSlugSchema,
  CreateBookingPageSchema,
  CreateEventTypeSchema,
  CreateHostBookingSchema,
  DeleteAvailabilityScheduleSchema,
  DeleteBookingPageSchema,
  DeleteEventTypeSchema,
  GetHostBusyIntervalsSchema,
  ListCreateMeetingOptionsSchema,
  SaveFormFieldsSchema,
  SetDefaultAvailabilityScheduleSchema,
  ToggleBookingPageActiveSchema,
  UpdateBookingPageSchema,
  UpdateEventTypeSchema,
  UpsertAvailabilityScheduleSchema,
  UpsertNotificationSettingsSchema,
} from '../schema/scheduling.schema';
import { createSchedulingService } from './scheduling.service';

function getService() {
  return createSchedulingService(getSupabaseServerClient());
}

function revalidateScheduling(accountSlug?: string) {
  if (!accountSlug) return;
  const base = pathsConfig.app.accountScheduling.replace(
    '[account]',
    accountSlug,
  );
  revalidatePath(base, 'layout');
  revalidatePath(base, 'page');
}

const withAccountSlug = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ accountSlug: z.string().min(1) });

export const checkBookingPageSlugAction = enhanceAction(
  async (input) => {
    const service = getService();
    const available = await service.isSlugAvailable(
      input.slug,
      input.excludePageId,
    );
    return { available };
  },
  { schema: CheckBookingPageSlugSchema },
);

export const createBookingPageAction = enhanceAction(
  async (input, user) => {
    const service = getService();
    const page = await service.createBookingPage(input, user.id);
    revalidateScheduling(input.accountSlug);
    return page;
  },
  { schema: withAccountSlug(CreateBookingPageSchema) },
);

export const updateBookingPageAction = enhanceAction(
  async (input) => {
    const service = getService();
    const { accountSlug, pageId, ...rest } = input;
    const page = await service.updateBookingPage(input.accountId, {
      ...rest,
      pageId,
      accountId: input.accountId,
    });
    revalidateScheduling(accountSlug);
    return page;
  },
  {
    schema: withAccountSlug(
      UpdateBookingPageSchema.extend({ accountId: z.string().uuid() }),
    ),
  },
);

export const toggleBookingPageActiveAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.setBookingPageActive(
      input.accountId,
      input.pageId,
      input.isActive,
    );
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(ToggleBookingPageActiveSchema) },
);

export const deleteBookingPageAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteBookingPage(input.accountId, input.pageId);
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(DeleteBookingPageSchema) },
);

export const createEventTypeAction = enhanceAction(
  async (input) => {
    const service = getService();
    const eventType = await service.createEventType(input);
    revalidateScheduling(input.accountSlug);
    return eventType;
  },
  { schema: withAccountSlug(CreateEventTypeSchema) },
);

export const updateEventTypeAction = enhanceAction(
  async (input) => {
    const service = getService();
    const { accountId, accountSlug, eventTypeId, ...rest } = input;
    const eventType = await service.updateEventType(
      accountId,
      eventTypeId,
      rest,
    );
    revalidateScheduling(accountSlug);
    return eventType;
  },
  {
    schema: withAccountSlug(
      UpdateEventTypeSchema.extend({ accountId: z.string().uuid() }),
    ),
  },
);

export const deleteEventTypeAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteEventType(input.accountId, input.eventTypeId);
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(DeleteEventTypeSchema) },
);

export const upsertAvailabilityScheduleAction = enhanceAction(
  async (input) => {
    const service = getService();
    const schedule = await service.upsertAvailabilitySchedule(input);
    revalidateScheduling(input.accountSlug);
    return schedule;
  },
  { schema: withAccountSlug(UpsertAvailabilityScheduleSchema) },
);

export const deleteAvailabilityScheduleAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteAvailabilitySchedule(input.accountId, input.scheduleId);
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(DeleteAvailabilityScheduleSchema) },
);

export const setDefaultAvailabilityScheduleAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.setDefaultAvailabilitySchedule(
      input.accountId,
      input.scheduleId,
    );
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(SetDefaultAvailabilityScheduleSchema) },
);

export const saveFormFieldsAction = enhanceAction(
  async (input) => {
    const service = getService();
    const fields = await service.saveFormFields(
      input.accountId,
      input.eventTypeId,
      input.fields,
    );
    revalidateScheduling(input.accountSlug);
    return fields;
  },
  { schema: withAccountSlug(SaveFormFieldsSchema) },
);

export const upsertNotificationSettingsAction = enhanceAction(
  async (input) => {
    const service = getService();
    const settings = await service.upsertNotificationSettings(input);
    revalidateScheduling(input.accountSlug);
    return settings;
  },
  { schema: withAccountSlug(UpsertNotificationSettingsSchema) },
);

export const cancelBookingAction = enhanceAction(
  async (input) => {
    const service = getService();
    await service.cancelBooking(
      input.accountId,
      input.bookingId,
      input.cancellationReason,
    );
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  { schema: withAccountSlug(CancelBookingSchema) },
);

export const listCreateMeetingOptionsAction = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listCreateMeetingOptions(input.accountId);
  },
  { schema: ListCreateMeetingOptionsSchema },
);

export const getHostBusyIntervalsAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('id, primary_owner_user_id')
      .eq('slug', input.accountSlug)
      .maybeSingle();

    if (!account?.id || account.id !== input.accountId) {
      throw new Error('Account not found');
    }

    const from = new Date(input.fromIso);
    const to = new Date(input.toIso);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      !(to.getTime() > from.getTime())
    ) {
      throw new Error('Invalid time range');
    }

    const maxMs = 14 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new Error('Busy range is too large (max 14 days)');
    }

    const hostUserId =
      input.hostUserId?.trim() ||
      (account as { primary_owner_user_id?: string | null })
        .primary_owner_user_id ||
      undefined;

    const timeZone = input.timeZone?.trim() || 'UTC';

    type BusyRow = {
      start: string;
      end: string;
      source: 'calendar' | 'booking';
    };

    const intervals: BusyRow[] = [];

    try {
      const { getBusyIntervals } = await import('@kit/scheduling/google');
      const {
        GoogleCalendarNotConnectedError,
        GoogleCalendarReconnectRequiredError,
      } = await import('@kit/scheduling');

      try {
        const busy = await getBusyIntervals(account.id, from, to, {
          hostUserId,
          timeZone,
        });
        for (const interval of busy) {
          intervals.push({
            start: interval.start.toISOString(),
            end: interval.end.toISOString(),
            source: 'calendar',
          });
        }
      } catch (error) {
        if (
          !(error instanceof GoogleCalendarNotConnectedError) &&
          !(error instanceof GoogleCalendarReconnectRequiredError)
        ) {
          console.warn('[scheduling] host busy intervals failed', error);
        }
      }
    } catch (error) {
      console.warn('[scheduling] host busy module load failed', error);
    }

    // Overlay confirmed bookings even when Google is disconnected.
    try {
      const { data: bookingRows, error: bookingError } = await client
        .from('bookings')
        .select('start_at, end_at, status')
        .eq('account_id', account.id)
        .eq('status', 'confirmed')
        .lt('start_at', to.toISOString())
        .gt('end_at', from.toISOString());

      if (bookingError) {
        console.warn(
          '[scheduling] host busy bookings overlay failed',
          bookingError.message,
        );
      } else {
        for (const row of (bookingRows ?? []) as Array<{
          start_at: string;
          end_at: string;
        }>) {
          intervals.push({
            start: row.start_at,
            end: row.end_at,
            source: 'booking',
          });
        }
      }
    } catch (error) {
      console.warn('[scheduling] host busy bookings overlay failed', error);
    }

    intervals.sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    return { intervals };
  },
  { schema: GetHostBusyIntervalsSchema },
);

export const createHostBookingAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('id')
      .eq('slug', input.accountSlug)
      .maybeSingle();

    if (!account?.id || account.id !== input.accountId) {
      throw new Error('Account not found');
    }

    let resolvedClientId: string | null = null;
    if (input.clientId) {
      const { data: clientRow } = await client
        .from('clients')
        .select('id')
        .eq('id', input.clientId)
        .eq('account_id', account.id)
        .maybeSingle();

      if (!clientRow?.id) {
        throw new Error('Client not found');
      }
      resolvedClientId = clientRow.id;
    }

    const { createPublicBooking } =
      await import('~/book/_lib/server/public-booking.service');

    const record = await createPublicBooking(
      {
        pageSlug: input.pageSlug,
        eventSlug: input.eventSlug,
        durationMinutes: input.durationMinutes,
        startAtIso: input.startAtIso,
        inviteeName: input.inviteeName,
        inviteeEmail: input.inviteeEmail,
        inviteeTimezone: input.inviteeTimezone,
        inviteeNotes: input.inviteeNotes ?? null,
        guests: input.guests ?? [],
        formResponses: [],
      },
      {
        skipAvailabilityCheck: true,
        clientId: resolvedClientId,
        notifyInvitee: input.notifyInvitee,
        expectedAccountId: account.id,
        skipFormValidation: true,
        skipGuestInviteRestriction: true,
      },
    );

    revalidateScheduling(input.accountSlug);
    return {
      id: record.id,
      startAt: record.startAt,
      endAt: record.endAt,
      inviteeName: record.inviteeName,
      inviteeEmail: record.inviteeEmail,
      status: record.status,
      conferencingUrl: record.conferencingUrl,
      managementToken: record.managementToken,
    };
  },
  { schema: withAccountSlug(CreateHostBookingSchema) },
);

export const disconnectConferencingAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('id')
      .eq('slug', input.accountSlug)
      .maybeSingle();

    if (!account?.id) {
      throw new Error('Account not found');
    }

    const service = getService();
    await service.disconnectConferencing(account.id, input.provider);
    revalidateScheduling(input.accountSlug);
    return { success: true as const };
  },
  {
    schema: z.object({
      accountSlug: z.string().min(1),
      provider: z.enum(['zoom', 'teams']),
    }),
  },
);

export const listClientUpcomingBookingsAction = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listUpcomingBookingsForClient(
      input.accountId,
      input.clientId,
    );
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid(),
    }),
  },
);
