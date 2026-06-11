/** UK display timezone — handles GMT/BST automatically. */
export const UK_TIMEZONE = 'Europe/London';

export const UK_LOCALE = 'en-GB';

export function parseInstant(
  value: string | Date | null | undefined,
): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatUkDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
): string {
  const date = parseInstant(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(UK_LOCALE, {
    timeZone: UK_TIMEZONE,
    ...options,
  }).format(date);
}

export function formatUkDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  },
): string {
  const date = parseInstant(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat(UK_LOCALE, {
    timeZone: UK_TIMEZONE,
    ...options,
  }).format(date);
}

/** e.g. 08 Jun 13:01 */
export function formatUkDateTimeShort(
  value: string | Date | null | undefined,
): string {
  return formatUkDateTime(value, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** e.g. 08 Jun 2026 */
export function formatUkDateMedium(
  value: string | Date | null | undefined,
): string {
  return formatUkDate(value);
}

/** e.g. 8 Jun 2026 */
export function formatUkDateLong(
  value: string | Date | null | undefined,
): string {
  return formatUkDate(value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. 08 Jun 2026 13:01 */
export function formatUkDateTimeMedium(
  value: string | Date | null | undefined,
): string {
  return formatUkDateTime(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** e.g. Mon, 8 Jun 2026, 13:01 */
export function formatUkEventDateTime(
  value: string | Date | null | undefined,
): string {
  return formatUkDateTime(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** e.g. Jun 8, 2026 13:01 */
export function formatUkDateTimeLong(
  value: string | Date | null | undefined,
): string {
  return formatUkDateTime(value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
