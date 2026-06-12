export type ParsedScheduleBlock = {
  title: string;
  start: string;
  end: string;
  isCalendarEvent: boolean;
  raw: string;
};

const timeLineRe =
  /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*·\s*(.+)$/;

const calendarLineRe =
  /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*·\s*📅\s*(.+)$/;

export function parseDayScheduleFromMarkdown(
  markdown: string,
  dateIso: string,
): ParsedScheduleBlock[] {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return [];

  const blocks: ParsedScheduleBlock[] = [];

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    const calendarMatch = calendarLineRe.exec(line);
    const taskMatch = calendarMatch ? null : timeLineRe.exec(line);
    const match = calendarMatch ?? taskMatch;
    if (!match) continue;

    const [, sh, sm, eh, em, rawBody] = match;
    if (!sh || !sm || !eh || !em || !rawBody) continue;

    const start = new Date(base);
    const end = new Date(base);
    start.setHours(Number(sh), Number(sm), 0, 0);
    end.setHours(Number(eh), Number(em), 0, 0);
    if (end <= start) continue;

    blocks.push({
      title: rawBody.replace(/\s*·\s*.+$/, '').trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      isCalendarEvent: Boolean(calendarMatch),
      raw: line,
    });
  }

  return blocks.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

const pushLineRe =
  /^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*·\s*(?!📅)(.+?)(?:\s*·\s*.+)?$/;

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
    const heading = /^###\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.exec(
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

    const match = pushLineRe.exec(line);
    if (!match) continue;

    const [, sh, sm, eh, em, rawTitle] = match;
    if (!sh || !sm || !eh || !em || !rawTitle) continue;
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    start.setHours(Number(sh), Number(sm), 0, 0);
    end.setHours(Number(eh), Number(em), 0, 0);
    if (end <= start) continue;

    blocks.push({
      title: rawTitle.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
    });
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
