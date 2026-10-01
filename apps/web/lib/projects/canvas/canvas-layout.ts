import {
  boxesOverlap,
  canvasItemBox,
  canvasItemsBounds,
  itemsInsideContainer,
} from './canvas-geometry';
import { linkedCanvasItemId } from './canvas-ids';
import {
  CANVAS_DEFAULT_SIZES,
  type CanvasItem,
  type LinkedCanvasKind,
  canvasItemSize,
  isContainerCanvasKind,
  isLinkedCanvasKind,
} from './canvas-types';

/** Project entities that can appear on the canvas as live cards. */
export type CanvasLinkedEntities = {
  phases: Array<{ id: string }>;
  tasks: Array<{ id: string; phaseId: string | null }>;
  members: Array<{ id: string }>;
  clientId: string | null;
  notes: Array<{ id: string; phaseId: string | null }>;
  contacts: Array<{ id: string }>;
  docs: Array<{ id: string }>;
};

export type CanvasLinkedRef = { kind: LinkedCanvasKind; refId: string };

/** Local items not yet confirmed by the server sort before any server copy. */
export const PENDING_CANVAS_TIMESTAMP = new Date(0).toISOString();

export const GAP = 48;
export const PHASE_HEADER = 76;
export const PHASE_PAD = 20;
export const TASK_GAP = 12;
const PEOPLE_ROW_Y = 0;
const PEOPLE_GAP = 20;
const GAP_SM = 16;
/** First open only; the rest wait in the tray. */
const INITIAL_DOC_LIMIT = 12;
export const PHASES_ROW_Y = 160;

export function listLinkedRefs(
  entities: CanvasLinkedEntities,
): CanvasLinkedRef[] {
  return [
    ...(entities.clientId
      ? [{ kind: 'client' as const, refId: entities.clientId }]
      : []),
    ...entities.contacts.map((c) => ({
      kind: 'contact' as const,
      refId: c.id,
    })),
    ...entities.members.map((m) => ({ kind: 'member' as const, refId: m.id })),
    ...entities.phases.map((p) => ({ kind: 'phase' as const, refId: p.id })),
    ...entities.tasks.map((t) => ({ kind: 'task' as const, refId: t.id })),
    ...entities.notes.map((n) => ({ kind: 'note' as const, refId: n.id })),
    ...entities.docs.map((d) => ({ kind: 'doc' as const, refId: d.id })),
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

export function contentBounds(items: CanvasItem[]) {
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
  for (const contact of entities.contacts) {
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'contact', refId: contact.id },
        { x: peopleX, y: PEOPLE_ROW_Y },
      ),
    );
    peopleX += size.contact.w + PEOPLE_GAP;
  }
  for (const member of entities.members) {
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'member', refId: member.id },
        { x: peopleX, y: PEOPLE_ROW_Y },
      ),
    );
    peopleX += size.member.w + PEOPLE_GAP;
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

  const looseNotes = entities.notes.filter(
    (n) => !n.phaseId || !phaseIds.has(n.phaseId),
  );
  stackNotes(looseNotes, columnX, PHASES_ROW_Y);
  if (looseNotes.length > 0) columnX += size.note.w + GAP;

  entities.docs.slice(0, INITIAL_DOC_LIMIT).forEach((doc, index) => {
    out.push(
      buildLinkedCanvasItem(
        projectId,
        { kind: 'doc', refId: doc.id },
        { x: columnX, y: PHASES_ROW_Y + index * (size.doc.h + TASK_GAP) },
      ),
    );
  });

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

export const NOTE_GAP = 16;

/**
 * Lays phases out as a row of columns with their task and note cards stacked
 * inside, in board order. Phases that are missing from the canvas but have
 * tasks on it are added. Anything already sitting inside a phase travels with
 * it, and other items overlapping the new row are shifted right.
 */
