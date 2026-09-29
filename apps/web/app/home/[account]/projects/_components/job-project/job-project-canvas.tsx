'use client';

import {
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnDelete,
  type OnNodeDrag,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  itemsInsideContainer,
  pickConnectorHandles,
} from '~/lib/projects/canvas/canvas-geometry';
import {
  type CanvasChange,
  applyCanvasChanges,
  emptyCanvasHistory,
  partitionCanvasChanges,
  pushCanvasHistory,
  redoCanvasHistory,
  undoCanvasHistory,
} from '~/lib/projects/canvas/canvas-history';
import { createCanvasItemId } from '~/lib/projects/canvas/canvas-ids';
import {
  type CanvasLinkedEntities,
  type CanvasLinkedRef,
  PENDING_CANVAS_TIMESTAMP,
  buildLinkedCanvasItem,
  layoutUnplacedLinkedItems,
  orphanedLinkedItems,
  unplacedLinkedRefs,
} from '~/lib/projects/canvas/canvas-layout';
import {
  canConnectCanvasItems,
  connectorsTouching,
  mergeCanvasItems,
  removeCanvasItems,
} from '~/lib/projects/canvas/canvas-merge';
import { normalizeCanvasStroke } from '~/lib/projects/canvas/canvas-path';
import {
  CANVAS_COLORS,
  CANVAS_DEFAULT_SIZES,
  type CanvasColorKey,
  type CanvasItem,
  type CanvasItemData,
  type CanvasShapeType,
  type FreeformCanvasKind,
  canvasColor,
  canvasItemSize,
  isContainerCanvasKind,
  isLinkedCanvasKind,
} from '~/lib/projects/canvas/canvas-types';

import { getErrorMessage } from '../../_lib/error-message';
import type {
  CanvasItemInput,
  ProjectCanvasNote,
} from '../../_lib/schema/project-canvas.schema';
import type {
  JobBoardResult,
  JobBoardTask,
} from '../../_lib/schema/project-phases.schema';
import {
  deleteProjectCanvasItems,
  loadProjectCanvas,
  upsertProjectCanvasItems,
} from '../../_lib/server/project-canvas.actions';
import {
  CANVAS_TOOL_SHORTCUTS,
  CanvasPenOverlay,
  CanvasPresence,
  CanvasRemoteCursors,
  CanvasSelectionBar,
  type CanvasTool,
  CanvasToolbar,
} from './canvas/canvas-chrome';
import {
  type CanvasActions,
  CanvasActionsProvider,
  type CanvasClient,
  type CanvasLookups,
  CanvasLookupsProvider,
  type CanvasNodeData,
  type CanvasPerson,
} from './canvas/canvas-context';
import {
  type CanvasEdgeData,
  canvasEdgeTypes,
  canvasNodeTypes,
} from './canvas/canvas-nodes';
import {
  CANVAS_TRAY_DRAG_TYPE,
  CanvasTray,
  type CanvasTrayEntry,
} from './canvas/canvas-tray';
import {
  canvasPeerColor,
  useProjectCanvasRealtime,
} from './canvas/use-project-canvas-realtime';
import { JobProjectTaskSheet } from './job-project-task-sheet';

type FlowNode = Node<CanvasNodeData>;
type FlowEdge = Edge<CanvasEdgeData>;

type JobProjectCanvasProps = {
  accountId: string;
  accountSlug: string;
  jobId: string;
  board: JobBoardResult;
  canEdit: boolean;
  onBoardChange: (board: JobBoardResult) => void;
  onRefreshBoard: () => Promise<void>;
};

const UPSERT_CHUNK = 300;
const DELETE_CHUNK = 500;
const DUPLICATE_OFFSET = 24;

const TEXT_EDIT_KINDS = new Set(['sticky', 'text', 'shape', 'frame']);
const PLACE_TOOLS: Partial<Record<CanvasTool, FreeformCanvasKind>> = {
  sticky: 'sticky',
  text: 'text',
  shape: 'shape',
  frame: 'frame',
};
const COLOR_MODE: Partial<Record<CanvasItem['kind'], 'fill' | 'stroke'>> = {
  sticky: 'fill',
  shape: 'fill',
  frame: 'fill',
  text: 'stroke',
  draw: 'stroke',
  connector: 'stroke',
};
const DATA_KEYS = [
  'text',
  'color',
  'shape',
  'points',
  'strokeWidth',
  'url',
  'title',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'label',
] as const satisfies ReadonlyArray<keyof CanvasItemData>;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** In-flight write counts per item; resync keeps local copies while > 0. */
type PendingCounts = Map<string, number>;

function isPending(counts: PendingCounts, id: string) {
  return (counts.get(id) ?? 0) > 0;
}

function markPending(counts: PendingCounts, ids: string[], delta: 1 | -1) {
  for (const id of ids) {
    const next = (counts.get(id) ?? 0) + delta;
    if (next > 0) counts.set(id, next);
    else counts.delete(id);
  }
}

function toPayload(item: CanvasItem): CanvasItemInput {
  const data: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    if (item.data[key] !== undefined) data[key] = item.data[key];
  }
  return {
    id: item.id,
    kind: item.kind,
    refId: item.refId,
    x: round1(item.x),
    y: round1(item.y),
    w: item.w && item.w > 0 ? round1(item.w) : null,
    h: item.h && item.h > 0 ? round1(item.h) : null,
    zIndex: item.zIndex,
    data: data as CanvasItemInput['data'],
  };
}

