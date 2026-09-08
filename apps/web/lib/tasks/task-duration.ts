export const MAX_TASK_DURATION_MINUTES = 10_080; // 7 days

export function normalizeDurationMinutes(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return clampDurationMinutes(value);
  }

  if (typeof value === 'string') {
    return parseDurationMinutes(value);
  }

  return null;
}

export function clampDurationMinutes(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded <= 0 || rounded > MAX_TASK_DURATION_MINUTES) {
    return null;
  }

  return rounded;
}

/**
 * Parse spoken or typed durations: "30 mins", "2 hours", "1h 30m", "1.5h".
 * Returns null when nothing recognisable is present.
 */
export function parseDurationMinutes(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    return clampDurationMinutes(Number(text));
  }

  const combined =
    /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/.exec(
      text,
    );
  if (combined) {
    const hours = Number(combined[1]);
    const minutes = Number(combined[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    return clampDurationMinutes(hours * 60 + minutes);
  }

  const hourOnly = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/.exec(text);
  const minuteOnly = /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/.exec(text);

  if (
    hourOnly &&
    minuteOnly &&
    (hourOnly.index ?? 0) < (minuteOnly.index ?? 0)
  ) {
    return clampDurationMinutes(
      Number(hourOnly[1]) * 60 + Number(minuteOnly[1]),
    );
  }

  if (hourOnly && !minuteOnly) {
    return clampDurationMinutes(Number(hourOnly[1]) * 60);
  }

  if (minuteOnly) {
    return clampDurationMinutes(Number(minuteOnly[1]));
  }

  return null;
}

export function splitDurationMinutes(total: number | null | undefined): {
  hours: number;
  minutes: number;
} {
  const normalized = normalizeDurationMinutes(total);
  if (normalized == null) {
    return { hours: 0, minutes: 0 };
  }

  return {
    hours: Math.floor(normalized / 60),
    minutes: normalized % 60,
  };
}

export function combineDurationParts(
  hours: number | null | undefined,
  minutes: number | null | undefined,
): number | null {
  const h = hours == null || Number.isNaN(hours) ? 0 : hours;
  const m = minutes == null || Number.isNaN(minutes) ? 0 : minutes;
  if (h < 0 || m < 0) {
    return null;
  }

  return clampDurationMinutes(h * 60 + m);
}

/** Compact label for task rows: `30m`, `2h`, `1h 30m`. */
export function formatDurationMinutes(
  value: number | null | undefined,
): string | null {
  const normalized = normalizeDurationMinutes(value);
  if (normalized == null) {
    return null;
  }

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}
