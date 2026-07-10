import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AvailabilityOverrideInputSchema,
  AvailabilityRuleInputSchema,
  CreateBookingPageSchema,
  CreateEventTypeSchema,
  FormFieldInputSchema,
  LocationType,
  UpsertAvailabilityScheduleSchema,
  UpsertNotificationSettingsSchema,
} from '../schema/scheduling.schema';
import type { z } from 'zod';

type AnyClient = SupabaseClient;

function table(client: AnyClient, name: string) {
  return (client as unknown as { from: (n: string) => ReturnType<AnyClient['from']> }).from(
    name,
  );
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export type BookingPageRow = {
  id: string;
  accountId: string;
  hostUserId: string;
  slug: string;
  title: string;
  description: string | null;
  timezone: string;
  isActive: boolean;
  brandColour: string | null;
  createdAt: string;
  updatedAt: string;
  eventTypeCount: number;
};

export type EventTypeRow = {
  id: string;
  bookingPageId: string;
  name: string;
  slug: string;
  description: string | null;
  durations: number[];
  defaultDuration: number;
  locationType: LocationType;
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
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityScheduleRow = {
  id: string;
  accountId: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  rules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  overrides: Array<{
    id: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
  }>;
};

export type FormFieldRow = {
  id: string;
  eventTypeId: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
};

export type NotificationSettingsRow = {
  accountId: string;
  sendConfirmationToInvitee: boolean;
  sendConfirmationToHost: boolean;
  reminderOffsetsMinutes: number[];
  sendCancellationEmails: boolean;
  replyToEmail: string | null;
};

export type BookingListRow = {
  id: string;
  startAt: string;
  endAt: string;
  inviteeName: string;
  inviteeEmail: string;
  status: string;
  conferencingUrl: string | null;
  needsHostAttention: boolean;
  hostAttentionReason: string | null;
  cancellationReason: string | null;
  eventTypeName: string | null;
  bookingPageTitle: string | null;
};

export type ConferencingConnectionRow = {
  id: string;
  provider: 'zoom' | 'teams';
  providerAccountEmail: string | null;
};

function mapBookingPage(
  row: Record<string, unknown>,
  eventTypeCount = 0,
): BookingPageRow {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    hostUserId: row.host_user_id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    timezone: row.timezone as string,
    isActive: Boolean(row.is_active),
    brandColour: (row.brand_colour as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    eventTypeCount,
  };
}

function mapEventType(row: Record<string, unknown>): EventTypeRow {
  return {
    id: row.id as string,
    bookingPageId: row.booking_page_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    durations: Array.isArray(row.durations)
      ? (row.durations as number[])
      : [30],
    defaultDuration: Number(row.default_duration ?? 30),
    locationType: (row.location_type as LocationType) ?? 'google_meet',
    locationDetail: (row.location_detail as string | null) ?? null,
    bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(row.buffer_after_minutes ?? 0),
    minimumNoticeMinutes: Number(row.minimum_notice_minutes ?? 240),
    bookingWindowDays: Number(row.booking_window_days ?? 60),
    maxBookingsPerDay:
      row.max_bookings_per_day === null || row.max_bookings_per_day === undefined
        ? null
        : Number(row.max_bookings_per_day),
    slotIncrementMinutes: Number(row.slot_increment_minutes ?? 30),
    allowGuestInvites: row.allow_guest_invites !== false,
    availabilityScheduleId: row.availability_schedule_id as string,
    isActive: row.is_active !== false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createSchedulingService(client: AnyClient) {
  return {
    async listBookingPages(accountId: string): Promise<BookingPageRow[]> {
      const { data, error } = await table(client, 'booking_pages')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      throwIfError(error, 'Could not load booking pages');

      const pages = (data ?? []) as Record<string, unknown>[];
      if (pages.length === 0) return [];

      const ids = pages.map((p) => p.id as string);
      const { data: eventTypes } = await table(client, 'event_types')
        .select('id, booking_page_id')
        .in('booking_page_id', ids);

      const counts = new Map<string, number>();
      for (const et of (eventTypes ?? []) as Array<{ booking_page_id: string }>) {
        counts.set(
          et.booking_page_id,
          (counts.get(et.booking_page_id) ?? 0) + 1,
        );
      }

      return pages.map((row) =>
        mapBookingPage(row, counts.get(row.id as string) ?? 0),
      );
    },

    async getBookingPage(
      accountId: string,
      pageId: string,
    ): Promise<BookingPageRow | null> {
      const { data, error } = await table(client, 'booking_pages')
        .select('*')
        .eq('account_id', accountId)
        .eq('id', pageId)
        .maybeSingle();

      throwIfError(error, 'Could not load booking page');
      if (!data) return null;
      return mapBookingPage(data as Record<string, unknown>);
    },

    async isSlugAvailable(
      slug: string,
      excludePageId?: string,
    ): Promise<boolean> {
      let query = table(client, 'booking_pages')
        .select('id')
        .eq('slug', slug)
        .limit(1);

      if (excludePageId) {
        query = query.neq('id', excludePageId);
      }

      const { data, error } = await query;
      throwIfError(error, 'Could not check slug');
      return !data || data.length === 0;
    },

    async createBookingPage(
      input: z.infer<typeof CreateBookingPageSchema>,
      hostUserId: string,
    ): Promise<BookingPageRow> {
      const available = await this.isSlugAvailable(input.slug);
      if (!available) {
        throw new Error('That slug is already taken');
      }

      const { data, error } = await table(client, 'booking_pages')
        .insert({
          account_id: input.accountId,
          host_user_id: hostUserId,
          title: input.title,
          description: input.description ?? null,
          slug: input.slug,
          timezone: input.timezone,
          brand_colour: input.brandColour ?? null,
          is_active: input.isActive,
        })
        .select('*')
        .single();

      throwIfError(error, 'Could not create booking page');
      return mapBookingPage(data as Record<string, unknown>);
    },

    async updateBookingPage(
      accountId: string,
      input: z.infer<typeof CreateBookingPageSchema> & { pageId: string },
    ): Promise<BookingPageRow> {
      const available = await this.isSlugAvailable(input.slug, input.pageId);
      if (!available) {
        throw new Error('That slug is already taken');
      }

      const { data, error } = await table(client, 'booking_pages')
        .update({
          title: input.title,
          description: input.description ?? null,
          slug: input.slug,
          timezone: input.timezone,
          brand_colour: input.brandColour ?? null,
          is_active: input.isActive,
        })
        .eq('account_id', accountId)
        .eq('id', input.pageId)
        .select('*')
        .single();

      throwIfError(error, 'Could not update booking page');
      return mapBookingPage(data as Record<string, unknown>);
    },

    async setBookingPageActive(
      accountId: string,
      pageId: string,
      isActive: boolean,
    ) {
      const { error } = await table(client, 'booking_pages')
        .update({ is_active: isActive })
        .eq('account_id', accountId)
        .eq('id', pageId);

      throwIfError(error, 'Could not update booking page');
    },

    async deleteBookingPage(accountId: string, pageId: string) {
      const { error } = await table(client, 'booking_pages')
        .delete()
        .eq('account_id', accountId)
        .eq('id', pageId);

      throwIfError(error, 'Could not delete booking page');
    },

    async listEventTypes(bookingPageId: string): Promise<EventTypeRow[]> {
      const { data, error } = await table(client, 'event_types')
        .select('*')
        .eq('booking_page_id', bookingPageId)
        .order('created_at', { ascending: true });

      throwIfError(error, 'Could not load event types');
      return ((data ?? []) as Record<string, unknown>[]).map(mapEventType);
    },

    async createEventType(
      input: z.infer<typeof CreateEventTypeSchema>,
    ): Promise<EventTypeRow> {
      if (!input.durations.includes(input.defaultDuration)) {
        throw new Error('Default duration must be one of the durations list');
      }

      const { data, error } = await table(client, 'event_types')
        .insert({
          booking_page_id: input.bookingPageId,
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          durations: input.durations,
          default_duration: input.defaultDuration,
          location_type: input.locationType,
          location_detail: input.locationDetail ?? null,
          buffer_before_minutes: input.bufferBeforeMinutes,
          buffer_after_minutes: input.bufferAfterMinutes,
          minimum_notice_minutes: input.minimumNoticeMinutes,
          booking_window_days: input.bookingWindowDays,
          max_bookings_per_day: input.maxBookingsPerDay ?? null,
          slot_increment_minutes: input.slotIncrementMinutes,
          allow_guest_invites: input.allowGuestInvites,
          availability_schedule_id: input.availabilityScheduleId,
          is_active: input.isActive,
        })
        .select('*')
        .single();

      throwIfError(error, 'Could not create event type');
      return mapEventType(data as Record<string, unknown>);
    },

    async updateEventType(
      accountId: string,
      eventTypeId: string,
      input: Omit<
        z.infer<typeof CreateEventTypeSchema>,
        'accountId' | 'bookingPageId'
      >,
    ): Promise<EventTypeRow> {
      if (!input.durations.includes(input.defaultDuration)) {
        throw new Error('Default duration must be one of the durations list');
      }

      // Ensure the event type belongs to this workspace via booking page
      const { data: existing, error: findError } = await table(
        client,
        'event_types',
      )
        .select('id, booking_pages!inner(account_id)')
        .eq('id', eventTypeId)
        .eq('booking_pages.account_id', accountId)
        .maybeSingle();

      throwIfError(findError, 'Could not find event type');
      if (!existing) {
        throw new Error('Event type not found');
      }

      const { data, error } = await table(client, 'event_types')
        .update({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          durations: input.durations,
          default_duration: input.defaultDuration,
          location_type: input.locationType,
          location_detail: input.locationDetail ?? null,
          buffer_before_minutes: input.bufferBeforeMinutes,
          buffer_after_minutes: input.bufferAfterMinutes,
          minimum_notice_minutes: input.minimumNoticeMinutes,
          booking_window_days: input.bookingWindowDays,
          max_bookings_per_day: input.maxBookingsPerDay ?? null,
          slot_increment_minutes: input.slotIncrementMinutes,
          allow_guest_invites: input.allowGuestInvites,
          availability_schedule_id: input.availabilityScheduleId,
          is_active: input.isActive,
        })
        .eq('id', eventTypeId)
        .select('*')
        .single();

      throwIfError(error, 'Could not update event type');
      return mapEventType(data as Record<string, unknown>);
    },

    async deleteEventType(accountId: string, eventTypeId: string) {
      const { data: existing, error: findError } = await table(
        client,
        'event_types',
      )
        .select('id, booking_pages!inner(account_id)')
        .eq('id', eventTypeId)
        .eq('booking_pages.account_id', accountId)
        .maybeSingle();

      throwIfError(findError, 'Could not find event type');
      if (!existing) {
        throw new Error('Event type not found');
      }

      const { error } = await table(client, 'event_types')
        .delete()
        .eq('id', eventTypeId);

      throwIfError(error, 'Could not delete event type');
    },

    async listAvailabilitySchedules(
      accountId: string,
    ): Promise<AvailabilityScheduleRow[]> {
      const { data, error } = await table(client, 'availability_schedules')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });

      throwIfError(error, 'Could not load availability schedules');
      const schedules = (data ?? []) as Record<string, unknown>[];
      if (schedules.length === 0) return [];

      const ids = schedules.map((s) => s.id as string);
      const [{ data: rules }, { data: overrides }] = await Promise.all([
        table(client, 'availability_rules')
          .select('*')
          .in('schedule_id', ids)
          .order('day_of_week', { ascending: true }),
        table(client, 'availability_overrides')
          .select('*')
          .in('schedule_id', ids)
          .order('date', { ascending: true }),
      ]);

      const rulesBySchedule = new Map<string, AvailabilityScheduleRow['rules']>();
      for (const rule of (rules ?? []) as Record<string, unknown>[]) {
        const scheduleId = rule.schedule_id as string;
        const list = rulesBySchedule.get(scheduleId) ?? [];
        list.push({
          id: rule.id as string,
          dayOfWeek: Number(rule.day_of_week),
          startTime: String(rule.start_time).slice(0, 5),
          endTime: String(rule.end_time).slice(0, 5),
        });
        rulesBySchedule.set(scheduleId, list);
      }

      const overridesBySchedule = new Map<
        string,
        AvailabilityScheduleRow['overrides']
      >();
      for (const override of (overrides ?? []) as Record<string, unknown>[]) {
        const scheduleId = override.schedule_id as string;
        const list = overridesBySchedule.get(scheduleId) ?? [];
        list.push({
          id: override.id as string,
          date: String(override.date),
          startTime: override.start_time
            ? String(override.start_time).slice(0, 5)
            : null,
          endTime: override.end_time
            ? String(override.end_time).slice(0, 5)
            : null,
        });
        overridesBySchedule.set(scheduleId, list);
      }

      return schedules.map((row) => ({
        id: row.id as string,
        accountId: row.account_id as string,
        name: row.name as string,
        timezone: row.timezone as string,
        isDefault: Boolean(row.is_default),
        rules: rulesBySchedule.get(row.id as string) ?? [],
        overrides: overridesBySchedule.get(row.id as string) ?? [],
      }));
    },

    async upsertAvailabilitySchedule(
      input: z.infer<typeof UpsertAvailabilityScheduleSchema>,
    ): Promise<AvailabilityScheduleRow> {
      for (const rule of input.rules) {
        const start = rule.startTime.slice(0, 5);
        const end = rule.endTime.slice(0, 5);
        if (end <= start) {
          throw new Error(
            'Each availability range must end after it starts (overnight ranges are not supported in the editor yet)',
          );
        }
      }

      let scheduleId = input.scheduleId;

      if (input.isDefault) {
        await table(client, 'availability_schedules')
          .update({ is_default: false })
          .eq('account_id', input.accountId);
      }

      if (scheduleId) {
        const { error } = await table(client, 'availability_schedules')
          .update({
            name: input.name,
            timezone: input.timezone,
            is_default: input.isDefault,
          })
          .eq('account_id', input.accountId)
          .eq('id', scheduleId);

        throwIfError(error, 'Could not update schedule');

        await table(client, 'availability_rules')
          .delete()
          .eq('schedule_id', scheduleId);
        await table(client, 'availability_overrides')
          .delete()
          .eq('schedule_id', scheduleId);
      } else {
        const { data, error } = await table(client, 'availability_schedules')
          .insert({
            account_id: input.accountId,
            name: input.name,
            timezone: input.timezone,
            is_default: input.isDefault,
          })
          .select('id')
          .single();

        throwIfError(error, 'Could not create schedule');
        scheduleId = (data as { id: string }).id;
      }

      if (input.rules.length > 0) {
        const { error } = await table(client, 'availability_rules').insert(
          input.rules.map(
            (rule: z.infer<typeof AvailabilityRuleInputSchema>) => ({
              schedule_id: scheduleId,
              day_of_week: rule.dayOfWeek,
              start_time: rule.startTime.length === 5
                ? `${rule.startTime}:00`
                : rule.startTime,
              end_time: rule.endTime.length === 5
                ? `${rule.endTime}:00`
                : rule.endTime,
            }),
          ),
        );
        throwIfError(error, 'Could not save availability rules');
      }

      if (input.overrides.length > 0) {
        const { error } = await table(client, 'availability_overrides').insert(
          input.overrides.map(
            (override: z.infer<typeof AvailabilityOverrideInputSchema>) => ({
              schedule_id: scheduleId,
              date: override.date,
              start_time: override.startTime
                ? override.startTime.length === 5
                  ? `${override.startTime}:00`
                  : override.startTime
                : null,
              end_time: override.endTime
                ? override.endTime.length === 5
                  ? `${override.endTime}:00`
                  : override.endTime
                : null,
            }),
          ),
        );
        throwIfError(error, 'Could not save availability overrides');
      }

      const schedules = await this.listAvailabilitySchedules(input.accountId);
      const saved = schedules.find((s) => s.id === scheduleId);
      if (!saved) throw new Error('Schedule saved but could not be reloaded');
      return saved;
    },

    async deleteAvailabilitySchedule(accountId: string, scheduleId: string) {
      const { count } = await table(client, 'event_types')
        .select('id', { count: 'exact', head: true })
        .eq('availability_schedule_id', scheduleId);

      if ((count ?? 0) > 0) {
        throw new Error(
          'This schedule is used by one or more event types. Reassign them first.',
        );
      }

      const { error } = await table(client, 'availability_schedules')
        .delete()
        .eq('account_id', accountId)
        .eq('id', scheduleId);

      throwIfError(error, 'Could not delete schedule');
    },

    async setDefaultAvailabilitySchedule(
      accountId: string,
      scheduleId: string,
    ) {
      await table(client, 'availability_schedules')
        .update({ is_default: false })
        .eq('account_id', accountId);

      const { error } = await table(client, 'availability_schedules')
        .update({ is_default: true })
        .eq('account_id', accountId)
        .eq('id', scheduleId);

      throwIfError(error, 'Could not set default schedule');
    },

    async listFormFields(eventTypeId: string): Promise<FormFieldRow[]> {
      const { data, error } = await table(client, 'booking_form_fields')
        .select('*')
        .eq('event_type_id', eventTypeId)
        .order('sort_order', { ascending: true });

      throwIfError(error, 'Could not load form fields');

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        eventTypeId: row.event_type_id as string,
        label: row.label as string,
        fieldType: row.field_type as string,
        options: Array.isArray(row.options)
          ? (row.options as string[])
          : row.options
            ? (row.options as string[])
            : null,
        isRequired: Boolean(row.is_required),
        sortOrder: Number(row.sort_order ?? 0),
      }));
    },

    async saveFormFields(
      accountId: string,
      eventTypeId: string,
      fields: Array<z.infer<typeof FormFieldInputSchema>>,
    ) {
      const { data: existing, error: findError } = await table(
        client,
        'event_types',
      )
        .select('id, booking_pages!inner(account_id)')
        .eq('id', eventTypeId)
        .eq('booking_pages.account_id', accountId)
        .maybeSingle();

      throwIfError(findError, 'Could not find event type');
      if (!existing) throw new Error('Event type not found');

      await table(client, 'booking_form_fields')
        .delete()
        .eq('event_type_id', eventTypeId);

      if (fields.length === 0) return [];

      const { error } = await table(client, 'booking_form_fields')
        .insert(
          fields.map((field, index) => ({
            event_type_id: eventTypeId,
            label: field.label,
            field_type: field.fieldType,
            options: field.options ?? null,
            is_required: field.isRequired,
            sort_order: field.sortOrder ?? index,
          })),
        );

      throwIfError(error, 'Could not save form fields');
      return this.listFormFields(eventTypeId);
    },

    async getNotificationSettings(
      accountId: string,
    ): Promise<NotificationSettingsRow> {
      const { data, error } = await table(
        client,
        'booking_notification_settings',
      )
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      throwIfError(error, 'Could not load notification settings');

      if (!data) {
        return {
          accountId,
          sendConfirmationToInvitee: true,
          sendConfirmationToHost: true,
          reminderOffsetsMinutes: [1440, 60],
          sendCancellationEmails: true,
          replyToEmail: null,
        };
      }

      const row = data as Record<string, unknown>;
      return {
        accountId,
        sendConfirmationToInvitee: row.send_confirmation_to_invitee !== false,
        sendConfirmationToHost: row.send_confirmation_to_host !== false,
        reminderOffsetsMinutes: Array.isArray(row.reminder_offsets_minutes)
          ? (row.reminder_offsets_minutes as number[])
          : [1440, 60],
        sendCancellationEmails: row.send_cancellation_emails !== false,
        replyToEmail: (row.reply_to_email as string | null) ?? null,
      };
    },

    async upsertNotificationSettings(
      input: z.infer<typeof UpsertNotificationSettingsSchema>,
    ) {
      const replyTo =
        !input.replyToEmail || input.replyToEmail === ''
          ? null
          : input.replyToEmail;

      const { error } = await table(client, 'booking_notification_settings').upsert(
        {
          account_id: input.accountId,
          send_confirmation_to_invitee: input.sendConfirmationToInvitee,
          send_confirmation_to_host: input.sendConfirmationToHost,
          reminder_offsets_minutes: input.reminderOffsetsMinutes,
          send_cancellation_emails: input.sendCancellationEmails,
          reply_to_email: replyTo,
        },
        { onConflict: 'account_id' },
      );

      throwIfError(error, 'Could not save notification settings');
      return this.getNotificationSettings(input.accountId);
    },

    async listConferencingConnections(
      accountId: string,
    ): Promise<ConferencingConnectionRow[]> {
      const { data, error } = await table(client, 'conferencing_connections')
        .select('id, provider, provider_account_email')
        .eq('account_id', accountId);

      throwIfError(error, 'Could not load conferencing connections');

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        provider: row.provider as 'zoom' | 'teams',
        providerAccountEmail:
          (row.provider_account_email as string | null) ?? null,
      }));
    },

    async disconnectConferencing(
      accountId: string,
      provider: 'zoom' | 'teams',
    ) {
      const { error } = await table(client, 'conferencing_connections')
        .delete()
        .eq('account_id', accountId)
        .eq('provider', provider);

      throwIfError(error, 'Could not disconnect conferencing account');
    },

    async listBookings(
      accountId: string,
    ): Promise<{ upcoming: BookingListRow[]; past: BookingListRow[] }> {
      const { data, error } = await table(client, 'bookings')
        .select(
          'id, start_at, end_at, invitee_name, invitee_email, status, conferencing_url, needs_host_attention, host_attention_reason, cancellation_reason, event_types(name), booking_pages(title)',
        )
        .eq('account_id', accountId)
        .order('start_at', { ascending: true });

      throwIfError(error, 'Could not load bookings');

      const now = Date.now();
      const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => {
        const eventTypes = row.event_types as
          | { name?: string }
          | { name?: string }[]
          | null;
        const pages = row.booking_pages as
          | { title?: string }
          | { title?: string }[]
          | null;
        const eventTypeName = Array.isArray(eventTypes)
          ? (eventTypes[0]?.name ?? null)
          : (eventTypes?.name ?? null);
        const bookingPageTitle = Array.isArray(pages)
          ? (pages[0]?.title ?? null)
          : (pages?.title ?? null);

        return {
          id: row.id as string,
          startAt: row.start_at as string,
          endAt: row.end_at as string,
          inviteeName: row.invitee_name as string,
          inviteeEmail: row.invitee_email as string,
          status: row.status as string,
          conferencingUrl: (row.conferencing_url as string | null) ?? null,
          needsHostAttention: Boolean(row.needs_host_attention),
          hostAttentionReason:
            (row.host_attention_reason as string | null) ?? null,
          cancellationReason:
            (row.cancellation_reason as string | null) ?? null,
          eventTypeName,
          bookingPageTitle,
        } satisfies BookingListRow;
      });

      return {
        upcoming: rows.filter(
          (row) =>
            new Date(row.startAt).getTime() >= now &&
            row.status === 'confirmed',
        ),
        past: rows
          .filter(
            (row) =>
              new Date(row.startAt).getTime() < now ||
              row.status !== 'confirmed',
          )
          .reverse(),
      };
    },

    async cancelBooking(
      accountId: string,
      bookingId: string,
      cancellationReason?: string | null,
    ) {
      const { error } = await table(client, 'bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: cancellationReason ?? null,
        })
        .eq('account_id', accountId)
        .eq('id', bookingId)
        .eq('status', 'confirmed');

      throwIfError(error, 'Could not cancel booking');
    },
  };
}