function replaceBoardTask(
  board: JobBoardResult,
  task: JobBoardTask,
): JobBoardResult {
  const tasksByPhase = Object.fromEntries(
    Object.entries(board.tasksByPhase).map(([key, list]) => [
      key,
      list.map((existing) =>
        existing.id === task.id ? { ...existing, ...task } : existing,
      ),
    ]),
  );
  return { ...board, tasksByPhase };
}

function nextZIndex(items: CanvasItem[], container: boolean) {
  return (
    items
      .filter(
        (item) =>
          item.kind !== 'connector' &&
          isContainerCanvasKind(item.kind) === container,
      )
      .reduce((max, item) => Math.max(max, item.zIndex), 0) + 1
  );
}

function newFreeformItem(
  kind: FreeformCanvasKind | 'connector',
  center: { x: number; y: number },
  data: CanvasItemData,
  zIndex: number,
): CanvasItem {
  const size = kind === 'connector' ? null : CANVAS_DEFAULT_SIZES[kind];
  return {
    id: createCanvasItemId(),
    kind,
    refId: null,
    x: size ? center.x - size.w / 2 : 0,
    y: size ? center.y - size.h / 2 : 0,
    w: size?.w ?? null,
    h: size?.h ?? null,
    zIndex,
    data,
    updatedAt: PENDING_CANVAS_TIMESTAMP,
    updatedBy: null,
  };
}

function isLinkedPresent(item: CanvasItem, lookups: CanvasLookups) {
  const id = item.refId ?? '';
  switch (item.kind) {
    case 'phase':
      return lookups.phasesById.has(id);
    case 'task':
      return lookups.tasksById.has(id);
    case 'member':
      return lookups.teamById.has(id);
    case 'client':
      return lookups.client?.id === id;
    case 'note':
      return lookups.notesById.has(id);
    default:
      return true;
  }
}

function minimapColor(node: Node) {
  const item = (node.data as CanvasNodeData | undefined)?.item;
  if (!item) return 'var(--workspace-shell-border)';
  if (item.kind === 'sticky' || item.kind === 'shape') {
    return canvasColor(item.data.color, 'yellow').fill;
  }
  if (item.kind === 'phase' || item.kind === 'frame') return 'transparent';
  if (item.kind === 'draw') return canvasColor(item.data.color, 'plum').stroke;
  return 'var(--ozer-accent)';
}

