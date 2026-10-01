import { canvasItemsBounds, itemsInsideContainer } from './canvas-geometry';
import {
  GAP,
  NOTE_GAP,
  PHASES_ROW_Y,
  PHASE_HEADER,
  PHASE_PAD,
  TASK_GAP,
  buildLinkedCanvasItem,
  clearRegion,
} from './canvas-layout';
import {
  CANVAS_DEFAULT_SIZES,
  type CanvasItem,
  canvasItemSize,
  isLinkedCanvasKind,
} from './canvas-types';

/**
 * How phases and tasks sit on the canvas.
 * - `phase`: a column per phase, tasks stacked in board order (like the board).
 * - `status`: a column per task status.
 * - `free`: wherever each card was dropped.
 */
export type CanvasBoardView = 'phase' | 'status' | 'free';

export const CANVAS_BOARD_VIEWS: CanvasBoardView[] = [
  'phase',
  'status',
  'free',
];

export const BOARD_STATUS_COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'client_review', label: 'Review' },
  { key: 'done', label: 'Done' },
] as const;

export type BoardStatusKey = (typeof BOARD_STATUS_COLUMNS)[number]['key'];

/** Column for tasks that belong to no phase. */
export const NO_PHASE_COLUMN = '__none__';

/** Height of a status / no-phase column header (phase columns use their card). */
const COLUMN_HEADER = 52;

export function boardStatusColumn(status: string): BoardStatusKey {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'client_review':
      return 'client_review';
    case 'done':
    case 'completed':
    case 'cancelled':
    case 'canceled':
      return 'done';
    default:
      return 'todo';
  }
}

export type BoardColumn = {
  key: string;
  label: string;
  /** Phase columns: the phase. `null` for status columns and "No phase". */
  phaseId: string | null;
  /** Status columns: the status a task takes on when dropped here. */
  status: BoardStatusKey | null;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Drawn by the layout itself rather than by a phase card. */
  header: boolean;
  tasks: Array<{ itemId: string; taskId: string }>;
};

export type BoardLayoutTask = {
  id: string;
  phaseId: string | null;
  status: string;
};

export type BoardLayoutInput = {
  mode: Exclude<CanvasBoardView, 'free'>;
  projectId: string;
  /** In board order. */
  phases: Array<{ id: string; name: string }>;
  /** Top-level tasks, in board order. */
  tasks: BoardLayoutTask[];
  notes: Array<{ id: string; phaseId: string | null }>;
  items: CanvasItem[];
};

export type BoardLayoutResult = {
  /** Every item to show, with board cards at their column positions. */
  items: CanvasItem[];
  columns: BoardColumn[];
  /** Cards whose position comes from the layout, not from where they were dropped. */
  positioned: Set<string>;
};

const refKey = (kind: string, refId: string) => `${kind}:${refId}`;

/**
 * Lays phases and tasks out as board columns without touching the saved
 * positions, so switching back to the free canvas restores the old layout.
 * Anything else on the canvas that the board would cover is pushed aside.
 */
