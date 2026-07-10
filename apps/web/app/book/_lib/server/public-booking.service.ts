import 'server-only';

import { randomUUID } from 'node:crypto';

import { getBusyIntervals, getGoogleClientForWorkspace } from '@kit/scheduling/google';
import { computeAvailableSlots } from '@kit/scheduling';
import {
  GoogleCalendarNotConnectedError,
  GoogleCalendarReconnectRequiredError,
} from '@kit/scheduling';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type {
  CreatePublicBookingInput,
  FetchSlotsInput,
} from '../schema/public-booking.schema';
import { createGoogleBookingCalendarEvent } from './google-booking-event';
import {
  tryCreateProviderMeeting,
  tryDeleteProviderMeeting,
} from './conferencing-meeting';
import {
  sendBookingCancellationEmails,
  sendBookingConfirmationEmails,
  sendBookingRescheduleEmails,
} from './booking-emails';

// Scheduling tables are not yet in generated Database types — use a loose query builder.
type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: Record<string, unknown>) => LooseQuery;
  delete: () => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  ilike: (column: string, value: string) => LooseQuery;
  in: (column: string, values: unknown[]) => LooseQuery;
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
  single: () => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
} & PromiseLike<{
  data: unknown;
  error: { message: string; code?: string } | null;
}>;

function table(client: unknown, name: string): LooseQuery {
  return (client as { from: (n: string) => LooseQuery }).from(name);
}

function throwIfError(error: { message: string; code?: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export type PublicBookingPage = {
  id: string;
  accountId: string;
  hostUserId: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  brandColour: string | null;
  isActive: boolean;
};

export type PublicEventType = {
  id: string;
  bookingPageId: string;
  name: string;
  slug: string;
  description: string | null;
  durations: number[];
  defaultDuration: number;
  locationType: string;
  locationDetail: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
  maxBookingsPerDay: number | null;
  slotIncrementMinutes: number;
  allowGuestInvites: boolean;
  availabilityScheduleId: string;
  isActive: boolean;
};

export type PublicFormField = {
  id: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
};

export type PublicBookingRecord = {
  id: string;
  accountId: string;
  accountSlug: string;
  eventTypeId: string;
  bookingPageId: string;
  clientId: string | null;
  startAt: string;
  endAt: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  status: string;
  cancellationReason: string | null;
  conferencingUrl: string | null;
  googleEventId: string | null;
  providerMeetingId: string | null;
  needsHostAttention: boolean;
  hostAttentionReason: string | null;
  managementToken: string;
  eventTypeName: string;
  pageTitle: string;
  pageSlug: string;
  eventSlug: string;
  locationType: string;
  locationDetail: string | null;
  brandColour: string | null;
};

function mapPage(row: Record<string, unknown>): PublicBookingPage {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    hostUserId: row.host_user_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    timezone: row.timezone as string,
    brandColour: (row.brand_colour as string | null) ?? null,
    isActive: Boolean(row.is_active),
  };
}

function mapEventType(row: Record<string, unknown>): PublicEventType {
  return {
    id: row.id as string,
    bookingPageId: row.booking_page_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    durations: Array.isArray(row.durations) ? (row.durations as number[]) : [30],
    defaultDuration: Number(row.default_duration ?? 30),
    locationType: String(row.location_type ?? 'google_meet'),
    locationDetail: (row.location_detail as string | null) ?? null,
    bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(row.buffer_after_minutes ?? 0),
    minimumNoticeMinutes: Number(row.minimum_notice_minutes ?? 240),
    bookingWindowDays: Number(row.booking_window_days ?? 60),
    maxBookingsPerDay:
      row.max_bookings_per_day == null ? null : Number(row.max_bookings_per_day),
    slotIncrementMinutes: Number(row.slot_increment_minutes ?? 30),
    allowGuestInvites: row.allow_guest_invites !== false,
    availabilityScheduleId: row.availability_schedule_id as string,
    isActive: row.is_active !== false,
  };
}

export async function loadPublicBookingPage(pageSlug: string) {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'booking_pages')
    .select('*')
    .eq('slug', pageSlug)
    .eq('is_active', true)
    .maybeSingle();

  throwIfError(error, 'Could not load booking page');
  if (!data) return null;

  const page = mapPage(data as Record<string, unknown>);
  const { data: eventRows, error: etError } = await table(client, 'event_types')
    .select('*')
    .eq('booking_page_id', page.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  throwIfError(etError, 'Could not load event types');

  return {
    page,
    eventTypes: ((eventRows ?? []) as Record<string, unknown>[]).map(mapEventType),
  };
}

export async function loadPublicEventType(pageSlug: string, eventSlug: string) {
  const loaded = await loadPublicBookingPage(pageSlug);
  if (!loaded) return null;

  const eventType = loaded.eventTypes.find((et) => et.slug === eventSlug) ?? null;
  if (!eventType) return null;

  const client = getSupabaseServerAdminClient();
  const { data: fields, error } = await table(client, 'booking_form_fields')
    .select('*')
    .eq('event_type_id', eventType.id)
    .order('sort_order', { ascending: true });

  throwIfError(error, 'Could not load form fields');

  const formFields: PublicFormField[] = (
    (fields ?? []) as Record<string, unknown>[]
  ).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    fieldType: row.field_type as string,
    options: Array.isArray(row.options) ? (row.options as string[]) : null,
    isRequired: Boolean(row.is_required),
    sortOrder: Number(row.sort_order ?? 0),
  }));

  return { page: loaded.page, eventType, formFields };
}

