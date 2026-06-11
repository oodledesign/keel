import {
  normalizeAiExtractedDueDateYmd,
  todayLocalYmd,
} from '~/home/_lib/due-date-ymd';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function toYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekdayYmd(dayIndex: number, now = new Date(), includeToday = false): string {
  const current = now.getDay();
  let delta = (dayIndex - current + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return toYmd(addDays(now, delta));
}

/**
 * Parses common relative due-date phrases into YYYY-MM-DD (local calendar).
 * Returns null when the phrase cannot be resolved.
 */
export function parseRelativeDueDatePhrase(
  phrase: string | null | undefined,
  now = new Date(),
): string | null {
  if (!phrase?.trim()) return null;

  const raw = phrase.trim().toLowerCase();
  const today = todayLocalYmd(now);

  if (raw === 'today') return today;
  if (raw === 'tomorrow') return toYmd(addDays(now, 1));

  if (raw === 'this week' || raw === 'end of week' || raw === 'by end of week') {
    const day = now.getDay();
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    return toYmd(addDays(now, daysUntilSunday));
  }

  if (raw === 'next week') {
    const day = now.getDay();
    const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
    return toYmd(addDays(now, daysUntilNextMonday + 4));
  }

  for (let i = 0; i < DAY_NAMES.length; i += 1) {
    const name = DAY_NAMES[i]!;
    if (raw === name || raw === `this ${name}` || raw === `by ${name}`) {
      return nextWeekdayYmd(i, now, raw === name);
    }
    if (raw === `next ${name}`) {
      const thisWeek = nextWeekdayYmd(i, now, false);
      const parsed = normalizeAiExtractedDueDateYmd(thisWeek, now);
      if (!parsed) return null;
      const [y, m, d] = parsed.split('-').map(Number);
      return toYmd(new Date(y!, m! - 1, d! + 7));
    }
  }

  const iso = normalizeAiExtractedDueDateYmd(raw, now);
  if (iso) return iso;

  return null;
}

export function resolveDueDate(input: {
  dueDate?: string | null;
  dueDatePhrase?: string | null;
}): string | null {
  const explicit = normalizeAiExtractedDueDateYmd(input.dueDate?.trim() || null);
  if (explicit) return explicit;
  return parseRelativeDueDatePhrase(input.dueDatePhrase);
}