export function layoutCanvasBoard(input: BoardLayoutInput): BoardLayoutResult {
  const { mode, projectId, items } = input;
  const byRef = new Map(
    items
      .filter((item) => item.refId && isLinkedCanvasKind(item.kind))
      .map((item) => [refKey(item.kind, item.refId!), item]),
  );

  const phaseIds = new Set(input.phases.map((phase) => phase.id));
  const phaseOrder = new Map(
    input.phases.map((phase, index) => [phase.id, index]),
  );
  const taskItem = (task: BoardLayoutTask) =>
    byRef.get(refKey('task', task.id)) ??
    buildLinkedCanvasItem(
      projectId,
      { kind: 'task', refId: task.id },
      {
        x: 0,
        y: 0,
      },
    );
  const placedNote = (id: string) => byRef.get(refKey('note', id));

  type Draft = Omit<BoardColumn, 'x' | 'y' | 'w' | 'h' | 'tasks'> & {
    tasks: BoardLayoutTask[];
    notes: CanvasItem[];
  };
  const drafts: Draft[] = [];

  if (mode === 'phase') {
    for (const phase of input.phases) {
      drafts.push({
        key: phase.id,
        label: phase.name,
        phaseId: phase.id,
        status: null,
        header: false,
        tasks: input.tasks.filter((task) => task.phaseId === phase.id),
        notes: input.notes
          .filter((note) => note.phaseId === phase.id)
          .map((note) => placedNote(note.id))
          .filter((item): item is CanvasItem => Boolean(item)),
      });
    }
    const orphans = input.tasks.filter(
      (task) => !task.phaseId || !phaseIds.has(task.phaseId),
    );
    if (orphans.length > 0) {
      drafts.push({
        key: NO_PHASE_COLUMN,
        label: 'No phase',
        phaseId: null,
        status: null,
        header: true,
        tasks: orphans,
        notes: [],
      });
    }
  } else {
    const ordered = input.tasks
      .map((task, index) => ({ task, index }))
      .sort(
        (a, b) =>
          (phaseOrder.get(a.task.phaseId ?? '') ?? Number.MAX_SAFE_INTEGER) -
            (phaseOrder.get(b.task.phaseId ?? '') ?? Number.MAX_SAFE_INTEGER) ||
          a.index - b.index,
      )
      .map(({ task }) => task);
    for (const column of BOARD_STATUS_COLUMNS) {
      drafts.push({
        key: column.key,
        label: column.label,
        phaseId: null,
        status: column.key,
        header: true,
        tasks: ordered.filter(
          (task) => boardStatusColumn(task.status) === column.key,
        ),
        notes: [],
      });
    }
  }

  if (drafts.length === 0) {
    return { items, columns: [], positioned: new Set() };
  }

  const phaseItems = input.phases
    .map((phase) => byRef.get(refKey('phase', phase.id)))
    .filter((item): item is CanvasItem => Boolean(item));
  const storedTasks = input.tasks
    .map((task) => byRef.get(refKey('task', task.id)))
    .filter((item): item is CanvasItem => Boolean(item));
  const anchors = phaseItems.length > 0 ? phaseItems : storedTasks;
  const origin = (() => {
    if (anchors.length > 0) {
      return {
        x: Math.min(...anchors.map((item) => item.x)),
        y: Math.min(...anchors.map((item) => item.y)),
      };
    }
    const bounds = canvasItemsBounds(items);
    return bounds
      ? { x: bounds.x, y: bounds.y + bounds.h + GAP * 2 }
      : { x: 0, y: PHASES_ROW_Y };
  })();

  // Things dropped on a phase travel with it (phase view only).
  const arranged = new Set<string>(phaseItems.map((item) => item.id));
  for (const draft of drafts) {
    for (const task of draft.tasks) arranged.add(taskItem(task).id);
    for (const note of draft.notes) arranged.add(note.id);
  }
  const carried = new Map<string, CanvasItem[]>();
  const carriedIds = new Set<string>();
  if (mode === 'phase') {
    for (const phaseItem of phaseItems) {
      const children = itemsInsideContainer(phaseItem, items).filter(
        (child) => !arranged.has(child.id) && !carriedIds.has(child.id),
      );
      for (const child of children) carriedIds.add(child.id);
      carried.set(phaseItem.id, children);
    }
  }

  const out = new Map<string, CanvasItem>();
  const columns: BoardColumn[] = [];
  const virtual: CanvasItem[] = [];
  const hidden = new Set<string>(
    mode === 'status' ? phaseItems.map((i) => i.id) : [],
  );
  let columnX = origin.x;
  let rowBottom = origin.y;

  for (const draft of drafts) {
    const phaseItem = draft.phaseId
      ? byRef.get(refKey('phase', draft.phaseId))
      : undefined;
    const width = Math.max(
      CANVAS_DEFAULT_SIZES.phase.w,
      phaseItem && mode === 'phase' ? (phaseItem.w ?? 0) : 0,
    );
    const innerWidth = width - PHASE_PAD * 2;
    const header = draft.header ? COLUMN_HEADER : PHASE_HEADER;
    let y = origin.y + header;

    const columnTasks: BoardColumn['tasks'] = [];
    for (const task of draft.tasks) {
      const item = taskItem(task);
      const { h } = canvasItemSize(item);
      const placed = { ...item, x: columnX + PHASE_PAD, y, w: innerWidth, h };
      out.set(item.id, placed);
      if (!byRef.has(refKey('task', task.id))) virtual.push(placed);
      columnTasks.push({ itemId: item.id, taskId: task.id });
      y += h + TASK_GAP;
    }
    if (draft.tasks.length > 0 && draft.notes.length > 0) y += TASK_GAP;
    for (const note of draft.notes) {
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

    if (mode === 'phase' && draft.phaseId) {
      if (phaseItem) {
        const moved = {
          ...phaseItem,
          x: columnX,
          y: origin.y,
          w: width,
          h: height,
        };
        out.set(moved.id, moved);
        const dx = moved.x - phaseItem.x;
        const dy = moved.y - phaseItem.y;
        for (const child of carried.get(phaseItem.id) ?? []) {
          out.set(child.id, { ...child, x: child.x + dx, y: child.y + dy });
        }
      } else {
        virtual.push(
          buildLinkedCanvasItem(
            projectId,
            { kind: 'phase', refId: draft.phaseId },
            { x: columnX, y: origin.y },
            { w: width, h: height },
          ),
        );
      }
    }

    columns.push({
      key: draft.key,
      label: draft.label,
      phaseId: draft.phaseId,
      status: draft.status,
      header: draft.header,
      x: columnX,
      y: origin.y,
      w: width,
      h: height,
      tasks: columnTasks,
    });
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
    new Set([...arranged, ...carriedIds, ...hidden]),
    'right',
    out,
  );

  const shown = items
    .filter((item) => !hidden.has(item.id))
    .map((item) => out.get(item.id) ?? item);
  // Cards with no saved item yet (new tasks, phases) are shown but not stored.
  const extras = virtual;

  const positioned = new Set<string>();
  for (const draft of drafts) {
    for (const task of draft.tasks) positioned.add(taskItem(task).id);
    for (const note of draft.notes) positioned.add(note.id);
  }
  for (const item of phaseItems) positioned.add(item.id);
  for (const item of extras) positioned.add(item.id);

  return { items: [...shown, ...extras], columns, positioned };
}

/** Which column a dragged card was dropped on, and where in its stack. */
export function planBoardDrop(
  columns: BoardColumn[],
  itemsById: ReadonlyMap<string, Pick<CanvasItem, 'y' | 'h' | 'kind' | 'w'>>,
  draggedItemId: string,
  center: { x: number; y: number },
): { column: BoardColumn; index: number } | null {
  let best: BoardColumn | null = null;
  let bestDistance = Infinity;
  for (const column of columns) {
    const left = column.x - GAP / 2;
    const right = column.x + column.w + GAP / 2;
    if (center.x < left || center.x > right) continue;
    const distance = Math.abs(center.x - (column.x + column.w / 2));
    if (distance < bestDistance) {
      best = column;
      bestDistance = distance;
    }
  }
  if (!best) return null;

  let index = 0;
  for (const task of best.tasks) {
    if (task.itemId === draggedItemId) continue;
    const item = itemsById.get(task.itemId);
    if (!item) continue;
    const { h } = canvasItemSize({ kind: item.kind, w: item.w, h: item.h });
    if (item.y + h / 2 < center.y) index += 1;
  }
  return { column: best, index };
}

/** `ids` with `movedId` taken out and put back at `index` (among the rest). */
export function moveInOrder(ids: string[], movedId: string, index: number) {
  const rest = ids.filter((id) => id !== movedId);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), movedId, ...rest.slice(at)];
}

