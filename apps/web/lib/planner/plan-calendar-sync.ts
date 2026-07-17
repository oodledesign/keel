import type { EditablePlanBlock, PlanDocument } from './plan-blocks';
import { flattenPlanBlocks } from './plan-blocks';
import {
  isWeekPlanDocument,
  parsePlanDateAnchor,
  resolveSectionDateYmd,
  toLocalDateYmdFromAnchor,
} from './plan-week-dates';

export type PlannerSyncBlock = {
  blockId: string;
  title: string;
  start: string;
  end: string;
  isCalendarEvent: boolean;
  isBreak: boolean;
  googleEventId: string | null;
  googleCalendarId: string | null;
  pushedByPlanner: boolean;
};

export type PlannerSyncResultMapping = {
  blockId: string;
  googleEventId: string;
  googleCalendarId: string;
  pushedByPlanner: boolean;
};

function minutesToIso(dateYmd: string, minutes: number): string {
  const base = parsePlanDateAnchor(`${dateYmd}T12:00:00`);
  const next = new Date(base);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next.toISOString();
}

function defaultDateYmd(dateIso: string): string {
  return toLocalDateYmdFromAnchor(parsePlanDateAnchor(dateIso));
}

export function blocksForCalendarSync(
  doc: PlanDocument,
  dateIso: string,
  options?: { mode?: 'day' | 'week' },
): PlannerSyncBlock[] {
  const fallbackDateYmd = defaultDateYmd(dateIso);
  const weekPlan =
    options?.mode === 'week' ||
    (options?.mode !== 'day' && isWeekPlanDocument(doc));

  if (!weekPlan) {
    return flattenPlanBlocks(doc)
      .filter((block) => !block.isBreak)
      .map((block) => ({
        blockId: block.id,
        title: block.title,
        start: minutesToIso(fallbackDateYmd, block.startMinutes),
        end: minutesToIso(fallbackDateYmd, block.endMinutes),
        isCalendarEvent: block.isCalendarEvent,
        isBreak: block.isBreak,
        googleEventId: block.googleEventId ?? null,
        googleCalendarId: block.googleCalendarId ?? null,
        pushedByPlanner: block.pushedByPlanner ?? false,
      }));
  }

  const blocks: PlannerSyncBlock[] = [];

  for (const section of doc.sections) {
    const sectionDateYmd =
      resolveSectionDateYmd(dateIso, section.heading) ?? fallbackDateYmd;

    for (const block of section.blocks) {
      if (block.isBreak) {
        continue;
      }

      blocks.push({
        blockId: block.id,
        title: block.title,
        start: minutesToIso(sectionDateYmd, block.startMinutes),
        end: minutesToIso(sectionDateYmd, block.endMinutes),
        isCalendarEvent: block.isCalendarEvent,
        isBreak: block.isBreak,
        googleEventId: block.googleEventId ?? null,
        googleCalendarId: block.googleCalendarId ?? null,
        pushedByPlanner: block.pushedByPlanner ?? false,
      });
    }
  }

  return blocks;
}

export function hasSyncableBlocks(doc: PlanDocument): boolean {
  return flattenPlanBlocks(doc).some(
    (block) =>
      !block.isBreak &&
      (!block.isCalendarEvent || Boolean(block.googleEventId)),
  );
}

export function planGainedGoogleIds(
  before: PlanDocument,
  after: PlanDocument,
): boolean {
  const beforeIds = new Set(
    flattenPlanBlocks(before)
      .map((block) => block.googleEventId)
      .filter((id): id is string => Boolean(id)),
  );

  return flattenPlanBlocks(after).some(
    (block) => block.googleEventId && !beforeIds.has(block.googleEventId),
  );
}

export function applySyncMappingsToDocument(
  doc: PlanDocument,
  mappings: PlannerSyncResultMapping[],
): PlanDocument {
  const byBlockId = new Map(mappings.map((row) => [row.blockId, row]));

  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        const mapping = byBlockId.get(block.id);
        if (!mapping) {
          return block;
        }

        return {
          ...block,
          googleEventId: mapping.googleEventId,
          googleCalendarId: mapping.googleCalendarId,
          pushedByPlanner: mapping.pushedByPlanner,
        };
      }),
    })),
  };
}

export function mergeBlockGoogleIds(
  block: EditablePlanBlock,
  patch: {
    googleEventId: string;
    googleCalendarId: string;
    pushedByPlanner?: boolean;
  },
): EditablePlanBlock {
  const pushedByPlanner =
    patch.pushedByPlanner ?? block.pushedByPlanner ?? false;

  return {
    ...block,
    googleEventId: patch.googleEventId,
    googleCalendarId: patch.googleCalendarId,
    pushedByPlanner,
  };
}
