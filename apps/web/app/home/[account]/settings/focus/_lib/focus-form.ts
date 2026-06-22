import {
  WorkspaceFocusSettingsSchema,
  type WorkspaceFocusSettings,
} from '~/home/[account]/settings/focus/_lib/focus-settings.schema';
import type { z } from 'zod';

export type FocusFormValues = z.infer<typeof WorkspaceFocusSettingsSchema>;

export const FOCUS_TIMEZONE_OPTIONS = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export const WORK_DAY_CHIPS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
] as const;

export const HOLIDAY_LABEL_PRESETS = [
  'Holiday',
  'Conference',
  'Parental leave',
  'Sick leave',
  'Training',
] as const;

export const OOO_TRIGGER_OPTIONS = [
  {
    value: 'manual' as const,
    label: 'Manual only',
    description:
      "Only send when I've turned OOO on manually (controlled by this switch)",
  },
  {
    value: 'outside_hours' as const,
    label: 'Outside work hours',
    description:
      'Automatically reply to anyone who messages outside your work hours',
  },
  {
    value: 'holiday_only' as const,
    label: 'When on holiday',
    description: 'Only send replies while holiday mode is active',
  },
  {
    value: 'outside_hours_or_holiday' as const,
    label: 'Outside hours or on holiday',
    description:
      'Send whenever either condition is true — the most permissive option',
  },
  {
    value: 'outside_hours_and_holiday' as const,
    label: 'Outside hours and on holiday',
    description: 'Only send when both conditions are met simultaneously',
  },
  {
    value: 'always' as const,
    label: 'Always',
    description: 'Reply to every incoming message while OOO replies are enabled',
  },
];

export const FOCUS_FORM_DEFAULTS: FocusFormValues = {
  silence_outside_hours: false,
  work_days: [1, 2, 3, 4, 5],
  work_start_time: '09:00',
  work_end_time: '17:30',
  timezone: 'Europe/London',
  holiday_mode_enabled: false,
  holiday_mode_label: 'Holiday',
  holiday_mode_until: null,
  ooo_enabled: false,
  ooo_trigger: 'manual',
  ooo_message: '',
  ooo_holiday_message: null,
  ooo_sender_name: null,
  ooo_cc_email: null,
  ooo_include_return_date: false,
};

export function buildFocusFormDefaults(
  settings: WorkspaceFocusSettings | null,
): FocusFormValues {
  if (!settings) {
    return FOCUS_FORM_DEFAULTS;
  }

  return {
    silence_outside_hours: settings.silence_outside_hours,
    work_days: settings.work_days,
    work_start_time: settings.work_start_time,
    work_end_time: settings.work_end_time,
    timezone: settings.timezone,
    holiday_mode_enabled: settings.holiday_mode_enabled,
    holiday_mode_label: settings.holiday_mode_label,
    holiday_mode_until: settings.holiday_mode_until,
    ooo_enabled: settings.ooo_enabled,
    ooo_trigger: settings.ooo_trigger,
    ooo_message: settings.ooo_message,
    ooo_holiday_message: settings.ooo_holiday_message,
    ooo_sender_name: settings.ooo_sender_name,
    ooo_cc_email: settings.ooo_cc_email,
    ooo_include_return_date: settings.ooo_include_return_date,
  };
}

export function toWorkspaceFocusPreview(
  values: FocusFormValues,
  accountId: string,
  persisted: WorkspaceFocusSettings | null,
): WorkspaceFocusSettings {
  const now = new Date().toISOString();

  return {
    ...values,
    id: persisted?.id ?? 'preview',
    account_id: accountId,
    user_id: persisted?.user_id ?? 'preview',
    created_at: persisted?.created_at ?? now,
    updated_at: persisted?.updated_at ?? now,
  };
}

export function formatFocusTimeOptions(): string[] {
  const options: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      );
    }
  }

  return options;
}

export function formatTimezoneLabel(timeZone: string): string {
  const city =
    timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone.replace(/_/g, ' ');

  const offset =
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  return `${city} (${offset})`;
}

export function parseHolidayUntilDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function holidayUntilToIso(date: Date): string {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  ).toISOString();
}

export function holidayEmoji(label: string): string {
  const lower = label.toLowerCase();

  if (lower.includes('sick')) return '🤒';
  if (lower.includes('conference')) return '🎤';
  if (lower.includes('parental')) return '👶';
  if (lower.includes('training')) return '📚';
  if (lower.includes('holiday')) return '🏖️';

  return '✈️';
}

export function oooTriggerReasonLabel(
  trigger: FocusFormValues['ooo_trigger'],
  state: {
    isOOOActive: boolean;
    isWithinWorkHours: boolean;
    isHolidayModeActive: boolean;
    oooEnabled: boolean;
  },
): string {
  if (!state.oooEnabled) {
    return 'Off';
  }

  if (!state.isOOOActive) {
    switch (trigger) {
      case 'outside_hours':
        return 'Within work hours';
      case 'holiday_only':
        return 'Holiday mode inactive';
      case 'outside_hours_or_holiday':
        return 'Within work hours and not on holiday';
      case 'outside_hours_and_holiday':
        return 'Requires outside hours and holiday mode';
      case 'manual':
        return 'Manual mode inactive';
      case 'always':
        return 'Always (waiting for messages)';
      default:
        return 'Inactive';
    }
  }

  switch (trigger) {
    case 'manual':
      return 'Manual';
    case 'outside_hours':
      return 'Outside work hours';
    case 'holiday_only':
      return 'Holiday mode';
    case 'outside_hours_or_holiday':
      return state.isHolidayModeActive
        ? 'Holiday mode'
        : 'Outside work hours';
    case 'outside_hours_and_holiday':
      return 'Outside work hours and holiday mode';
    case 'always':
      return 'Always';
    default:
      return 'Active';
  }
}