type OrderableTask = {
  id: string;
  phase_id: string | null;
  parent_task_id: string | null;
  sort_order?: number | null;
};

/**
 * Applies a reorder to a board's tasks: `orderedIds` become the top-level
 * tasks of `phaseKey`, in that order, and carry their subtasks with them.
 */
export function reorderBoardTasks<T extends OrderableTask>(
  tasksByPhase: Record<string, T[]>,
  phaseKey: string,
  phaseId: string | null,
  orderedIds: string[],
): Record<string, T[]> {
  const all = Object.values(tasksByPhase).flat();
  const byId = new Map(all.map((task) => [task.id, task]));
  const moving = new Set(orderedIds);
  const next: Record<string, T[]> = {};
  for (const [key, list] of Object.entries(tasksByPhase)) {
    next[key] = list.filter(
      (task) =>
        !moving.has(task.id) &&
        !(task.parent_task_id && moving.has(task.parent_task_id)),
    );
  }
  const stay = next[phaseKey] ?? [];
  const top = orderedIds.flatMap((id, index) => {
    const task = byId.get(id);
    return task ? [{ ...task, phase_id: phaseId, sort_order: index } as T] : [];
  });
  const children = all
    .filter((task) => task.parent_task_id && moving.has(task.parent_task_id))
    .map((task) => ({ ...task, phase_id: phaseId }) as T);
  next[phaseKey] = [...top, ...children, ...stay];
  return next;
}