async function loadScheduleBundle(scheduleId: string) {
  const client = getSupabaseServerAdminClient();
  const { data: schedule, error } = await table(client, 'availability_schedules')
    .select('*')
    .eq('id', scheduleId)
    .maybeSingle();

  throwIfError(error, 'Could not load availability schedule');
  if (!schedule) {
    throw new Error('Availability schedule not found');
  }

  const [{ data: rules }, { data: overrides }] = await Promise.all([
    table(client, 'availability_rules')
      .select('*')
      .eq('schedule_id', scheduleId),
    table(client, 'availability_overrides')
      .select('*')
      .eq('schedule_id', scheduleId),
  ]);

  return {
    schedule: {
      timezone: (schedule as { timezone: string }).timezone,
    },
    rules: ((rules ?? []) as Record<string, unknown>[]).map((rule) => ({
      dayOfWeek: Number(rule.day_of_week),
      startTime: String(rule.start_time).slice(0, 5),
      endTime: String(rule.end_time).slice(0, 5),
    })),
    overrides: ((overrides ?? []) as Record<string, unknown>[]).map((override) => ({
      date: String(override.date),
      startTime: override.start_time
        ? String(override.start_time).slice(0, 5)
        : null,
      endTime: override.end_time ? String(override.end_time).slice(0, 5) : null,
    })),
  };
}

async function loadExistingBookings(
  eventTypeId: string,
  accountId: string,
  excludeBookingId?: string,
) {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'bookings')
    .select('id, start_at, end_at, status')
    .eq('account_id', accountId)
    .eq('event_type_id', eventTypeId)
    .eq('status', 'confirmed');

  throwIfError(error, 'Could not load existing bookings');

  return (
    (data ?? []) as Array<{
      id: string;
      start_at: string;
      end_at: string;
      status: string;
    }>
  )
    .filter((row) => row.id !== excludeBookingId)
    .map((row) => ({
      start: new Date(row.start_at),
      end: new Date(row.end_at),
      status: 'confirmed' as const,
    }));
}

async function loadBusySafe(
  accountId: string,
  hostUserId: string,
  from: Date,
  to: Date,
) {
  try {
    return await getBusyIntervals(accountId, from, to, {
      hostUserId,
    });
  } catch (error) {
    if (
      error instanceof GoogleCalendarNotConnectedError ||
      error instanceof GoogleCalendarReconnectRequiredError
    ) {
      return [];
    }
    throw error;
  }
}

/**
 * Compute open slots for a public event type.
 * Always uses service-role data + live free/busy; never trusts the client.
 */
export async function fetchPublicAvailableSlots(input: FetchSlotsInput) {
  const loaded = await loadPublicEventType(input.pageSlug, input.eventSlug);
  if (!loaded) {
    throw new Error('Event type not found');
  }

  const { page, eventType } = loaded;
  if (!eventType.durations.includes(input.durationMinutes)) {
    throw new Error('Invalid duration for this event type');
  }

  const rangeStart = new Date(input.rangeStartIso);
  const rangeEnd = new Date(input.rangeEndIso);
  if (!(rangeEnd > rangeStart)) {
    throw new Error('Invalid slot range');
  }

  // Cap range to booking window from now
  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + eventType.bookingWindowDays * 24 * 60 * 60 * 1000,
  );
  const from = rangeStart < now ? now : rangeStart;
  const to = rangeEnd > windowEnd ? windowEnd : rangeEnd;
  if (!(to > from)) {
    return { slots: [] as Array<{ start: string; end: string }>, eventType, page };
  }

  const excludeBookingId = input.excludeManagementToken
    ? (
        await loadBookingByManagementToken(input.excludeManagementToken)
      )?.id
    : undefined;

  const [scheduleBundle, busyIntervals, existingBookings] = await Promise.all([
    loadScheduleBundle(eventType.availabilityScheduleId),
    loadBusySafe(page.accountId, page.hostUserId, from, to),
    loadExistingBookings(eventType.id, page.accountId, excludeBookingId),
  ]);

  const slots = computeAvailableSlots({
    eventType: {
      bufferBeforeMinutes: eventType.bufferBeforeMinutes,
      bufferAfterMinutes: eventType.bufferAfterMinutes,
      minimumNoticeMinutes: eventType.minimumNoticeMinutes,
      bookingWindowDays: eventType.bookingWindowDays,
      maxBookingsPerDay: eventType.maxBookingsPerDay,
      slotIncrementMinutes: eventType.slotIncrementMinutes,
    },
    schedule: scheduleBundle.schedule,
    rules: scheduleBundle.rules,
    overrides: scheduleBundle.overrides,
    busyIntervals,
    existingBookings,
    durationMinutes: input.durationMinutes,
    inviteeTimezone: input.inviteeTimezone,
    now,
  }).filter(
    (slot) =>
      slot.start.getTime() >= from.getTime() &&
      slot.start.getTime() < to.getTime(),
  );

  return {
    page,
    eventType,
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    })),
  };
}

