export type ParsedScheduleBlock = {
  title: string;
  start: string;
  end: string;
  isCalendarEvent: boolean;
  isBreak: boolean;
  raw: string;
};

export type ScheduleSegment = {
  timeLabel: string;
  startMinutes: number | null;
  endMinutes: number | null;
  title: string;
  meta: string[];
  isCalendarEvent: boolean;
  isBreak: boolean;
};

export const BREAK_TITLE_RE =
  /^(break|buffer|lunch|breakfast|dinner|rest|day wrap[\s-]?up|wind[\s-]?down)/i;

// Matches "8:30am", "08:30", "10am", "5:30 pm" — a bare number without
// minutes or am/pm is rejected so durations like "~90min" never match.
const TIME_PART = String.raw`\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)`;
/** After the end time, accept middle dot, bullet, dash, colon, or whitespace before the title. */
const RANGE_SOURCE = `(${TIME_PART})\\s*[–—-]\\s*(${TIME_PART})\\s*(?:[·•—\\-:]\\s*|\\s+)`;

function normalizeScheduleLine(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\[[ x]\]\s+/i, '')
    .trim();
}

function parseClockMinutes(raw: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(raw.trim());
  if (!m?.[1]) return null;

  let hours = Number(m[1]);
  const minutes = Number(m[2] ?? '0');
  const meridiem = m[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** When the end time omits am/pm (e.g. 12:00–1:00), infer PM so the block is not dropped. */
function resolveRangeMinutes(rawStart: string, rawEnd: string) {
  let startMinutes = parseClockMinutes(rawStart);
  let endMinutes = parseClockMinutes(rawEnd);
  if (startMinutes === null || endMinutes === null) {
    return { startMinutes, endMinutes };
  }

  const endHasMeridiem = /(?:am|pm)\s*$/i.test(rawEnd.trim());
  const startHasMeridiem = /(?:am|pm)\s*$/i.test(rawStart.trim());

  if (endMinutes <= startMinutes && !endHasMeridiem) {
    // 12:00–1:00 → treat 1:00 as 13:00 when start is midday or afternoon
    if (startMinutes >= 11 * 60 || startHasMeridiem) {
      endMinutes += 12 * 60;
    }
  }

  if (endMinutes <= startMinutes && endHasMeridiem && !startHasMeridiem) {
    // 11:50–1:00pm → start is AM unless we infer from end
    if (parseClockMinutes(`${rawStart.trim()}pm`) !== null) {
      const pmStart = parseClockMinutes(`${rawStart.trim()}pm`);
      if (pmStart !== null && pmStart < endMinutes) {
        startMinutes = pmStart;
      }
    }
  }

  return { startMinutes, endMinutes };
}

function compactTime(raw: string): string {
  return raw.replace(/\s+/g, '').toLowerCase();
}

/**
 * Split text into individual schedule blocks. Handles AI output where several
 * "8:30am–10:00am · Task · meta" entries run together in one paragraph.
 * Returns [] when the text does not start with a time range.
 */
export function splitScheduleSegments(text: string): ScheduleSegment[] {
  const normalized = normalizeScheduleLine(text);
  const re = new RegExp(RANGE_SOURCE, 'gi');
  const matches = Array.from(normalized.matchAll(re));
  if (matches.length === 0) return [];

  const segments: ScheduleSegment[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (match?.index === undefined) continue;
    const [full, rawStart, rawEnd] = match;
    if (!rawStart || !rawEnd) continue;

    const bodyStart = match.index + full.length;
    const next = matches[i + 1];
    const bodyEnd = next?.index !== undefined ? next.index : normalized.length;
    const body = normalized
      .slice(bodyStart, bodyEnd)
      .trim()
      .replace(/[·\s]+$/, '')
      .trim();
    if (!body) continue;

    const isCalendarEvent = body.includes('📅');
    const parts = body
      .replace(/📅/g, '')
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);

    const title = parts[0] ?? body;
    const meta = parts
      .slice(1)
      .filter((part) => !/^no project$/i.test(part));

    const { startMinutes, endMinutes } = resolveRangeMinutes(rawStart, rawEnd);

    segments.push({
      timeLabel: `${compactTime(rawStart)}–${compactTime(rawEnd)}`,
      startMinutes,
      endMinutes,
      title,
      meta,
      isCalendarEvent,
      isBreak: !isCalendarEvent && BREAK_TITLE_RE.test(title),
    });
  }

  return segments;
}

export function parseDayScheduleFromMarkdown(
  markdown: string,
  dateIso: string,
): ParsedScheduleBlock[] {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return [];

  const blocks: ParsedScheduleBlock[] = [];

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^#{1,6}\s/.test(line)) continue;

    for (const segment of splitScheduleSegments(line)) {
      if (segment.startMinutes === null || segment.endMinutes === null) continue;
      if (segment.endMinutes <= segment.startMinutes) continue;

      const start = new Date(base);
      const end = new Date(base);
      start.setHours(
        Math.floor(segment.startMinutes / 60),
        segment.startMinutes % 60,
        0,
        0,
      );
      end.setHours(
        Math.floor(segment.endMinutes / 60),
        segment.endMinutes % 60,
        0,
        0,
      );

      blocks.push({
        title: segment.title,
        start: start.toISOString(),
        end: end.toISOString(),
        isCalendarEvent: segment.isCalendarEvent,
        isBreak: segment.isBreak,
        raw: line,
      });
    }
  }

  return blocks.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export function parseScheduledBlocksForCalendarPush(
  markdown: string,
  dateIso: string,
) {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return [];

  let currentDate = new Date(base);
  const blocks: Array<{ title: string; start: string; end: string }> = [];
  const dayOffsets = weekDayOffsets(base);

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const heading = /^#{2,4}\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.exec(
      line,
    );
    if (heading) {
      const dayName = heading[1];
      if (!dayName) continue;
      const offset = dayOffsets[dayName.toLowerCase()];
      if (offset !== undefined) {
        currentDate = new Date(base);
        currentDate.setDate(base.getDate() + offset);
      }
      continue;
    }

    if (/^#{1,6}\s/.test(line)) continue;

    for (const segment of splitScheduleSegments(line)) {
      // Calendar events already exist in Google Calendar — don't duplicate.
      if (segment.isCalendarEvent) continue;
      if (segment.startMinutes === null || segment.endMinutes === null) continue;
      if (segment.endMinutes <= segment.startMinutes) continue;

      const start = new Date(currentDate);
      const end = new Date(currentDate);
      start.setHours(
        Math.floor(segment.startMinutes / 60),
        segment.startMinutes % 60,
        0,
        0,
      );
      end.setHours(
        Math.floor(segment.endMinutes / 60),
        segment.endMinutes % 60,
        0,
        0,
      );

      blocks.push({
        title: segment.title,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
  }

  return blocks;
}

function weekDayOffsets(base: Date) {
  const dayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const offsets: Record<string, number> = {};
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dayName = dayNames[d.getDay()];
    if (dayName) offsets[dayName] = i;
  }
  return offsets;
}
