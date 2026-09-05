/**
 * Client-safe schedule timezone helpers. Wall-clock values from
 * <input type="datetime-local"> are interpreted in the campaign timezone.
 */

export const CAMPAIGN_TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
] as const;

export type CampaignTimezone = (typeof CAMPAIGN_TIMEZONES)[number];

export function parseCampaignTimezone(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    try {
      Intl.DateTimeFormat('en-GB', { timeZone: value.trim() });
      return value.trim();
    } catch {
      return 'Europe/London';
    }
  }
  return 'Europe/London';
}

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const zoned = partsInZone(date, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  return asUtc - date.getTime();
}

/** Convert a datetime-local wall clock in `timeZone` to an ISO UTC string. */
export function zonedLocalToUtcIso(
  localValue: string,
  timeZone: string,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localValue);
  if (!match) {
    throw new Error('Invalid schedule time');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = zoneOffsetMs(utcGuess, parseCampaignTimezone(timeZone));
  return new Date(utcGuess.getTime() - offset).toISOString();
}

/** Format a stored UTC instant for a datetime-local input in `timeZone`. */
export function utcIsoToZonedLocal(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const zoned = partsInZone(date, parseCampaignTimezone(timeZone));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)}T${pad(zoned.hour)}:${pad(zoned.minute)}`;
}

export function formatZonedInstant(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: parseCampaignTimezone(timeZone),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
    hourCycle: 'h23',
  }).format(date);
}

export function timezoneShortLabel(timeZone: string): string {
  const zone = parseCampaignTimezone(timeZone);
  try {
    const part = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date())
      .find((entry) => entry.type === 'timeZoneName')?.value;
    return part ? `${zone} (${part})` : zone;
  } catch {
    return zone;
  }
}