function validateFormResponses(
  fields: PublicFormField[],
  responses: Array<{ formFieldId: string; value?: unknown }>,
) {
  const byId = new Map(responses.map((r) => [r.formFieldId, r.value]));

  for (const field of fields) {
    const value = byId.get(field.id);
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);

    if (field.isRequired && empty) {
      throw new Error(`“${field.label}” is required`);
    }

    if (empty) continue;

    if (field.fieldType === 'checkbox' && typeof value !== 'boolean') {
      throw new Error(`“${field.label}” must be a checkbox answer`);
    }

    if (
      (field.fieldType === 'select' || field.fieldType === 'multiselect') &&
      field.options
    ) {
      const selected = Array.isArray(value) ? value : [value];
      for (const item of selected) {
        if (typeof item !== 'string' || !field.options.includes(item)) {
          throw new Error(`Invalid option for “${field.label}”`);
        }
      }
    }
  }

  for (const response of responses) {
    if (!fields.some((field) => field.id === response.formFieldId)) {
      throw new Error('Unexpected form field in submission');
    }
  }
}

/**
 * Match invitee email to an existing workspace client.
 *
 * TODO(product): auto-create clients from public bookings needs product sign-off.
 * Extension point: replace this lookup with `findOrCreateClientFromBooking(...)`.
 */
async function findClientIdByEmail(
  accountId: string,
  email: string,
): Promise<string | null> {
  const client = getSupabaseServerAdminClient();
  const normalised = email.trim().toLowerCase();

  const { data, error } = await table(client, 'clients')
    .select('id, email')
    .eq('account_id', accountId)
    .ilike('email', normalised)
    .limit(5);

  throwIfError(error, 'Could not look up client');

  const match = ((data ?? []) as Array<{ id: string; email: string | null }>).find(
    (row) => (row.email ?? '').trim().toLowerCase() === normalised,
  );

  return match?.id ?? null;
}

async function getNotificationSettings(accountId: string) {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'booking_notification_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  throwIfError(error, 'Could not load notification settings');

  if (!data) {
    return {
      sendConfirmationToInvitee: true,
      sendConfirmationToHost: true,
      reminderOffsetsMinutes: [1440, 60],
      sendCancellationEmails: true,
      replyToEmail: null as string | null,
    };
  }

  const row = data as Record<string, unknown>;
  return {
    sendConfirmationToInvitee: row.send_confirmation_to_invitee !== false,
    sendConfirmationToHost: row.send_confirmation_to_host !== false,
    reminderOffsetsMinutes: Array.isArray(row.reminder_offsets_minutes)
      ? (row.reminder_offsets_minutes as number[])
      : [1440, 60],
    sendCancellationEmails: row.send_cancellation_emails !== false,
    replyToEmail: (row.reply_to_email as string | null) ?? null,
  };
}

async function enqueueReminders(
  bookingId: string,
  startAt: Date,
  offsets: number[],
  sendToInvitee: boolean,
  sendToHost: boolean,
) {
  const client = getSupabaseServerAdminClient();
  const rows: Array<Record<string, unknown>> = [];

  for (const offset of offsets) {
    const sendAt = new Date(startAt.getTime() - offset * 60_000);
    if (sendAt.getTime() <= Date.now()) continue;

    if (sendToInvitee) {
      rows.push({
        booking_id: bookingId,
        send_at: sendAt.toISOString(),
        recipient: 'invitee',
        status: 'pending',
      });
    }
    if (sendToHost) {
      rows.push({
        booking_id: bookingId,
        send_at: sendAt.toISOString(),
        recipient: 'host',
        status: 'pending',
      });
    }
  }

  if (rows.length === 0) return;

  const { error } = await table(client, 'booking_reminders').insert(rows);
  throwIfError(error, 'Could not enqueue reminders');
}