export function JobProjectCanvas(props: JobProjectCanvasProps) {
  return (
    <ReactFlowProvider>
      <ProjectCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ProjectCanvasInner({
  accountId,
  accountSlug,
  jobId,
  board,
  canEdit,
  onBoardChange,
  onRefreshBoard,
}: JobProjectCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { resolvedTheme } = useTheme();
  const { data: user } = useUser();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [available, setAvailable] = useState(true);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [notes, setNotes] = useState<ProjectCanvasNote[]>([]);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [history, setHistory] = useState(emptyCanvasHistory);
  const [tool, setTool] = useState<CanvasTool>('select');
  const [penColor, setPenColor] = useState<CanvasColorKey>('plum');
  const [penWidth, setPenWidth] = useState(4);
  const [shapeType, setShapeType] = useState<CanvasShapeType>('rectangle');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageTitle, setImageTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const itemsRef = useRef<CanvasItem[]>([]);
  const pendingCounts = useRef(new Map<string, number>());
  const versions = useRef(new Map<string, number>());
  const interactingIds = useRef(new Set<string>());
  const dragRef = useRef<{
    start: { x: number; y: number };
    children: Map<string, { x: number; y: number }>;
  } | null>(null);
  const initialisedRef = useRef(false);
  const fittedRef = useRef(false);

  const editable = canEdit && available;

  const updateItems = useCallback(
    (fn: (prev: CanvasItem[]) => CanvasItem[]) => {
      const next = fn(itemsRef.current);
      if (next === itemsRef.current) return;
      itemsRef.current = next;
      setItems(next);
    },
    [],
  );

  const resync = useCallback(async () => {
    try {
      const snapshot = await loadProjectCanvas({ accountId, jobId });
      setAvailable(snapshot.available);
      setNotes(snapshot.notes);
      updateItems((prev) => {
        const local = prev.filter((item) =>
          isPending(pendingCounts.current, item.id),
        );
        const localIds = new Set(local.map((item) => item.id));
        return [
          ...snapshot.items.filter((item) => !localIds.has(item.id)),
          ...local,
        ];
      });
      setStatus('ready');
      return snapshot;
    } catch {
      setStatus((prev) => (prev === 'loading' ? 'error' : prev));
      return null;
    }
  }, [accountId, jobId, updateItems]);

  useEffect(() => {
    void resync();
  }, [resync]);

  const allTasks = useMemo(
    () => Object.values(board.tasksByPhase).flat(),
    [board.tasksByPhase],
  );

  const lookups = useMemo<CanvasLookups>(() => {
    const tasksById = new Map(allTasks.map((task) => [task.id, task]));
    const subtaskCounts = new Map<string, { total: number; done: number }>();
    const openTaskCountByPerson = new Map<string, number>();
    for (const task of allTasks) {
      if (task.parent_task_id) {
        const counts = subtaskCounts.get(task.parent_task_id) ?? {
          total: 0,
          done: 0,
        };
        counts.total += 1;
        if (task.status === 'done') counts.done += 1;
        subtaskCounts.set(task.parent_task_id, counts);
        continue;
      }
      const owner = task.user_id ?? task.assignee_contact_id;
      if (owner && task.status !== 'done' && task.status !== 'cancelled') {
        openTaskCountByPerson.set(
          owner,
          (openTaskCountByPerson.get(owner) ?? 0) + 1,
        );
      }
    }

    const peopleById = new Map<string, CanvasPerson>();
    for (const member of board.members) {
      peopleById.set(member.user_id, {
        id: member.user_id,
        name: member.name,
        email: member.email,
        pictureUrl: member.picture_url ?? null,
      });
    }
    for (const contact of board.contactAssignees ?? []) {
      peopleById.set(contact.id, {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        pictureUrl: contact.picture_url,
      });
    }

    const teamById = new Map<string, CanvasPerson>(
      board.assignees.map((assignee) => [
        assignee.user_id,
        {
          id: assignee.user_id,
          name: assignee.name,
          email: assignee.email,
          pictureUrl: assignee.picture_url,
          role: assignee.role_on_job,
        },
      ]),
    );

    const clientRow = board.client as Record<string, unknown> | null;
    const client: CanvasClient | null =
      clientRow && typeof clientRow.id === 'string'
        ? {
            id: clientRow.id,
            displayName: (clientRow.display_name as string | null) ?? null,
            companyName: (clientRow.company_name as string | null) ?? null,
            email: (clientRow.email as string | null) ?? null,
            pictureUrl: (clientRow.picture_url as string | null) ?? null,
          }
        : null;

    return {
      accountSlug,
      jobId,
      canEdit: editable,
      phasesById: new Map(board.phases.map((phase) => [phase.id, phase])),
      tasksById,
      subtaskCounts,
      peopleById,
      teamById,
      openTaskCountByPerson,
      client,
      notesById: new Map(notes.map((note) => [note.id, note])),
    };
  }, [
    accountSlug,
    allTasks,
    board.assignees,
    board.client,
    board.contactAssignees,
    board.members,
    board.phases,
    editable,
    jobId,
    notes,
  ]);

  const entities = useMemo<CanvasLinkedEntities>(
    () => ({
      phases: board.phases.map((phase) => ({ id: phase.id })),
      tasks: allTasks
        .filter((task) => !task.parent_task_id)
        .map((task) => ({ id: task.id, phaseId: task.phase_id })),
      members: board.assignees.map((assignee) => ({ id: assignee.user_id })),
      clientId: lookups.client?.id ?? null,
      notes: notes.map((note) => ({ id: note.id, phaseId: note.phaseId })),
    }),
    [allTasks, board.assignees, board.phases, lookups.client, notes],
  );

  const me = useMemo(() => {
    if (!user?.id) return null;
    const member = board.members.find((m) => m.user_id === user.id);
    return {
      userId: user.id,
      name: member?.name || member?.email || user.email || 'Teammate',
      pictureUrl: member?.picture_url ?? null,
    };
  }, [board.members, user?.email, user?.id]);

  const realtime = useProjectCanvasRealtime({
    projectId: jobId,
    me,
    onRemoteItems: (incoming) =>
      updateItems((prev) =>
        mergeCanvasItems(
          prev,
          incoming.filter((item) => !isPending(pendingCounts.current, item.id)),
        ),
      ),
    onRemoteDeletes: (ids) =>
      updateItems((prev) => removeCanvasItems(prev, ids)),
    onLinkedDataChanged: () => {
      void onRefreshBoard();
      void resync();
    },
    onResync: () => void resync(),
  });

  const { broadcastItems, broadcastDeletes, broadcastDrag, broadcastDragEnd } =
    realtime;

  const persist = useCallback(
    async (changes: CanvasChange[]) => {
      const { upserts, deletes } = partitionCanvasChanges(changes);
      const sentVersions = new Map(
        upserts.map((item) => [item.id, versions.current.get(item.id) ?? 0]),
      );
      const ids = [...upserts.map((item) => item.id), ...deletes];
      markPending(pendingCounts.current, ids, 1);
      try {
        for (const part of chunk(upserts, UPSERT_CHUNK)) {
          const saved = await upsertProjectCanvasItems({
            accountId,
            jobId,
            items: part.map(toPayload),
          });
          const fresh = saved.filter(
            (item) =>
              (versions.current.get(item.id) ?? 0) ===
              sentVersions.get(item.id),
          );
          updateItems((prev) => mergeCanvasItems(prev, fresh, { force: true }));
          broadcastItems(fresh);
        }
        for (const part of chunk(deletes, DELETE_CHUNK)) {
          await deleteProjectCanvasItems({ accountId, jobId, ids: part });
          broadcastDeletes(part);
        }
      } catch (error) {
        toast.error(getErrorMessage(error));
        markPending(pendingCounts.current, ids, -1);
        void resync();
        return;
      }
      markPending(pendingCounts.current, ids, -1);
    },
    [accountId, broadcastDeletes, broadcastItems, jobId, resync, updateItems],
  );

  const commit = useCallback(
    (changes: CanvasChange[], options: { record?: boolean } = {}) => {
      if (!editable) return;
      const effective = changes.filter(
        (change) => change.before !== change.after,
      );
      if (effective.length === 0) return;
      for (const change of effective) {
        const id = (change.after ?? change.before)!.id;
        versions.current.set(id, (versions.current.get(id) ?? 0) + 1);
      }
      updateItems((prev) => applyCanvasChanges(prev, effective));
      if (options.record !== false) {
        setHistory((prev) => pushCanvasHistory(prev, effective));
      }
      void persist(effective);
    },
    [editable, persist, updateItems],
  );

  const itemById = useCallback(
    (id: string) => itemsRef.current.find((item) => item.id === id),
    [],
  );

  const removeItems = useCallback(
    (ids: string[]) => {
      const current = itemsRef.current;
      const drop = new Set(ids);
      for (const connector of connectorsTouching(current, ids)) {
        drop.add(connector.id);
      }
      commit(
        current
          .filter((item) => drop.has(item.id))
          .map((before) => ({ before, after: null })),
      );
    },
    [commit],
  );

  const patchItems = useCallback(
    (patches: Array<{ id: string; patch: Partial<CanvasItem> }>) => {
      const changes: CanvasChange[] = [];
      for (const { id, patch } of patches) {
        const before = itemById(id);
        if (before) changes.push({ before, after: { ...before, ...patch } });
      }
      commit(changes);
    },
    [commit, itemById],
  );

  // First load: tidy cards whose source is gone, then lay out an empty canvas.
  useEffect(() => {
    if (status !== 'ready' || initialisedRef.current) return;
    initialisedRef.current = true;
    if (!editable) return;

    const current = itemsRef.current;
    const orphans = orphanedLinkedItems(entities, current);
    if (orphans.length > 0) {
      const drop = new Set(orphans.map((item) => item.id));
      for (const connector of connectorsTouching(current, drop)) {
        drop.add(connector.id);
      }
      commit(
        current
          .filter((item) => drop.has(item.id))
          .map((before) => ({ before, after: null })),
        { record: false },
      );
    }

    if (current.length > 0) return;
    const { creates } = layoutUnplacedLinkedItems(jobId, entities, []);
    if (creates.length === 0) return;

    updateItems((prev) => mergeCanvasItems(prev, creates));
    const ids = creates.map((item) => item.id);
    markPending(pendingCounts.current, ids, 1);
    void (async () => {
      try {
        for (const part of chunk(creates, UPSERT_CHUNK)) {
          await upsertProjectCanvasItems({
            accountId,
            jobId,
            items: part.map(toPayload),
            ignoreExisting: true,
          });
        }
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        markPending(pendingCounts.current, ids, -1);
        const snapshot = await resync();
        const created = new Set(ids);
        broadcastItems(
          snapshot?.items.filter((item) => created.has(item.id)) ?? [],
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once after the first load
  }, [status]);

  const displayItems = useMemo(() => {
    if (!available) {
      return layoutUnplacedLinkedItems(jobId, entities, []).creates;
    }
    return items.filter(
      (item) =>
        !isLinkedCanvasKind(item.kind) || isLinkedPresent(item, lookups),
    );
  }, [available, entities, items, jobId, lookups]);

  useEffect(() => {
    const remoteDrags = realtime.remoteDrags;
    setNodes((prev) => {
      const prevById = new Map(prev.map((node) => [node.id, node]));
      return displayItems
        .filter((item) => item.kind !== 'connector')
        .map((item) => {
          const old = prevById.get(item.id);
          const size = canvasItemSize(item);
          const node: FlowNode = {
            id: item.id,
            type: item.kind,
            position: { x: item.x, y: item.y },
            width: size.w,
            height: size.h,
            zIndex: isContainerCanvasKind(item.kind)
              ? item.zIndex
              : 1000 + item.zIndex,
            data: { item },
            selected: old?.selected ?? false,
            measured: old?.measured,
            style: item.kind === 'draw' ? { pointerEvents: 'none' } : undefined,
            className:
              connectFrom === item.id
                ? 'rounded-xl ring-2 ring-[var(--ozer-accent)] ring-offset-2'
                : undefined,
          };
          if (old && interactingIds.current.has(item.id)) {
            node.position = old.position;
            node.width = old.width;
            node.height = old.height;
          } else if (remoteDrags[item.id]) {
            node.position = {
              x: remoteDrags[item.id]!.x,
              y: remoteDrags[item.id]!.y,
            };
          }
          return node;
        });
    });
  }, [connectFrom, displayItems, realtime.remoteDrags]);

  useEffect(() => {
    const nodeIds = new Set(
      displayItems
        .filter((item) => item.kind !== 'connector')
        .map((item) => item.id),
    );
    setEdges((prev) => {
      const selected = new Set(
        prev.filter((edge) => edge.selected).map((edge) => edge.id),
      );
      return displayItems
        .filter(
          (item) =>
            item.kind === 'connector' &&
            item.data.source &&
            item.data.target &&
            nodeIds.has(item.data.source) &&
            nodeIds.has(item.data.target),
        )
        .map((item) => {
          const color = canvasColor(item.data.color, 'slate').stroke;
          return {
            id: item.id,
            source: item.data.source!,
            target: item.data.target!,
            sourceHandle: item.data.sourceHandle ?? 'right',
            targetHandle: item.data.targetHandle ?? 'left',
            type: 'connector',
            data: { item },
            selected: selected.has(item.id),
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color,
              width: 18,
              height: 18,
            },
          };
        });
    });
  }, [displayItems]);

  useEffect(() => {
    if (fittedRef.current || nodes.length === 0) return;
    fittedRef.current = true;
    const frame = requestAnimationFrame(() =>
      fitView({ padding: 0.15, maxZoom: 1 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [fitView, nodes.length]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((prev) =>
      applyNodeChanges(
        changes.filter((change) => change.type !== 'remove'),
        prev,
      ),
    );
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges((prev) =>
      applyEdgeChanges(
        changes.filter((change) => change.type !== 'remove'),
        prev,
      ),
    );
  }, []);

  const onNodeDragStart: OnNodeDrag<FlowNode> = useCallback(
    (_event, node, dragged) => {
      const draggedIds = new Set(dragged.map((n) => n.id));
      const current = itemsRef.current;
      const children = new Map<string, { x: number; y: number }>();
      for (const draggedNode of dragged) {
        const item = current.find((i) => i.id === draggedNode.id);
        if (!item || !isContainerCanvasKind(item.kind)) continue;
        for (const child of itemsInsideContainer(item, current)) {
          if (!draggedIds.has(child.id)) {
            children.set(child.id, { x: child.x, y: child.y });
          }
        }
      }
      dragRef.current = { start: { ...node.position }, children };
      for (const id of [...draggedIds, ...children.keys()]) {
        interactingIds.current.add(id);
      }
    },
    [],
  );

  const onNodeDrag: OnNodeDrag<FlowNode> = useCallback(
    (_event, node, dragged) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = node.position.x - drag.start.x;
      const dy = node.position.y - drag.start.y;
      if (drag.children.size > 0) {
        setNodes((prev) =>
          prev.map((n) => {
            const start = drag.children.get(n.id);
            return start
              ? { ...n, position: { x: start.x + dx, y: start.y + dy } }
              : n;
          }),
        );
      }
      broadcastDrag([
        ...dragged.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
        ...[...drag.children].map(([id, start]) => ({
          id,
          x: start.x + dx,
          y: start.y + dy,
        })),
      ]);
    },
    [broadcastDrag],
  );

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_event, node, dragged) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const positions = new Map(dragged.map((n) => [n.id, n.position]));
      if (drag) {
        const dx = node.position.x - drag.start.x;
        const dy = node.position.y - drag.start.y;
        for (const [id, start] of drag.children) {
          positions.set(id, { x: start.x + dx, y: start.y + dy });
        }
      }
      const changes: CanvasChange[] = [];
      for (const [id, position] of positions) {
        const before = itemById(id);
        if (!before || (before.x === position.x && before.y === position.y)) {
          continue;
        }
        changes.push({
          before,
          after: { ...before, x: position.x, y: position.y },
        });
      }
      const ids = [...positions.keys()];
      commit(changes);
      for (const id of ids) interactingIds.current.delete(id);
      broadcastDragEnd(ids);
    },
    [broadcastDragEnd, commit, itemById],
  );

  const onDelete: OnDelete<FlowNode, FlowEdge> = useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      removeItems([
        ...deletedNodes.map((node) => node.id),
        ...deletedEdges.map((edge) => edge.id),
      ]);
    },
    [removeItems],
  );

  const addConnector = useCallback(
    (
      source: string,
      target: string,
      handles?: { sourceHandle?: string | null; targetHandle?: string | null },
    ) => {
      const current = itemsRef.current;
      if (!canConnectCanvasItems(current, source, target)) return;
      const a = itemById(source)!;
      const b = itemById(target)!;
      const picked = pickConnectorHandles(a, b);
      commit([
        {
          before: null,
          after: newFreeformItem(
            'connector',
            { x: 0, y: 0 },
            {
              source,
              target,
              sourceHandle: handles?.sourceHandle ?? picked.sourceHandle,
              targetHandle: handles?.targetHandle ?? picked.targetHandle,
              color: 'slate',
            },
            0,
          ),
        },
      ]);
    },
    [commit, itemById],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      addConnector(connection.source, connection.target, {
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
    },
    [addConnector],
  );

  const viewportCenter = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, [screenToFlowPosition]);

  const placeFreeform = useCallback(
    (kind: FreeformCanvasKind, center: { x: number; y: number }) => {
      const defaults: Partial<Record<FreeformCanvasKind, CanvasItemData>> = {
        sticky: { text: '', color: 'yellow' },
        text: { text: '' },
        shape: { text: '', shape: shapeType, color: 'blue' },
        frame: { title: 'Frame', color: 'slate' },
      };
      const item = newFreeformItem(
        kind,
        center,
        defaults[kind] ?? {},
        nextZIndex(itemsRef.current, isContainerCanvasKind(kind)),
      );
      commit([{ before: null, after: item }]);
      if (TEXT_EDIT_KINDS.has(kind)) setEditingId(item.id);
      return item;
    },
    [commit, shapeType],
  );

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!editable) return;
      if (tool === 'connect') {
        setConnectFrom(null);
        return;
      }
      const kind = PLACE_TOOLS[tool];
      if (!kind) return;
      placeFreeform(
        kind,
        screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
      setTool('select');
    },
    [editable, placeFreeform, screenToFlowPosition, tool],
  );

  const onStroke = useCallback(
    (points: Array<[number, number]>) => {
      const stroke = normalizeCanvasStroke(points, penWidth);
      commit([
        {
          before: null,
          after: {
            id: createCanvasItemId(),
            kind: 'draw',
            refId: null,
            x: stroke.x,
            y: stroke.y,
            w: Math.max(stroke.w, 1),
            h: Math.max(stroke.h, 1),
            zIndex: nextZIndex(itemsRef.current, false),
            data: {
              points: stroke.points,
              color: penColor,
              strokeWidth: penWidth,
            },
            updatedAt: PENDING_CANVAS_TIMESTAMP,
            updatedBy: null,
          },
        },
      ]);
    },
    [commit, penColor, penWidth],
  );

  const openTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const onNodeClick = useCallback(
    (_event: ReactMouseEvent, node: FlowNode) => {
      if (!editable) return;
      if (tool === 'connect') {
        if (!connectFrom) {
          setConnectFrom(node.id);
        } else {
          addConnector(connectFrom, node.id);
          setConnectFrom(null);
        }
        return;
      }
      if (tool === 'eraser' && node.type === 'draw') removeItems([node.id]);
    },
    [addConnector, connectFrom, editable, removeItems, tool],
  );

  const onNodeMouseEnter = useCallback(
    (event: ReactMouseEvent, node: FlowNode) => {
      if (
        editable &&
        tool === 'eraser' &&
        event.buttons === 1 &&
        node.type === 'draw'
      ) {
        removeItems([node.id]);
      }
    },
    [editable, removeItems, tool],
  );

  const onNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: FlowNode) => {
      if (node.type === 'task' && node.data.item.refId) {
        openTask(node.data.item.refId);
      } else if (editable && TEXT_EDIT_KINDS.has(node.type ?? '')) {
        setEditingId(node.id);
      }
    },
    [editable, openTask],
  );

  const placeLinked = useCallback(
    (ref: CanvasLinkedRef, center: { x: number; y: number }) => {
      const size = CANVAS_DEFAULT_SIZES[ref.kind];
      const item = buildLinkedCanvasItem(jobId, ref, {
        x: center.x - size.w / 2,
        y: center.y - size.h / 2,
      });
      if (itemById(item.id)) return;
      commit([{ before: null, after: item }]);
    },
    [commit, itemById, jobId],
  );

  const placeAllLinked = useCallback(() => {
    const { creates, updates } = layoutUnplacedLinkedItems(
      jobId,
      entities,
      itemsRef.current,
    );
    commit([
      ...creates.map((after) => ({ before: null, after })),
      ...updates.map((after) => ({
        before: itemById(after.id) ?? null,
        after,
      })),
    ]);
  }, [commit, entities, itemById, jobId]);

  const trayEntries = useMemo<CanvasTrayEntry[]>(() => {
    if (!available) return [];
    return unplacedLinkedRefs(entities, items).map((ref) => {
      const id = ref.refId;
      const label =
        ref.kind === 'phase'
          ? lookups.phasesById.get(id)?.name
          : ref.kind === 'task'
            ? lookups.tasksById.get(id)?.title
            : ref.kind === 'member'
              ? lookups.teamById.get(id)?.name ||
                lookups.teamById.get(id)?.email
              : ref.kind === 'client'
                ? lookups.client?.displayName || lookups.client?.companyName
                : lookups.notesById.get(id)?.title || 'Untitled note';
      return { ...ref, label: label || 'Untitled' };
    });
  }, [available, entities, items, lookups]);

  const onDragOver = useCallback((event: DragEvent) => {
    if (event.dataTransfer.types.includes(CANVAS_TRAY_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      const raw = event.dataTransfer.getData(CANVAS_TRAY_DRAG_TYPE);
      if (!raw || !editable) return;
      event.preventDefault();
      try {
        const ref = JSON.parse(raw) as { kind?: string; refId?: string };
        if (!ref.kind || !isLinkedCanvasKind(ref.kind) || !ref.refId) return;
        placeLinked(
          { kind: ref.kind, refId: ref.refId },
          screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        );
      } catch {
        // Ignore drops that aren't tray entries.
      }
    },
    [editable, placeLinked, screenToFlowPosition],
  );

  const selectedIds = useMemo(
    () => [
      ...nodes.filter((node) => node.selected).map((node) => node.id),
      ...edges.filter((edge) => edge.selected).map((edge) => edge.id),
    ],
    [edges, nodes],
  );
  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is CanvasItem => Boolean(item)),
    [items, selectedIds],
  );

  const undo = useCallback(() => {
    const result = undoCanvasHistory(history);
    if (!result) return;
    setHistory(result.history);
    commit(result.changes, { record: false });
  }, [commit, history]);

  const redo = useCallback(() => {
    const result = redoCanvasHistory(history);
    if (!result) return;
    setHistory(result.history);
    commit(result.changes, { record: false });
  }, [commit, history]);

  const duplicateSelection = useCallback(() => {
    const sources = selectedItems.filter(
      (item) => !isLinkedCanvasKind(item.kind) && item.kind !== 'connector',
    );
    if (sources.length === 0) return;
    const idMap = new Map<string, string>();
    const clones: CanvasItem[] = sources.map((item) => {
      const id = createCanvasItemId();
      idMap.set(item.id, id);
      return {
        ...item,
        id,
        x: item.x + DUPLICATE_OFFSET,
        y: item.y + DUPLICATE_OFFSET,
        updatedAt: PENDING_CANVAS_TIMESTAMP,
      };
    });
    const connectorClones = itemsRef.current
      .filter(
        (item) =>
          item.kind === 'connector' &&
          idMap.has(item.data.source ?? '') &&
          idMap.has(item.data.target ?? ''),
      )
      .map((item) => ({
        ...item,
        id: createCanvasItemId(),
        data: {
          ...item.data,
          source: idMap.get(item.data.source!)!,
          target: idMap.get(item.data.target!)!,
        },
        updatedAt: PENDING_CANVAS_TIMESTAMP,
      }));
    commit(
      [...clones, ...connectorClones].map((after) => ({ before: null, after })),
    );
  }, [commit, selectedItems]);

  const bringToFront = useCallback(() => {
    const current = itemsRef.current;
    patchItems(
      selectedItems
        .filter((item) => item.kind !== 'connector')
        .map((item, index) => ({
          id: item.id,
          patch: {
            zIndex:
              nextZIndex(current, isContainerCanvasKind(item.kind)) + index,
          },
        })),
    );
  }, [patchItems, selectedItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      if (selectedTaskId || imageOpen) return;

      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === 'd') {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod || event.altKey) return;
      if (event.key === 'Escape') {
        setTool('select');
        setConnectFrom(null);
        return;
      }
      const next = CANVAS_TOOL_SHORTCUTS[key];
      if (next && (editable || next === 'select' || next === 'hand')) {
        setTool(next);
        setConnectFrom(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duplicateSelection, editable, imageOpen, redo, selectedTaskId, undo]);

  const actions = useMemo<CanvasActions>(
    () => ({
      updateItemData: (id, patch) => {
        const before = itemById(id);
        if (!before) return;
        commit([
          { before, after: { ...before, data: { ...before.data, ...patch } } },
        ]);
      },
      resizeItem: (id, box) =>
        patchItems([
          { id, patch: { x: box.x, y: box.y, w: box.width, h: box.height } },
        ]),
      openTask,
      editingId,
      setEditingId,
    }),
    [commit, editingId, itemById, openTask, patchItems],
  );

  const submitImage = () => {
    const url = imageUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Enter a link starting with http:// or https://');
      return;
    }
    const center = viewportCenter();
    commit([
      {
        before: null,
        after: newFreeformItem(
          'image',
          center,
          { url, title: imageTitle.trim() || undefined },
          nextZIndex(itemsRef.current, false),
        ),
      },
    ]);
    setImageOpen(false);
    setImageUrl('');
    setImageTitle('');
  };

  const selectedTask = selectedTaskId
    ? (lookups.tasksById.get(selectedTaskId) ?? null)
    : null;

  const selectionBar = (() => {
    if (!editable || tool !== 'select' || selectedItems.length === 0) {
      return null;
    }
    const colorModes = selectedItems.map((item) => COLOR_MODE[item.kind]);
    const showColor = colorModes.every(Boolean);
    const single = selectedItems.length === 1 ? selectedItems[0]! : null;
    const allLinked = selectedItems.every((item) =>
      isLinkedCanvasKind(item.kind),
    );
    return (
      <CanvasSelectionBar
        key={`${selectedIds.join(',')}:${single?.data.label ?? ''}`}
        count={selectedItems.length}
        showColor={showColor}
        colorMode={
          colorModes.every((mode) => mode === 'stroke') ? 'stroke' : 'fill'
        }
        color={selectedItems[0]?.data.color}
        onColorChange={(color) =>
          patchItems(
            selectedItems
              .filter((item) => COLOR_MODE[item.kind])
              .map((item) => ({
                id: item.id,
                patch: { data: { ...item.data, color } },
              })),
          )
        }
        shape={
          single?.kind === 'shape'
            ? (single.data.shape ?? 'rectangle')
            : undefined
        }
        onShapeChange={
          single?.kind === 'shape'
            ? (shape) => actions.updateItemData(single.id, { shape })
            : undefined
        }
        label={
          single?.kind === 'connector' ? (single.data.label ?? '') : undefined
        }
        onLabelChange={
          single?.kind === 'connector'
            ? (label) => actions.updateItemData(single.id, { label })
            : undefined
        }
        canDuplicate={selectedItems.some(
          (item) => !isLinkedCanvasKind(item.kind) && item.kind !== 'connector',
        )}
        removeLabel={allLinked ? 'Remove from canvas' : 'Delete'}
        onBringToFront={bringToFront}
        onDuplicate={duplicateSelection}
        onDelete={() => removeItems(selectedIds)}
        onOpenTask={
          single?.kind === 'task' && single.refId
            ? () => openTask(single.refId!)
            : undefined
        }
      />
    );
  })();

  const presenceMe = me ? { ...me, color: canvasPeerColor(me.userId) } : null;
  const placing = Boolean(PLACE_TOOLS[tool]) || tool === 'connect';

  if (status === 'loading') {
    return (
      <div className="h-[calc(100vh-15rem)] min-h-[560px] animate-pulse rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40" />
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] text-sm text-[var(--workspace-shell-text-muted)]">
        Could not load the canvas.
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setStatus('loading');
            void resync();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <CanvasLookupsProvider value={lookups}>
      <CanvasActionsProvider value={actions}>
        <div className="flex flex-col gap-2">
          {!available ? (
            <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
              Canvas saving isn&apos;t switched on yet — apply the project
              canvas database migration. Showing a live read-only preview of
              this project.
            </p>
          ) : null}

          <div
            className="flex h-[calc(100vh-15rem)] min-h-[560px] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]"
            data-test="project-canvas"
          >
            {trayOpen && editable ? (
              <CanvasTray
                entries={trayEntries}
                onClose={() => setTrayOpen(false)}
                onPlace={(entry) => placeLinked(entry, viewportCenter())}
                onPlaceAll={placeAllLinked}
              />
            ) : null}

            <div
              ref={wrapperRef}
              className={cn(
                'relative min-w-0 flex-1 bg-[var(--ozer-surface-canvas)]',
                placing && '[&_.react-flow__pane]:cursor-crosshair',
                tool === 'hand' && '[&_.react-flow__pane]:cursor-grab',
                tool === 'eraser' && '[&_.react-flow__pane]:cursor-cell',
              )}
              onPointerMove={(event) => {
                if (!realtime.connected) return;
                const point = screenToFlowPosition({
                  x: event.clientX,
                  y: event.clientY,
                });
                realtime.broadcastCursor(point.x, point.y);
              }}
              onPointerLeave={realtime.broadcastCursorLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow<FlowNode, FlowEdge>
                nodes={nodes}
                edges={edges}
                nodeTypes={canvasNodeTypes}
                edgeTypes={canvasEdgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onDelete={editable ? onDelete : undefined}
                onConnect={editable ? onConnect : undefined}
                isValidConnection={(connection) =>
                  connection.source !== connection.target
                }
                connectionMode={ConnectionMode.Loose}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeMouseEnter={onNodeMouseEnter}
                onPaneClick={onPaneClick}
                nodesDraggable={editable && tool === 'select'}
                nodesConnectable={
                  editable && (tool === 'select' || tool === 'connect')
                }
                elementsSelectable={tool === 'select'}
                selectionOnDrag={tool === 'select'}
                selectionMode={SelectionMode.Partial}
                panOnDrag={
                  tool === 'hand' ? true : tool === 'select' ? [1, 2] : false
                }
                panOnScroll
                zoomOnPinch
                zoomOnDoubleClick={false}
                deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
                multiSelectionKeyCode="Shift"
                minZoom={0.1}
                maxZoom={2.5}
                onlyRenderVisibleElements
                colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
                proOptions={{ hideAttribution: true }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.2}
                />
                <Controls showInteractive={false} position="bottom-left" />
                <MiniMap
                  pannable
                  zoomable
                  position="bottom-right"
                  nodeColor={minimapColor}
                  nodeStrokeColor={(node) =>
                    (node.data as CanvasNodeData).item.kind === 'phase' ||
                    (node.data as CanvasNodeData).item.kind === 'frame'
                      ? 'var(--workspace-shell-text-muted)'
                      : 'transparent'
                  }
                />
                <CanvasRemoteCursors cursors={realtime.cursors} />
                {tool === 'pen' && editable ? (
                  <CanvasPenOverlay
                    color={CANVAS_COLORS[penColor].stroke}
                    width={penWidth}
                    onStroke={onStroke}
                  />
                ) : null}
              </ReactFlow>

              {editable ? (
                <div className="pointer-events-none absolute top-3 left-3 z-10">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="pointer-events-auto h-8 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] shadow-sm"
                    onClick={() => setTrayOpen((open) => !open)}
                  >
                    {trayOpen ? (
                      <PanelLeftClose className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <PanelLeftOpen className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add from project
                    {trayEntries.length > 0 ? ` (${trayEntries.length})` : ''}
                  </Button>
                </div>
              ) : null}

              {selectionBar}

              <CanvasPresence
                peers={realtime.peers}
                me={presenceMe}
                connected={realtime.connected}
              />

              <CanvasToolbar
                tool={tool}
                onToolChange={(next) => {
                  setTool(next);
                  setConnectFrom(null);
                }}
                canEdit={editable}
                canUndo={history.past.length > 0}
                canRedo={history.future.length > 0}
                onUndo={undo}
                onRedo={redo}
                onAddImage={() => setImageOpen(true)}
                penColor={penColor}
                onPenColorChange={setPenColor}
                penWidth={penWidth}
                onPenWidthChange={setPenWidth}
                shapeType={shapeType}
                onShapeTypeChange={setShapeType}
                connectPending={Boolean(connectFrom)}
              />
            </div>
          </div>
        </div>

        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add image or link</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitImage();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="canvas-image-url">Image or page URL</Label>
                <Input
                  id="canvas-image-url"
                  value={imageUrl}
                  placeholder="https://"
                  onChange={(event) => setImageUrl(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="canvas-image-title">Caption (optional)</Label>
                <Input
                  id="canvas-image-title"
                  value={imageTitle}
                  onChange={(event) => setImageTitle(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!imageUrl.trim()}>
                  Add to canvas
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <JobProjectTaskSheet
          open={Boolean(selectedTask)}
          onOpenChange={(open) => {
            if (!open) setSelectedTaskId(null);
          }}
          task={selectedTask}
          accountId={accountId}
          accountSlug={accountSlug}
          jobId={jobId}
          canEditJobs={canEdit}
          onUpdated={(task) => {
            onBoardChange(replaceBoardTask(board, task));
            realtime.broadcastLinkedChanged();
          }}
          subtasks={
            selectedTaskId
              ? allTasks.filter(
                  (task) => task.parent_task_id === selectedTaskId,
                )
              : []
          }
          onSubtaskCreated={() => {
            void onRefreshBoard();
            realtime.broadcastLinkedChanged();
          }}
          onDeleted={() => {
            setSelectedTaskId(null);
            void onRefreshBoard();
            realtime.broadcastLinkedChanged();
          }}
        />
      </CanvasActionsProvider>
    </CanvasLookupsProvider>
  );
}
