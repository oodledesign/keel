import { COMMERCIAL_PIPELINE_LOST_STAGE } from '~/lib/commercial/commercial-constants';

/**
 * One manual order for the WIP ladder, board and sheet. Every view sorts with
 * these comparators, so dragging in one place is what you see in the others.
 */

type OrderedInstruction = {
  id: string;
  stage: string;
  ladderPosition?: number | null;
  boardPosition?: number | null;
};

type OrderedRequirement = {
  id: string;
  boardPosition?: number | null;
  createdAt?: string | null;
};

/**
 * Instructions: manual position first, then id so ties are stable. Fallen
 * through rows always sit after live ones in the same bucket.
 * The ladder position leads; the app keeps both position columns equal.
 */
export function compareInstructionOrder(
  a: OrderedInstruction,
  b: OrderedInstruction,
): number {
  const aFallen = a.stage === COMMERCIAL_PIPELINE_LOST_STAGE ? 1 : 0;
  const bFallen = b.stage === COMMERCIAL_PIPELINE_LOST_STAGE ? 1 : 0;
  if (aFallen !== bFallen) return aFallen - bFallen;

  const aPos = a.ladderPosition ?? a.boardPosition ?? 0;
  const bPos = b.ladderPosition ?? b.boardPosition ?? 0;
  return aPos - bPos || a.id.localeCompare(b.id);
}

/** Requirements: manual position, then newest first, then id. */
export function compareRequirementOrder(
  a: OrderedRequirement,
  b: OrderedRequirement,
): number {
  const aPos = a.boardPosition ?? 0;
  const bPos = b.boardPosition ?? 0;
  if (aPos !== bPos) return aPos - bPos;

  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime || a.id.localeCompare(b.id);
}

/** Position for a record that has just been dropped at the end of a stage. */
export function nextEndPosition(
  positions: ReadonlyArray<number | null | undefined>,
): number {
  let max = 0;
  for (const position of positions) {
    if (typeof position === 'number' && position > max) max = position;
  }
  return max + 1;
}

/**
 * Re-order the visible ids inside a full ordered list while leaving hidden
 * ids where they were. Lets a filtered view reorder without scrambling rows
 * it can't see: the visible rows swap among the slots they already occupy.
 */
export function applyVisibleReorder(
  fullOrderedIds: readonly string[],
  visibleNewOrder: readonly string[],
): string[] {
  const visible = new Set(visibleNewOrder);
  const queue = [...visibleNewOrder];
  return fullOrderedIds.map((id) =>
    visible.has(id) ? (queue.shift() ?? id) : id,
  );
}

/** Case-insensitive "contains" search across a record's visible fields. */
export function matchesWipQuery(
  query: string,
  fields: ReadonlyArray<string | number | null | undefined>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some(
    (field) => field != null && String(field).toLowerCase().includes(q),
  );
}