async function cancelPendingReminders(bookingId: string) {
  const client = getSupabaseServerAdminClient();
  const { error } = await table(client, 'booking_reminders')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .eq('status', 'pending');

  throwIfError(error, 'Could not cancel reminders');
}

async function assertSlotStillAvailable(input: {
  page: PublicBookingPage;
  eventType: PublicEventType;
  durationMinutes: number;
  startAt: Date;
  inviteeTimezone: string;
  excludeBookingId?: string;
}) {
  const endAt = new Date(
    input.startAt.getTime() + input.durationMinutes * 60_000,
  );
  const from = new Date(input.startAt.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  const [scheduleBundle, busyIntervals, existingBookings] = await Promise.all([
    loadScheduleBundle(input.eventType.availabilityScheduleId),
    loadBusySafe(input.page.accountId, input.page.hostUserId, from, to),
    loadExistingBookings(
      input.eventType.id,
      input.page.accountId,
      input.excludeBookingId,
    ),
  ]);

  const slots = computeAvailableSlots({
    eventType: {
      bufferBeforeMinutes: input.eventType.bufferBeforeMinutes,
      bufferAfterMinutes: input.eventType.bufferAfterMinutes,
      minimumNoticeMinutes: input.eventType.minimumNoticeMinutes,
      bookingWindowDays: input.eventType.bookingWindowDays,
      maxBookingsPerDay: input.eventType.maxBookingsPerDay,
      slotIncrementMinutes: input.eventType.slotIncrementMinutes,
    },
    schedule: scheduleBundle.schedule,
    rules: scheduleBundle.rules,
    overrides: scheduleBundle.overrides,
    busyIntervals,
    existingBookings,
    durationMinutes: input.durationMinutes,
    inviteeTimezone: input.inviteeTimezone,
    now: new Date(),
  });

  const ok = slots.some(
    (slot) => slot.start.getTime() === input.startAt.getTime(),
  );

  if (!ok) {
    throw new Error(
      'That time is no longer available. Please choose another slot.',
    );
  }

  return endAt;
}

/**
 * Race-condition strategy:
 * 1. Recompute slots with live free/busy + existing bookings (rejects overlaps).
 * 2. Insert under unique partial index `bookings_no_double_booking_idx`
 *    on (event_type_id, start_at) WHERE status = 'confirmed'. Concurrent
 *    identical starts fail with 23505 — we surface a friendly “slot taken”.
 * Advisory locks were not chosen: the index already exists and is atomic.
 */
export async function createPublicBooking(input: CreatePublicBookingInput) {
  const loaded = await loadPublicEventType(input.pageSlug, input.eventSlug);
  if (!loaded) {
    throw new Error('Event type not found');
  }

  const { page, eventType, formFields } = loaded;

  if (!eventType.durations.includes(input.durationMinutes)) {
    throw new Error('Invalid duration for this event type');
  }

  if (!eventType.allowGuestInvites && input.guests.length > 0) {
    throw new Error('Guest invites are not allowed for this event type');
  }

  validateFormResponses(formFields, input.formResponses);

  const startAt = new Date(input.startAtIso);
  const endAt = await assertSlotStillAvailable({
    page,
    eventType,
    durationMinutes: input.durationMinutes,
    startAt,
    inviteeTimezone: input.inviteeTimezone,
  });

  const clientId = await findClientIdByEmail(
    page.accountId,
    input.inviteeEmail,
  );

  const client = getSupabaseServerAdminClient();
  const managementToken = randomUUID();

  const { data: bookingRow, error: insertError } = await table(client, 'bookings')
    .insert({
      event_type_id: eventType.id,
      booking_page_id: page.id,
      account_id: page.accountId,
      client_id: clientId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      invitee_name: input.inviteeName.trim(),
      invitee_email: input.inviteeEmail.trim().toLowerCase(),
      invitee_timezone: input.inviteeTimezone,
      status: 'confirmed',
      management_token: managementToken,
    })
    .select('*')
    .single();

  if (insertError) {
    if (
      insertError.code === '23505' ||
      /duplicate|unique/i.test(insertError.message)
    ) {
      throw new Error(
        'That time was just booked by someone else. Please choose another slot.',
      );
    }
    throw new Error(insertError.message || 'Could not create booking');
  }

  const booking = bookingRow as Record<string, unknown>;
  const bookingId = booking.id as string;

  if (input.guests.length > 0) {
    const { error: guestError } = await table(client, 'booking_guests').insert(
      input.guests.map((guest) => ({
        booking_id: bookingId,
        name: guest.name ?? null,
        email: guest.email.trim().toLowerCase(),
      })),
    );
    throwIfError(guestError, 'Could not save guests');
  }

  if (input.formResponses.length > 0) {
    const { error: formError } = await table(client, 'booking_form_responses').insert(
      input.formResponses.map((response) => ({
        booking_id: bookingId,
        form_field_id: response.formFieldId,
        value: response.value as object,
      })),
    );
    throwIfError(formError, 'Could not save form responses');
  }

  let googleEventId: string | null = null;
  let conferencingUrl: string | null = null;
  let conferencingProvider: string | null = null;
  let providerMeetingId: string | null = null;
  let needsHostAttention = false;
  let hostAttentionReason: string | null = null;

  const summary = `${eventType.name} with ${input.inviteeName.trim()}`;
  const baseDescription = buildEventDescription({
    eventType,
    inviteeName: input.inviteeName,
    inviteeEmail: input.inviteeEmail,
    formFields,
    formResponses: input.formResponses,
    locationDetail: eventType.locationDetail,
  });

  const providerMeeting = await tryCreateProviderMeeting({
    accountId: page.accountId,
    bookingId,
    locationType: eventType.locationType,
    summary,
    description: baseDescription,
    startAt,
    endAt,
    timezone: input.inviteeTimezone,
    inviteeEmail: input.inviteeEmail,
    inviteeName: input.inviteeName,
    guestEmails: input.guests.map((guest) => guest.email),
  });

  if (providerMeeting?.ok) {
    conferencingUrl = providerMeeting.joinUrl;
    conferencingProvider = providerMeeting.provider;
    providerMeetingId = providerMeeting.providerMeetingId;
  } else if (providerMeeting && !providerMeeting.ok) {
    needsHostAttention = true;
    hostAttentionReason = `Could not create ${providerMeeting.provider} meeting link. ${providerMeeting.reason}`;
  }

  const calendarDescription = [
    baseDescription,
    conferencingUrl
      ? `\nJoin link (${conferencingProvider ?? 'video'}): ${conferencingUrl}`
      : needsHostAttention
        ? '\nNote: A video join link could not be generated automatically. The host will follow up.'
        : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const gcal = await createGoogleBookingCalendarEvent({
      accountId: page.accountId,
      hostUserId: page.hostUserId,
      summary,
      description: calendarDescription,
      startAt,
      endAt,
      inviteeTimezone: input.inviteeTimezone,
      attendees: [
        { email: input.inviteeEmail, name: input.inviteeName },
        ...input.guests.map((guest) => ({
          email: guest.email,
          name: guest.name ?? undefined,
        })),
      ],
      createMeet: eventType.locationType === 'google_meet',
      location: conferencingUrl,
    });

    googleEventId = gcal.eventId;
    if (eventType.locationType === 'google_meet') {
      conferencingUrl = gcal.conferencingUrl;
      conferencingProvider = gcal.conferencingProvider;
    }
  } catch (error) {
    console.error('[public-booking] Google Calendar event failed', error);
  }

  await table(client, 'bookings')
    .update({
      google_event_id: googleEventId,
      conferencing_url: conferencingUrl,
      conferencing_provider: conferencingProvider,
      provider_meeting_id: providerMeetingId,
      needs_host_attention: needsHostAttention,
      host_attention_reason: hostAttentionReason,
    })
    .eq('id', bookingId);

  const settings = await getNotificationSettings(page.accountId);

  try {
    await enqueueReminders(
      bookingId,
      startAt,
      settings.reminderOffsetsMinutes,
      settings.sendConfirmationToInvitee,
      settings.sendConfirmationToHost,
    );
  } catch (error) {
    console.error('[public-booking] reminder enqueue failed', error);
  }

  const record = await loadBookingByManagementToken(managementToken);
  if (!record) {
    throw new Error('Booking created but could not be reloaded');
  }

  // Email must not roll back the booking
  try {
    const [guests, formResponses] = await Promise.all([
      loadBookingGuests(record.id),
      loadBookingFormResponsesForEmail(record.id),
    ]);
    await sendBookingConfirmationEmails({
      booking: record,
      settings,
      hostUserId: page.hostUserId,
      guests,
      formResponses,
    });
  } catch (error) {
    console.error('[public-booking] confirmation email failed', error);
  }

  return record;
}

function buildEventDescription(input: {
  eventType: PublicEventType;
  inviteeName: string;
  inviteeEmail: string;
  formFields: PublicFormField[];
  formResponses: Array<{ formFieldId: string; value?: unknown }>;
  locationDetail: string | null;
}) {
  const lines = [
    `Booked via Ozer Scheduling`,
    `Invitee: ${input.inviteeName} <${input.inviteeEmail}>`,
  ];

  if (input.locationDetail) {
    lines.push(`Location: ${input.locationDetail}`);
  }

  if (input.formResponses.length > 0) {
    lines.push('', 'Form responses:');
    for (const response of input.formResponses) {
      const field = input.formFields.find((f) => f.id === response.formFieldId);
      if (!field) continue;
      const value = Array.isArray(response.value)
        ? response.value.join(', ')
        : String(response.value ?? '');
      lines.push(`- ${field.label}: ${value}`);
    }
  }

  return lines.join('\n');
}

export async function loadBookingByManagementToken(
  managementToken: string,
): Promise<PublicBookingRecord | null> {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'bookings')
    .select(
      '*, event_types(name, slug, location_type, location_detail), booking_pages(title, slug, brand_colour, host_user_id)',
    )
    .eq('management_token', managementToken)
    .maybeSingle();

  throwIfError(error, 'Could not load booking');
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const eventTypes = row.event_types as Record<string, unknown> | null;
  const pages = row.booking_pages as Record<string, unknown> | null;

  const accountId = row.account_id as string;
  let accountSlug = '';
  try {
    const { data: account } = await table(client, 'accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();
    accountSlug = String(
      (account as { slug?: string } | null)?.slug ?? '',
    );
  } catch {
    accountSlug = '';
  }

  return {
    id: row.id as string,
    accountId,
    accountSlug,
    eventTypeId: row.event_type_id as string,
    bookingPageId: row.booking_page_id as string,
    clientId: (row.client_id as string | null) ?? null,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    inviteeName: row.invitee_name as string,
    inviteeEmail: row.invitee_email as string,
    inviteeTimezone: row.invitee_timezone as string,
    status: row.status as string,
    cancellationReason: (row.cancellation_reason as string | null) ?? null,
    conferencingUrl: (row.conferencing_url as string | null) ?? null,
    googleEventId: (row.google_event_id as string | null) ?? null,
    providerMeetingId: (row.provider_meeting_id as string | null) ?? null,
    needsHostAttention: Boolean(row.needs_host_attention),
    hostAttentionReason: (row.host_attention_reason as string | null) ?? null,
    managementToken: row.management_token as string,
    eventTypeName: String(eventTypes?.name ?? 'Meeting'),
    pageTitle: String(pages?.title ?? 'Booking'),
    pageSlug: String(pages?.slug ?? ''),
    eventSlug: String(eventTypes?.slug ?? ''),
    locationType: String(eventTypes?.location_type ?? 'google_meet'),
    locationDetail: (eventTypes?.location_detail as string | null) ?? null,
    brandColour: (pages?.brand_colour as string | null) ?? null,
  };
}

async function loadBookingGuests(bookingId: string) {
  const client = getSupabaseServerAdminClient();
  const { data } = await table(client, 'booking_guests')
    .select('name, email')
    .eq('booking_id', bookingId);

  return ((data ?? []) as Array<{ name: string | null; email: string }>).map(
    (row) => ({
      name: row.name,
      email: row.email,
    }),
  );
}

async function loadBookingFormResponsesForEmail(bookingId: string) {
  const client = getSupabaseServerAdminClient();
  const { data } = await table(client, 'booking_form_responses')
    .select('value, booking_form_fields(label)')
    .eq('booking_id', bookingId);

  return ((data ?? []) as Array<{
    value: unknown;
    booking_form_fields: { label?: string } | { label?: string }[] | null;
  }>).map((row) => {
    const field = Array.isArray(row.booking_form_fields)
      ? row.booking_form_fields[0]
      : row.booking_form_fields;
    const value = Array.isArray(row.value)
      ? row.value.join(', ')
      : String(row.value ?? '');
    return {
      label: field?.label ?? 'Field',
      value,
    };
  });
}

export async function loadEventTypeDurationsForBooking(
  eventTypeId: string,
): Promise<number[]> {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'event_types')
    .select('durations, default_duration')
    .eq('id', eventTypeId)
    .maybeSingle();

  throwIfError(error, 'Could not load event type durations');

  const row = data as {
    durations?: number[];
    default_duration?: number;
  } | null;

  if (Array.isArray(row?.durations) && row.durations.length > 0) {
    return row.durations;
  }

  return [row?.default_duration ?? 30];
}