export function arrangeCanvasByPhase(
  projectId: string,
  entities: CanvasLinkedEntities,
  items: CanvasItem[],
): { creates: CanvasItem[]; updates: CanvasItem[] } {
  const byRef = new Map(
    items
      .filter((item) => item.refId && isLinkedCanvasKind(item.kind))
      .map((item) => [refKey(item.kind, item.refId!), item]),
  );
  const placed = <T extends { id: string }>(kind: string, list: T[]) =>
    list
      .map((entry) => byRef.get(refKey(kind, entry.id)))
      .filter((item): item is CanvasItem => Boolean(item));

  const columns = entities.phases
    .map((phase) => ({
      phaseId: phase.id,
      phaseItem: byRef.get(refKey('phase', phase.id)) ?? null,
      tasks: placed(
        'task',
        entities.tasks.filter((task) => task.phaseId === phase.id),
      ),
      notes: placed(
        'note',
        entities.notes.filter((note) => note.phaseId === phase.id),
      ),
    }))
    .filter((column) => column.phaseItem || column.tasks.length > 0);
  if (columns.length === 0) return { creates: [], updates: [] };

  const arrangedIds = new Set(
    columns.flatMap((column) => [
      ...(column.phaseItem ? [column.phaseItem.id] : []),
      ...column.tasks.map((item) => item.id),
      ...column.notes.map((item) => item.id),
    ]),
  );

  const carriedIds = new Set<string>();
  const carriedByPhase = new Map<string, CanvasItem[]>();
  for (const { phaseItem } of columns) {
    if (!phaseItem) continue;
    const children = itemsInsideContainer(phaseItem, items).filter(
      (item) => !arrangedIds.has(item.id) && !carriedIds.has(item.id),
    );
    children.forEach((child) => carriedIds.add(child.id));
    carriedByPhase.set(phaseItem.id, children);
  }

  const existingPhases = columns
    .map((column) => column.phaseItem)
    .filter((item): item is CanvasItem => Boolean(item));
  const origin = (() => {
    if (existingPhases.length > 0) {
      return {
        x: Math.min(...existingPhases.map((item) => item.x)),
        y: Math.min(...existingPhases.map((item) => item.y)),
      };
    }
    const bounds = canvasItemsBounds(items);
    return bounds
      ? { x: bounds.x, y: bounds.y + bounds.h + GAP * 2 }
      : { x: 0, y: PHASES_ROW_Y };
  })();

  const out = new Map<string, CanvasItem>();
  const creates: CanvasItem[] = [];
  let columnX = origin.x;
  let rowBottom = origin.y;

  for (const column of columns) {
    const width = Math.max(
      CANVAS_DEFAULT_SIZES.phase.w,
      column.phaseItem?.w ?? 0,
    );
    const innerWidth = width - PHASE_PAD * 2;
    let y = origin.y + PHASE_HEADER;

    for (const task of column.tasks) {
      const { h } = canvasItemSize(task);
      out.set(task.id, {
        ...task,
        x: columnX + PHASE_PAD,
        y,
        w: innerWidth,
        h,
      });
      y += h + TASK_GAP;
    }
    if (column.tasks.length > 0 && column.notes.length > 0) y += TASK_GAP;
    for (const note of column.notes) {
      const { h } = canvasItemSize(note);
      out.set(note.id, {
        ...note,
        x: columnX + PHASE_PAD,
        y,
        w: innerWidth,
        h,
      });
      y += h + NOTE_GAP;
    }

    const height = Math.max(
      CANVAS_DEFAULT_SIZES.phase.h,
      y - origin.y + PHASE_PAD,
    );
    if (column.phaseItem) {
      const moved = {
        ...column.phaseItem,
        x: columnX,
        y: origin.y,
        w: width,
        h: height,
      };
      out.set(moved.id, moved);
      const dx = moved.x - column.phaseItem.x;
      const dy = moved.y - column.phaseItem.y;
      for (const child of carriedByPhase.get(moved.id) ?? []) {
        out.set(child.id, { ...child, x: child.x + dx, y: child.y + dy });
      }
    } else {
      creates.push(
        buildLinkedCanvasItem(
          projectId,
          { kind: 'phase', refId: column.phaseId },
          { x: columnX, y: origin.y },
          { w: width, h: height },
        ),
      );
    }

    rowBottom = Math.max(rowBottom, origin.y + height);
    columnX += width + GAP;
  }

  clearRegion(
    items,
    {
      x: origin.x,
      y: origin.y,
      w: columnX - GAP - origin.x,
      h: rowBottom - origin.y,
    },
    new Set([...arrangedIds, ...carriedIds]),
    'right',
    out,
  );

  return { creates, updates: changedItems(items, out) };
}

/**
 * Moves items overlapping `region` (with any container's contents) just past
 * it. Containers wrapping arranged items are left alone.
 */
export function clearRegion(
  items: CanvasItem[],
  region: { x: number; y: number; w: number; h: number },
  arranged: Set<string>,
  direction: 'right' | 'down',
  out: Map<string, CanvasItem>,
) {
  const wrapsArranged = (item: CanvasItem) =>
    isContainerCanvasKind(item.kind) &&
    itemsInsideContainer(item, items).some((child) => arranged.has(child.id));
  const blocking = items.filter(
    (item) =>
      item.kind !== 'connector' &&
      !arranged.has(item.id) &&
      !wrapsArranged(item) &&
      boxesOverlap(canvasItemBox(item), region),
  );
  if (blocking.length === 0) return;

  const group = new Map(blocking.map((item) => [item.id, item]));
  for (const item of blocking) {
    if (!isContainerCanvasKind(item.kind)) continue;
    for (const child of itemsInsideContainer(item, items)) {
      if (!arranged.has(child.id)) group.set(child.id, child);
    }
  }
  const moved = [...group.values()];
  const shift =
    direction === 'right'
      ? region.x + region.w + GAP - Math.min(...moved.map((item) => item.x))
      : region.y + region.h + GAP - Math.min(...moved.map((item) => item.y));
  if (shift <= 0) return;
  for (const item of moved) {
    out.set(
      item.id,
      direction === 'right'
        ? { ...item, x: item.x + shift }
        : { ...item, y: item.y + shift },
    );
  }
}

