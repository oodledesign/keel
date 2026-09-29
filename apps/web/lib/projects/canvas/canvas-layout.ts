import { linkedCanvasItemId } from './canvas-ids';
import {
  CANVAS_DEFAULT_SIZES,
  type CanvasItem,
  type LinkedCanvasKind,
  canvasItemSize,
  isLinkedCanvasKind,
} from './canvas-types';

/** Project entities that can appear on the canvas as live cards. */
export type CanvasLinkedEntities = {
  phases: Array<{ id: string }>;
  tasks: Array<{ id: string; phaseId: string | null }>;
  members: Array<{ id: string }>;
  clientId: string | null;
  notes: Array<{ id: string; phaseId: string | null }>;
};

export type CanvasLinkedRef = { kind: LinkedCanvasKind; refId: string };

/** Local items not yet confirmed by the server sort before any server copy. */
export const PENDING_CANVAS_TIMESTAMP = new Date(0).toISOString();

const GAP = 48;
const PHASE_HEADER = 76;
const PHASE_PAD = 20;
const TASK_GAP = 12;
const PEOPLE_ROW_Y = 0;
const PHASES_ROW_Y = 160;

export function listLinkedRefs(
  entities: CanvasLinkedEntities,
): CanvasLinkedRef[] {
  return [
    ...(entities.clientId
      ? [{ kind: 'client' as const, refId: entities.clientId }]
      : []),
    ...entities.members.map((m) => ({ kind: 'member' as const, refId: m.id })),
    ...entities.phases.map((p) => ({ kind: 'phase' as const, refId: p.id })),
    ...entities.tasks.map((t) => ({ kind: 'task' as const, refId: t.id })),
    ...entities.notes.map((n) => ({ kind: 'note' as const, refId: n.id })),
  ];
}

const refKey = (kind: string, refId: string) => `${kind}:${refId}`;

export function unplacedLinkedRefs(
  entities: CanvasLinkedEntities,
  items: CanvasItem[],
): CanvasLinkedRef[] {
  const placed = new Set(
    items
      .filter((item) => item.refId && isLinkedCanvasKind(item.kind))
      .map((item) => refKey(item.kind, item.refId!)),
  );
  return listLinkedRefs(entities).filter(
    (ref) => !placed.has(refKey(ref.kind, ref.refId)),
  );
}

/** Linked items whose source record no longer exists (deleted or unassigned). */
export function orphanedLinkedItems(
  entities: CanvasLinkedEntities,
  items: CanvasItem[],
): CanvasItem[] {
  const live = new Set(
    listLinkedRefs(entities).map((ref) => refKey(ref.kind, ref.refId)),
  );
  return items.filter(
    (item) =>
      isLinkedCanvasKind(item.kind) &&
      item.refId &&
      !live.has(refKey(item.kind, item.refId)),
  );
}

export function buildLinkedCanvasItem(
  projectId: string,
  ref: CanvasLinkedRef,
  position: { x: number; y: number },
  size?: { w: number; h: number },
): CanvasItem {
  const fallback = CANVAS_DEFAULT_SIZES[ref.kind];
  return {
    id: linkedCanvasItemId(projectId, ref.kind, ref.refId),
    kind: ref.kind,
    refId: ref.refId,
    x: Math.round(position.x),
    y: Math.round(position.y),
    w: size?.w ?? fallback.w,
    h: size?.h ?? fallback.h,
    zIndex: 0,
    data: {},
    updatedAt: PENDING_CANVAS_TIMESTAMP,
    updatedBy: null,
  };
}

function contentBounds(items: CanvasItem[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  for (const item of items) {
    if (item.kind === 'connector') continue;
    const { w } = canvasItemSize(item);
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + w);
  }
  return Number.isFinite(minX)
    ? { minX, minY, maxX }
    : { minX: 0, minY: 0, maxX: -GAP };
}

