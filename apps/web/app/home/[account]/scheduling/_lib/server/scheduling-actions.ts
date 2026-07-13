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
  DeleteAvailabilityScheduleSchema,
  DeleteBookingPageSchema,
  DeleteEventTypeSchema,
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