function changedItems(items: CanvasItem[], out: Map<string, CanvasItem>) {
  return [...out.values()].filter((next) => {
    const before = items.find((item) => item.id === next.id);
    return (
      before &&
      (before.x !== next.x ||
        before.y !== next.y ||
        before.w !== next.w ||
        before.h !== next.h)
    );
  });
}

const TEAM_PAD = 24;
const TEAM_HEADER = 56;
const TEAM_COLUMNS = 3;
const TEAM_CARD = { w: 260, h: 104 };

/**
 * Gathers the client, project contacts and team members into a "Team"
 * section: client side on the first row(s), your team below. Reuses the
 * existing team section when there is one.
 */
export function arrangeTeamSection(
  projectId: string,
  entities: CanvasLinkedEntities,
  items: CanvasItem[],
  newSection: { id: string; zIndex: number },
): { creates: CanvasItem[]; updates: CanvasItem[] } {
  const clientSide: CanvasLinkedRef[] = [
    ...(entities.clientId
      ? [{ kind: 'client' as const, refId: entities.clientId }]
      : []),
    ...entities.contacts.map((c) => ({
      kind: 'contact' as const,
      refId: c.id,
    })),
  ];
  const team: CanvasLinkedRef[] = entities.members.map((m) => ({
    kind: 'member' as const,
    refId: m.id,
  }));
  const groups = [clientSide, team].filter((group) => group.length > 0);
  const section = items.find(
    (item) => item.kind === 'frame' && item.data.preset === 'team',
  );
  if (groups.length === 0) return { creates: [], updates: [] };

  const byRef = new Map(
    items
      .filter((item) => item.refId && isLinkedCanvasKind(item.kind))
      .map((item) => [refKey(item.kind, item.refId!), item]),
  );

  const columns = Math.max(
    2,
    Math.min(TEAM_COLUMNS, Math.max(0, ...groups.map((g) => g.length))),
  );
  const rows = groups.reduce(
    (total, group) => total + Math.ceil(group.length / TEAM_COLUMNS),
    0,
  );
  const width = TEAM_PAD * 2 + columns * TEAM_CARD.w + (columns - 1) * GAP_SM;
  const height =
    TEAM_HEADER +
    Math.max(1, rows) * (TEAM_CARD.h + GAP_SM) -
    GAP_SM +
    TEAM_PAD +
    (groups.length > 1 ? GAP_SM : 0);

  const peopleCards = [...clientSide, ...team]
    .map((ref) => byRef.get(refKey(ref.kind, ref.refId)))
    .filter((item): item is CanvasItem => Boolean(item));
  const origin = (() => {
    if (section) return { x: section.x, y: section.y };
    if (peopleCards.length > 0) {
      return {
        x: Math.min(...peopleCards.map((item) => item.x)),
        y: Math.min(...peopleCards.map((item) => item.y)),
      };
    }
    const bounds = canvasItemsBounds(items);
    return bounds
      ? { x: bounds.x, y: bounds.y - height - GAP * 2 }
      : { x: 0, y: 0 };
  })();

  const out = new Map<string, CanvasItem>();
  const creates: CanvasItem[] = [];
  const arranged = new Set<string>();

  let y = origin.y + TEAM_HEADER;
  for (const group of groups) {
    group.forEach((ref, index) => {
      const column = index % TEAM_COLUMNS;
      if (index > 0 && column === 0) y += TEAM_CARD.h + GAP_SM;
      const position = {
        x: origin.x + TEAM_PAD + column * (TEAM_CARD.w + GAP_SM),
        y,
      };
      const size = { w: TEAM_CARD.w, h: CANVAS_DEFAULT_SIZES[ref.kind].h };
      const existing = byRef.get(refKey(ref.kind, ref.refId));
      if (existing) {
        out.set(existing.id, { ...existing, ...position, ...size });
        arranged.add(existing.id);
      } else {
        const created = buildLinkedCanvasItem(projectId, ref, position, size);
        creates.push(created);
        arranged.add(created.id);
      }
    });
    y += TEAM_CARD.h + GAP_SM * 2;
  }

  const box = { ...origin, w: width, h: height };
  if (section) {
    const size = canvasItemSize(section);
    box.w = Math.max(size.w, width);
    box.h = Math.max(size.h, height);
    out.set(section.id, { ...section, w: box.w, h: box.h });
    arranged.add(section.id);
    for (const child of itemsInsideContainer(section, items)) {
      arranged.add(child.id);
    }
  } else {
    creates.push({
      id: newSection.id,
      kind: 'frame',
      refId: null,
      ...box,
      zIndex: newSection.zIndex,
      data: { title: 'Team', color: 'slate', preset: 'team' },
      updatedAt: PENDING_CANVAS_TIMESTAMP,
      updatedBy: null,
    });
  }

  clearRegion(items, box, arranged, 'down', out);
  return { creates, updates: changedItems(items, out) };
}
