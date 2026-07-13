import { z } from 'zod';

export const LocationTypeSchema = z.enum([
  'google_meet',
  'zoom',
  'teams',
  'phone',
  'in_person',
  'custom',
]);

export const FormFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'multiselect',
  'checkbox',
  'phone',
  'url',
]);

export const BookingStatusSchema = z.enum([
  'confirmed',
  'cancelled',
  'rescheduled',
]);

const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase letters, numbers, and hyphens only',
  );

const hexColourSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #FF5C34')
  .nullable()
  .optional();

const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:mm');

export const CreateBookingPageSchema = z.object({
  accountId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(2000).nullable().optional(),
  slug: slugSchema,
  timezone: z.string().min(1).default('Europe/London'),
  brandColour: hexColourSchema,
  isActive: z.boolean().default(true),
});

export const UpdateBookingPageSchema = CreateBookingPageSchema.extend({
  pageId: z.string().uuid(),
}).omit({ accountId: true });

export const DeleteBookingPageSchema = z.object({
  accountId: z.string().uuid(),
  pageId: z.string().uuid(),
});

export const CheckBookingPageSlugSchema = z.object({
  accountId: z.string().uuid(),
  slug: slugSchema,
  excludePageId: z.string().uuid().optional(),
});

export const ToggleBookingPageActiveSchema = z.object({
  accountId: z.string().uuid(),
  pageId: z.string().uuid(),
  isActive: z.boolean(),
});

export const CreateEventTypeSchema = z.object({
  accountId: z.string().uuid(),
  bookingPageId: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: slugSchema,
  description: z.string().max(2000).nullable().optional(),
  durations: z.array(z.number().int().min(5).max(480)).min(1),
  defaultDuration: z.number().int().min(5).max(480),
  locationType: LocationTypeSchema.default('google_meet'),
  locationDetail: z.string().max(500).nullable().optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(0),
  minimumNoticeMinutes: z.number().int().min(0).max(10080).default(240),
  bookingWindowDays: z.number().int().min(1).max(365).default(60),
  maxBookingsPerDay: z.number().int().min(1).max(100).nullable().optional(),
  slotIncrementMinutes: z.number().int().min(5).max(120).default(30),
  allowGuestInvites: z.boolean().default(true),
  availabilityScheduleId: z.string().uuid(),
  isActive: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
});

export const UpdateEventTypeSchema = CreateEventTypeSchema.extend({
  eventTypeId: z.string().uuid(),
}).omit({ accountId: true, bookingPageId: true });

export const DeleteEventTypeSchema = z.object({
  accountId: z.string().uuid(),
  eventTypeId: z.string().uuid(),
});

export const AvailabilityRuleInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
});

export const AvailabilityOverrideInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
});

export const UpsertAvailabilityScheduleSchema = z.object({
  accountId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  timezone: z.string().min(1).default('Europe/London'),
  isDefault: z.boolean().default(false),
  rules: z.array(AvailabilityRuleInputSchema),
  overrides: z.array(AvailabilityOverrideInputSchema).default([]),
});

export const DeleteAvailabilityScheduleSchema = z.object({
  accountId: z.string().uuid(),
  scheduleId: z.string().uuid(),
});

export const SetDefaultAvailabilityScheduleSchema = z.object({
  accountId: z.string().uuid(),
  scheduleId: z.string().uuid(),
});

export const FormFieldInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(120),
  fieldType: FormFieldTypeSchema,
  options: z.array(z.string().min(1)).nullable().optional(),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

export const SaveFormFieldsSchema = z.object({
  accountId: z.string().uuid(),
  eventTypeId: z.string().uuid(),
  fields: z.array(FormFieldInputSchema),
});

export const UpsertNotificationSettingsSchema = z.object({
  accountId: z.string().uuid(),
  sendConfirmationToInvitee: z.boolean(),
  sendConfirmationToHost: z.boolean(),
  reminderOffsetsMinutes: z.array(z.number().int().min(1).max(10080)).max(10),
  sendCancellationEmails: z.boolean(),
  replyToEmail: z
    .union([z.string().email(), z.literal(''), z.null()])
    .optional(),
});

export const CancelBookingSchema = z.object({
  accountId: z.string().uuid(),
  bookingId: z.string().uuid(),
  cancellationReason: z.string().max(1000).nullable().optional(),
});

export type LocationType = z.infer<typeof LocationTypeSchema>;
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
