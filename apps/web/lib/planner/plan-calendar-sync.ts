import type { EditablePlanBlock, PlanDocument } from './plan-blocks';
import { flattenPlanBlocks } from './plan-blocks';

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

function minutesToIso(dateIso: string, minutes: number): string {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }
  const next = new Date(base);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next.toISOString();
}

export function blocksForCalendarSync(
  doc: PlanDocument,
  dateIso: string,
): PlannerSyncBlock[] {
  return flattenPlanBlocks(doc)
    .filter((block) => !block.isBreak)
    .map((block) => ({
      blockId: block.id,
      title: block.title,
      start: minutesToIso(dateIso, block.startMinutes),
      end: minutesToIso(dateIso, block.endMinutes),
      isCalendarEvent: block.isCalendarEvent,
      isBreak: block.isBreak,
      googleEventId: block.googleEventId ?? null,
      googleCalendarId: block.googleCalendarId ?? null,
      pushedByPlanner: block.pushedByPlanner ?? false,
    }));
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
  const pushedByPlanner = patch.pushedByPlanner ?? block.pushedByPlanner ?? false;

  return {
    ...block,
    googleEventId: patch.googleEventId,
    googleCalendarId: patch.googleCalendarId,
    pushedByPlanner,
  };
}