export async function cancelPublicBooking(input: {
  managementToken: string;
  cancellationReason?: string | null;
}) {
  const booking = await loadBookingByManagementToken(input.managementToken);
  if (!booking) {
    throw new Error('Booking not found');
  }
  if (booking.status !== 'confirmed') {
    throw new Error('This booking is no longer active');
  }

  const client = getSupabaseServerAdminClient();
  const { error } = await table(client, 'bookings')
    .update({
      status: 'cancelled',
      cancellation_reason: input.cancellationReason ?? null,
    })
    .eq('id', booking.id)
    .eq('status', 'confirmed');

  throwIfError(error, 'Could not cancel booking');

  await cancelPendingReminders(booking.id);

  await tryDeleteProviderMeeting({
    accountId: booking.accountId,
    locationType: booking.locationType,
    providerMeetingId: booking.providerMeetingId,
  });

  if (booking.googleEventId) {
    try {
      await deleteGoogleBookingEvent({
        accountId: booking.accountId,
        hostUserId: await resolveHostUserId(booking.bookingPageId),
        eventId: booking.googleEventId,
      });
    } catch (error) {
      console.error('[public-booking] Google cancel failed', error);
    }
  }

  const settings = await getNotificationSettings(booking.accountId);
  const updated = {
    ...booking,
    status: 'cancelled',
    cancellationReason: input.cancellationReason ?? null,
  };

  try {
    const guests = await loadBookingGuests(booking.id);
    await sendBookingCancellationEmails({
      booking: updated,
      settings,
      hostUserId: await resolveHostUserId(booking.bookingPageId),
      guests,
    });
  } catch (error) {
    console.error('[public-booking] cancellation email failed', error);
  }

  return updated;
}

