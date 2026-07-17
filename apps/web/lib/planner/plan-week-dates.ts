import type { PlanDocument } from './plan-blocks';

const WEEKDAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

const WEEKDAY_HEADING_RE =
  /^#{2,4}\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;

/** Local calendar date at noon — stable anchor for week/day scheduling. */
export function parsePlanDateAnchor(dateIso: string): Date {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    12,
    0,
    0,
    0,
  );
}

export function toLocalDateYmdFromAnchor(anchor: Date): string {
  const y = anchor.getFullYear();
  const m = String(anchor.getMonth() + 1).padStart(2, '0');
  const d = String(anchor.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday of the calendar week containing the anchor date (Mon–Sun). */
export function startOfWeekMonday(anchor: Date): Date {
  const monday = new Date(anchor);
  const weekday = monday.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  monday.setDate(monday.getDate() + diff);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

export function parseWeekdayFromHeading(heading: string): WeekdayName | null {
  const match = WEEKDAY_HEADING_RE.exec(heading.trim());
  if (!match?.[1]) {
    return null;
  }

  const normalized = match[1].toLowerCase() as WeekdayName;
  return WEEKDAY_NAMES.includes(normalized) ? normalized : null;
}

export function isWeekPlanDocument(doc: PlanDocument): boolean {
  return doc.sections.some((section) =>
    Boolean(parseWeekdayFromHeading(section.heading)),
  );
}

export function resolveWeekdayDateYmd(
  weekAnchorIso: string,
  weekday: WeekdayName,
): string {
  const monday = startOfWeekMonday(parsePlanDateAnchor(weekAnchorIso));
  const dayIndex = WEEKDAY_NAMES.indexOf(weekday);
  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);
  return toLocalDateYmdFromAnchor(target);
}

export function resolveSectionDateYmd(
  weekAnchorIso: string,
  sectionHeading: string,
): string | null {
  const weekday = parseWeekdayFromHeading(sectionHeading);
  if (!weekday) {
    return null;
  }

  return resolveWeekdayDateYmd(weekAnchorIso, weekday);
}

/** Offsets from the week anchor's local date to each weekday in the same Mon–Sun week. */
export function weekDayOffsetsForAnchor(
  weekAnchorIso: string,
): Record<string, number> {
  const anchor = parsePlanDateAnchor(weekAnchorIso);
  const anchorYmd = toLocalDateYmdFromAnchor(anchor);
  const offsets: Record<string, number> = {};

  for (const weekday of WEEKDAY_NAMES) {
    const targetYmd = resolveWeekdayDateYmd(weekAnchorIso, weekday);
    const target = parsePlanDateAnchor(`${targetYmd}T12:00:00`);
    const diffMs = target.getTime() - anchor.getTime();
    offsets[weekday] = Math.round(diffMs / (24 * 60 * 60 * 1000));
  }

  return offsets;
}
