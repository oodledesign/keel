import { googleSyncMetaParts, parseGoogleSyncMeta } from './google-sync-meta';
import {
  type ScheduleSegment,
  splitScheduleSegments,
} from './parse-plan-markdown';

export type EditablePlanBlock = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  title: string;
  meta: string[];
  isCalendarEvent: boolean;
  isBreak: boolean;
  /** Calendar events stay fixed on the grid unless overridden in the editor. */
  movable: boolean;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  /** Task block was created on the Ozer Planner Google calendar. */
  pushedByPlanner?: boolean;
};

export type PlanSection = {
  heading: string;
  blocks: EditablePlanBlock[];
};

export type PlanDocument = {
  preamble: string;
  sections: PlanSection[];
  footer: string;
};

const FOOTER_SECTION_RE =
  /^###\s+(Not scheduled today|Notes|Weekly notes|Deferred)/i;

let blockIdCounter = 0;

function nextBlockId() {
  blockIdCounter += 1;
  return `plan-block-${blockIdCounter}`;
}

function segmentToBlock(segment: ScheduleSegment): EditablePlanBlock {
  const startMinutes = segment.startMinutes ?? 0;
  const endMinutes = segment.endMinutes ?? startMinutes + 30;
  const sync = parseGoogleSyncMeta(segment.meta);

  return {
    id: nextBlockId(),
    startMinutes,
    endMinutes,
    title: segment.title,
    meta: sync.displayMeta,
    isCalendarEvent: segment.isCalendarEvent,
    isBreak: segment.isBreak,
    movable: !segment.isCalendarEvent,
    googleEventId: sync.googleEventId,
    googleCalendarId: sync.googleCalendarId,
    pushedByPlanner: sync.pushedByPlanner,
  };
}

function formatClockMinutes(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const meridiem = hours24 >= 12 ? 'pm' : 'am';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  if (mins === 0) {
    return `${hours12}${meridiem}`;
  }

  return `${hours12}:${String(mins).padStart(2, '0')}${meridiem}`;
}

export function blockToScheduleLine(block: EditablePlanBlock): string {
  const start = formatClockMinutes(block.startMinutes);
  const end = formatClockMinutes(block.endMinutes);
  const prefix = block.isCalendarEvent ? '📅 ' : '';
  const metaParts = [
    ...googleSyncMetaParts({
      googleEventId: block.googleEventId,
      googleCalendarId: block.googleCalendarId,
      pushedByPlanner: block.pushedByPlanner,
    }),
    ...block.meta,
  ];
  const meta = metaParts.length > 0 ? ` · ${metaParts.join(' · ')}` : '';

  return `${start}–${end} · ${prefix}${block.title}${meta}`;
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function blockDedupeKey(block: EditablePlanBlock): string {
  if (block.googleEventId) {
    return `gcal:${block.googleEventId}`;
  }

  const title = normalizeTitle(block.title);
  const kind = block.isCalendarEvent
    ? 'cal'
    : block.isBreak
      ? 'break'
      : 'task';

  return `${kind}:${block.startMinutes}:${block.endMinutes}:${title}`;
}

/** Drop duplicate schedule blocks (common when AI repeats calendar events). */
export function dedupePlanDocument(doc: PlanDocument): PlanDocument {
  const seen = new Set<string>();

  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.filter((block) => {
        const key = blockDedupeKey(block);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      }),
    })),
  };
}

export function parsePlanDocument(markdown: string): PlanDocument {
  blockIdCounter = 0;

  const lines = markdown.split('\n');
  const footerStartIdx = lines.findIndex((line) =>
    FOOTER_SECTION_RE.test(line.trim()),
  );
  const scheduleEnd = footerStartIdx === -1 ? lines.length : footerStartIdx;
  const scheduleLines = lines.slice(0, scheduleEnd);
  const footer = lines.slice(scheduleEnd).join('\n');

  const preambleLines: string[] = [];
  const sections: PlanSection[] = [];
  let currentSection: PlanSection | null = null;

  for (const line of scheduleLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (!currentSection) {
        preambleLines.push(line);
      }
      continue;
    }

    const segments = splitScheduleSegments(trimmed);
    const isSectionHeading = /^#{2,3}\s/.test(trimmed) && segments.length === 0;

    if (isSectionHeading) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { heading: trimmed, blocks: [] };
      continue;
    }

    if (segments.length === 0) {
      if (!currentSection) {
        preambleLines.push(line);
      }
      continue;
    }

    if (!currentSection) {
      currentSection = { heading: '', blocks: [] };
    }

    for (const segment of segments) {
      if (segment.startMinutes === null || segment.endMinutes === null) {
        continue;
      }
      if (segment.endMinutes <= segment.startMinutes) {
        continue;
      }
      currentSection.blocks.push(segmentToBlock(segment));
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return dedupePlanDocument({
    preamble: preambleLines.join('\n').trimEnd(),
    sections,
    footer,
  });
}