async function resolveHostUserId(bookingPageId: string) {
  const client = getSupabaseServerAdminClient();
  const { data, error } = await table(client, 'booking_pages')
    .select('host_user_id')
    .eq('id', bookingPageId)
    .maybeSingle();

  throwIfError(error, 'Could not resolve host');
  return (data as { host_user_id: string } | null)?.host_user_id ?? '';
}

export async function reschedulePublicBooking(input: {
  managementToken: string;
  durationMinutes: number;
  startAtIso: string;
  inviteeTimezone: string;
}) {
  const existing = await loadBookingByManagementToken(input.managementToken);
  if (!existing) {
    throw new Error('Booking not found');
  }
  if (existing.status !== 'confirmed') {
    throw new Error('Only confirmed bookings can be rescheduled');
  }

  const loaded = await loadPublicEventType(existing.pageSlug, existing.eventSlug);
  if (!loaded) {
    throw new Error('Event type not found');
  }

  const { page, eventType, formFields } = loaded;
  if (!eventType.durations.includes(input.durationMinutes)) {
    throw new Error('Invalid duration for this event type');
  }

  const startAt = new Date(input.startAtIso);
  const endAt = await assertSlotStillAvailable({
    page,
    eventType,
    durationMinutes: input.durationMinutes,
    startAt,
    inviteeTimezone: input.inviteeTimezone,
    excludeBookingId: existing.id,
  });

  const clientId = await findClientIdByEmail(
    page.accountId,
    existing.inviteeEmail,
  );

  const client = getSupabaseServerAdminClient();
  const managementToken = randomUUID();

  const { data: newRow, error: insertError } = await table(client, 'bookings')
    .insert({
      event_type_id: eventType.id,
      booking_page_id: page.id,
      account_id: page.accountId,
      client_id: clientId,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      invitee_name: existing.inviteeName,
      invitee_email: existing.inviteeEmail,
      invitee_timezone: input.inviteeTimezone,
      status: 'confirmed',
      reschedule_of: existing.id,
      management_token: managementToken,
    })
    .select('*')
    .single();

  if (insertError) {
    if (
      insertError.code === '23505' ||
      /duplicate|unique/i.test(insertError.message)
    ) {
      throw new Error(
        'That time was just booked by someone else. Please choose another slot.',
      );
    }
    throw new Error(insertError.message || 'Could not reschedule booking');
  }

  const newBookingId = (newRow as { id: string }).id;

  await table(client, 'bookings')
    .update({ status: 'rescheduled' })
    .eq('id', existing.id);

  await cancelPendingReminders(existing.id);

  // Copy guests + form responses from the previous booking
  const { data: oldGuestsRaw } = await table(client, 'booking_guests')
    .select('name, email')
    .eq('booking_id', existing.id);

  const oldGuests = (oldGuestsRaw ?? []) as Array<{
    name: string | null;
    email: string;
  }>;

  if (oldGuests.length > 0) {
    await table(client, 'booking_guests').insert(
      oldGuests.map((guest) => ({
        booking_id: newBookingId,
        name: guest.name,
        email: guest.email,
      })),
    );
  }

  const { data: oldResponsesRaw } = await table(client, 'booking_form_responses')
    .select('form_field_id, value')
    .eq('booking_id', existing.id);

  const oldResponses = (oldResponsesRaw ?? []) as Array<{
    form_field_id: string;
    value: unknown;
  }>;

  if (oldResponses.length > 0) {
    await table(client, 'booking_form_responses').insert(
      oldResponses.map((row) => ({
        booking_id: newBookingId,
        form_field_id: row.form_field_id,
        value: row.value as object,
      })),
    );
  }

  let googleEventId: string | null = null;
  let conferencingUrl: string | null = null;
  let conferencingProvider: string | null = null;
  let providerMeetingId: string | null = null;
  let needsHostAttention = false;
  let hostAttentionReason: string | null = null;

  await tryDeleteProviderMeeting({
    accountId: page.accountId,
    locationType: existing.locationType,
    providerMeetingId: existing.providerMeetingId,
  });

  if (existing.googleEventId) {
    try {
      await deleteGoogleBookingEvent({
        accountId: page.accountId,
        hostUserId: page.hostUserId,
        eventId: existing.googleEventId,
      });
    } catch (error) {
      console.error('[public-booking] Google delete on reschedule failed', error);
    }
  }

  const summary = `${eventType.name} with ${existing.inviteeName}`;
  const baseDescription = buildEventDescription({
    eventType,
    inviteeName: existing.inviteeName,
    inviteeEmail: existing.inviteeEmail,
    formFields,
    formResponses: oldResponses.map((row) => ({
      formFieldId: row.form_field_id,
      value: row.value,
    })),
    locationDetail: eventType.locationDetail,
  });

  const providerMeeting = await tryCreateProviderMeeting({
    accountId: page.accountId,
    bookingId: newBookingId,
    locationType: eventType.locationType,
    summary,
    description: baseDescription,
    startAt,
    endAt,
    timezone: input.inviteeTimezone,
    inviteeEmail: existing.inviteeEmail,
    inviteeName: existing.inviteeName,
    guestEmails: oldGuests.map((guest) => guest.email),
  });

  if (providerMeeting?.ok) {
    conferencingUrl = providerMeeting.joinUrl;
    conferencingProvider = providerMeeting.provider;
    providerMeetingId = providerMeeting.providerMeetingId;
  } else if (providerMeeting && !providerMeeting.ok) {
    needsHostAttention = true;
    hostAttentionReason = `Could not create ${providerMeeting.provider} meeting link. ${providerMeeting.reason}`;
  }

  const calendarDescription = [
    baseDescription,
    conferencingUrl
      ? `\nJoin link (${conferencingProvider ?? 'video'}): ${conferencingUrl}`
      : needsHostAttention
        ? '\nNote: A video join link could not be generated automatically. The host will follow up.'
        : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const gcal = await createGoogleBookingCalendarEvent({
      accountId: page.accountId,
      hostUserId: page.hostUserId,
      summary,
      description: calendarDescription,
      startAt,
      endAt,
      inviteeTimezone: input.inviteeTimezone,
      attendees: [
        { email: existing.inviteeEmail, name: existing.inviteeName },
        ...oldGuests.map((guest) => ({
          email: guest.email,
          name: guest.name ?? undefined,
        })),
      ],
      createMeet: eventType.locationType === 'google_meet',
      location: conferencingUrl,
    });

    googleEventId = gcal.eventId;
    if (eventType.locationType === 'google_meet') {
      conferencingUrl = gcal.conferencingUrl;
      conferencingProvider = gcal.conferencingProvider;
    }
  } catch (error) {
    console.error('[public-booking] Google reschedule failed', error);
  }

  await table(client, 'bookings')
    .update({
      google_event_id: googleEventId,
      conferencing_url: conferencingUrl,
      conferencing_provider: conferencingProvider,
      provider_meeting_id: providerMeetingId,
      needs_host_attention: needsHostAttention,
      host_attention_reason: hostAttentionReason,
    })
    .eq('id', newBookingId);

  const settings = await getNotificationSettings(page.accountId);

  try {
    await enqueueReminders(
      newBookingId,
      startAt,
      settings.reminderOffsetsMinutes,
      settings.sendConfirmationToInvitee,
      settings.sendConfirmationToHost,
    );
  } catch (error) {
    console.error('[public-booking] reminder enqueue failed', error);
  }

  const record = await loadBookingByManagementToken(managementToken);
  if (!record) {
    throw new Error('Rescheduled booking could not be reloaded');
  }

  try {
    const guests = await loadBookingGuests(record.id);
    await sendBookingRescheduleEmails({
      previous: existing,
      booking: record,
      settings,
      hostUserId: page.hostUserId,
      guests,
    });
  } catch (error) {
    console.error('[public-booking] reschedule email failed', error);
  }

  return record;
}

async function deleteGoogleBookingEvent(input: {
  accountId: string;
  hostUserId: string;
  eventId: string;
}) {
  const google = await getGoogleClientForWorkspace(input.accountId, {
    hostUserId: input.hostUserId,
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(google.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${google.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(
      `Google event delete failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  }
}