/** First-open arrangement: people across the top, phases as columns of tasks. */
function initialLayout(
  projectId: string,
  entities: CanvasLinkedEntities,
): CanvasItem[] {
  const out: CanvasItem[] = [];
  const size = CANVAS_DEFAULT_SIZES;

  let peopleX = 0;
  if (entities.clientId) {
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'client', refId: entities.clientId },
        { x: peopleX, y: PEOPLE_ROW_Y },
      ),
    );
    peopleX += size.client.w + GAP;
  }
  for (const member of entities.members) {
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'member', refId: member.id },
        { x: peopleX, y: PEOPLE_ROW_Y },
      ),
    );
    peopleX += size.member.w + 20;
  }

  const phaseIds = new Set(entities.phases.map((p) => p.id));
  let columnX = 0;

  const stackTasks = (
    tasks: CanvasLinkedEntities['tasks'],
    x: number,
    top: number,
  ) => {
    tasks.forEach((task, index) => {
      out.push(
        buildLinkedCanvasItem(
          projectId,
          { kind: 'task', refId: task.id },
          { x, y: top + index * (size.task.h + TASK_GAP) },
        ),
      );
    });
    return tasks.length * (size.task.h + TASK_GAP);
  };

  const stackNotes = (
    notes: CanvasLinkedEntities['notes'],
    x: number,
    top: number,
  ) => {
    notes.forEach((note, index) => {
      out.push(
        buildLinkedCanvasItem(
          projectId,
          { kind: 'note', refId: note.id },
          { x, y: top + index * (size.note.h + 16) },
        ),
      );
    });
  };

  for (const phase of entities.phases) {
    const tasks = entities.tasks.filter((t) => t.phaseId === phase.id);
    const stacked = stackTasks(
      tasks,
      columnX + PHASE_PAD,
      PHASES_ROW_Y + PHASE_HEADER,
    );
    const height = Math.max(size.phase.h, PHASE_HEADER + stacked + PHASE_PAD);
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'phase', refId: phase.id },
        { x: columnX, y: PHASES_ROW_Y },
        { w: size.phase.w, h: height },
      ),
    );
    stackNotes(
      entities.notes.filter((n) => n.phaseId === phase.id),
      columnX + PHASE_PAD,
      PHASES_ROW_Y + height + 24,
    );
    columnX += size.phase.w + GAP;
  }

  const loose = entities.tasks.filter(
    (t) => !t.phaseId || !phaseIds.has(t.phaseId),
  );
  if (loose.length > 0) {
    stackTasks(loose, columnX, PHASES_ROW_Y + PHASE_HEADER);
    columnX += size.task.w + GAP;
  }

  stackNotes(
    entities.notes.filter((n) => !n.phaseId || !phaseIds.has(n.phaseId)),
    columnX,
    PHASES_ROW_Y,
  );

  return out;
}

/**
 * Positions for linked entities not yet on the canvas. Empty canvas gets the
 * full arrangement; otherwise tasks slot into their phase (growing it) and
 * everything else stacks in a column right of the existing content.
 */
export function layoutUnplacedLinkedItems(
  projectId: string,
  entities: CanvasLinkedEntities,
  existing: CanvasItem[],
): { creates: CanvasItem[]; updates: CanvasItem[] } {
  const hasLinked = existing.some((item) => isLinkedCanvasKind(item.kind));
  if (!hasLinked) {
    return { creates: initialLayout(projectId, entities), updates: [] };
  }

  const missing = unplacedLinkedRefs(entities, existing);
  if (missing.length === 0) return { creates: [], updates: [] };

  const creates: CanvasItem[] = [];
  const updatedPhases = new Map<string, CanvasItem>();
  const phaseItemByRef = new Map(
    existing
      .filter((item) => item.kind === 'phase' && item.refId)
      .map((item) => [item.refId!, item]),
  );
  const taskPhase = new Map(entities.tasks.map((t) => [t.id, t.phaseId]));

  const bounds = contentBounds(existing);
  const inboxX = bounds.maxX + GAP * 2;
  let inboxY = bounds.minY;

  const all = () => [...existing, ...creates];

  for (const ref of missing) {
    const phaseId = ref.kind === 'task' ? taskPhase.get(ref.refId) : null;
    const phaseItem = phaseId
      ? (updatedPhases.get(phaseId) ?? phaseItemByRef.get(phaseId))
      : undefined;

    if (ref.kind === 'task' && phaseItem) {
      const phaseSize = canvasItemSize(phaseItem);
      const inside = all().filter(
        (item) =>
          item.kind !== 'connector' &&
          item.id !== phaseItem.id &&
          item.x >= phaseItem.x &&
          item.x < phaseItem.x + phaseSize.w &&
          item.y >= phaseItem.y &&
          item.y < phaseItem.y + phaseSize.h,
      );
      const bottom = inside.reduce(
        (max, item) => Math.max(max, item.y + canvasItemSize(item).h),
        phaseItem.y + PHASE_HEADER - TASK_GAP,
      );
      const created = buildLinkedCanvasItem(projectId, ref, {
        x: phaseItem.x + PHASE_PAD,
        y: bottom + TASK_GAP,
      });
      creates.push(created);

      const needed =
        created.y + CANVAS_DEFAULT_SIZES.task.h + PHASE_PAD - phaseItem.y;
      if (needed > phaseSize.h) {
        updatedPhases.set(phaseId!, { ...phaseItem, h: needed });
      }
      continue;
    }

    const created = buildLinkedCanvasItem(projectId, ref, {
      x: inboxX,
      y: inboxY,
    });
    creates.push(created);
    inboxY += canvasItemSize(created).h + TASK_GAP;
  }

  return { creates, updates: [...updatedPhases.values()] };
}