export function serializePlanDocument(doc: PlanDocument): string {
  const parts: string[] = [];

  if (doc.preamble.trim()) {
    parts.push(doc.preamble.trimEnd());
  }

  for (const section of doc.sections) {
    const sectionParts: string[] = [];
    if (section.heading.trim()) {
      sectionParts.push(section.heading);
    }

    const sorted = [...section.blocks].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    );

    for (const block of sorted) {
      sectionParts.push(blockToScheduleLine(block));
    }

    if (sectionParts.length > 0) {
      parts.push(sectionParts.join('\n'));
    }
  }

  if (doc.footer.trim()) {
    parts.push(doc.footer.trim());
  }

  return parts.join('\n\n').trim() + '\n';
}

export function flattenPlanBlocks(doc: PlanDocument): EditablePlanBlock[] {
  return doc.sections.flatMap((section) => section.blocks);
}

/** Optional overrides for the schedule editor (e.g. movable calendar events on the plan page). */
export function resolveEditablePlanBlocks(
  doc: PlanDocument,
  options?: { movableCalendarEvents?: boolean },
): EditablePlanBlock[] {
  const blocks = flattenPlanBlocks(doc);
  if (!options?.movableCalendarEvents) {
    return blocks;
  }

  return blocks.map((block) =>
    block.isCalendarEvent ? { ...block, movable: true } : block,
  );
}

export function updatePlanBlock(
  doc: PlanDocument,
  blockId: string,
  patch: Partial<
    Pick<
      EditablePlanBlock,
      | 'startMinutes'
      | 'endMinutes'
      | 'meta'
      | 'googleEventId'
      | 'googleCalendarId'
      | 'pushedByPlanner'
    >
  >,
): PlanDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (block.id !== blockId) {
          return block;
        }

        const next = { ...block, ...patch };

        if (patch.meta === undefined) {
          const startMinutes = patch.startMinutes ?? block.startMinutes;
          const endMinutes = patch.endMinutes ?? block.endMinutes;
          next.meta = updateDurationMeta(block.meta, endMinutes - startMinutes);
        }

        return next;
      }),
    })),
  };
}

function updateDurationMeta(meta: string[], durationMinutes: number): string[] {
  const withoutDuration = meta.filter((part) => !/^~/.test(part.trim()));
  return [`~${durationMinutes}min`, ...withoutDuration];
}

export function setPlanBlockDuration(
  doc: PlanDocument,
  blockId: string,
  durationMinutes: number,
): PlanDocument {
  const block = flattenPlanBlocks(doc).find((item) => item.id === blockId);
  if (!block) {
    return doc;
  }

  return updatePlanBlock(doc, blockId, {
    endMinutes: block.startMinutes + durationMinutes,
    meta: updateDurationMeta(block.meta, durationMinutes),
  });
}

export function blocksFromCalendarFallback(
  events: Array<{
    id: string;
    start: string;
    end: string;
    title: string;
    calendarId?: string | null;
  }>,
): EditablePlanBlock[] {
  return events
    .map((event) => {
      const startMinutes = isoToMinutes(event.start);
      const endMinutes = isoToMinutes(event.end);
      if (
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        return null;
      }

      return {
        id: event.id,
        startMinutes,
        endMinutes,
        title: event.title,
        meta: [],
        isCalendarEvent: true,
        isBreak: false,
        movable: false,
        googleEventId: event.id,
        googleCalendarId: event.calendarId ?? null,
        pushedByPlanner: false,
      } satisfies EditablePlanBlock;
    })
    .filter((block): block is EditablePlanBlock => block !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

function isoToMinutes(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getHours() * 60 + date.getMinutes();
}

function isoToMinutesOnDate(iso: string, dateIso: string): number | null {
  const date = new Date(iso);
  const base = new Date(dateIso);
  if (Number.isNaN(date.getTime()) || Number.isNaN(base.getTime())) {
    return null;
  }

  if (date.toDateString() !== base.toDateString()) {
    return null;
  }

  return date.getHours() * 60 + date.getMinutes();
}

/** Link 📅 plan blocks to fetched Google events by title + start time. */
export function attachGoogleEventIdsToPlan(
  doc: PlanDocument,
  events: Array<{
    id: string;
    title: string;
    start: string;
    calendarId: string;
  }>,
  dateIso: string,
): PlanDocument {
  if (events.length === 0) {
    return doc;
  }

  const usedIds = new Set(
    flattenPlanBlocks(doc)
      .map((block) => block.googleEventId)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (!block.isCalendarEvent || block.googleEventId) {
          return block;
        }

        const targetTitle = normalizeTitle(block.title);
        let best: (typeof events)[number] | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const event of events) {
          if (usedIds.has(event.id)) continue;
          if (normalizeTitle(event.title) !== targetTitle) continue;

          const eventStart = isoToMinutesOnDate(event.start, dateIso);
          if (eventStart === null) continue;

          const distance = Math.abs(eventStart - block.startMinutes);
          if (distance <= 45 && distance < bestDistance) {
            best = event;
            bestDistance = distance;
          }
        }

        if (!best) {
          return block;
        }

        usedIds.add(best.id);
        return {
          ...block,
          googleEventId: best.id,
          googleCalendarId: best.calendarId,
          pushedByPlanner: false,
        };
      }),
    })),
  };
}
