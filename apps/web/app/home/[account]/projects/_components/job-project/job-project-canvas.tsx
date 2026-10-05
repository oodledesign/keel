'use client';

import {
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { createPortal } from 'react-dom';

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
import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Columns3,
  GanttChart,
  Keyboard,
  LayoutGrid,
  ListTodo,
  LockOpen,
  type LucideIcon,
  Maximize2,
  Megaphone,
  MessageSquare,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  Search,
  Sparkles,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { CanvasAiItem } from '~/lib/projects/canvas/canvas-ai';
import {
  CANVAS_BOARD_VIEWS,
  type CanvasBoardView,
  boardStatusColumn,
  layoutCanvasBoard,
  moveManyInOrder,
  planBoardDrop,
  reorderBoardTasks,
} from '~/lib/projects/canvas/canvas-board-layout';
import {
  CANVAS_CLIPBOARD_MIME,
  type CanvasClipboard,
  canvasPasteOffset,
  copyCanvasItems,
  parseCanvasClipboard,
  pasteCanvasItems,
} from '~/lib/projects/canvas/canvas-clipboard';
import { groupCanvasComments } from '~/lib/projects/canvas/canvas-comments';
import {
  type LinkDisplay,
  linkDisplaySize,
  resolveEmbed,
} from '~/lib/projects/canvas/canvas-embed';
import {
  type CanvasSectionOutline,
  outlineCanvasSection,
  placeSectionNotes,
} from '~/lib/projects/canvas/canvas-fill';
import {
  canvasItemsBounds,
  containerAt,
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
  PHASE_HEADER,
  TASK_GAP,
  arrangeCanvasByPhase,
  arrangeTeamSection,
  buildLinkedCanvasItem,
  layoutUnplacedLinkedItems,
  orphanedLinkedItems,
  unplacedLinkedRefs,
} from '~/lib/projects/canvas/canvas-layout';
import {
  canvasUrlFromText,
  isCanvasImageUrl,
  linkCardPreview,
} from '~/lib/projects/canvas/canvas-links';
import {
  canConnectCanvasItems,
  connectorsTouching,
  mergeCanvasItems,
  removeCanvasItems,
} from '~/lib/projects/canvas/canvas-merge';
import { normalizeCanvasStroke } from '~/lib/projects/canvas/canvas-path';
import type { CanvasSearchEntry } from '~/lib/projects/canvas/canvas-search';
import {
  CANVAS_SECTION_TEMPLATES,
  type CanvasSectionTemplate,
  buildSectionTemplate,
  sectionTemplateSize,
} from '~/lib/projects/canvas/canvas-templates';
import {
  CANVAS_COLORS,
  CANVAS_DEFAULT_SIZES,
  type CanvasColorKey,
  type CanvasItem,
  type CanvasItemData,
  type CanvasShapeType,
  type CanvasTextKind,
  type CanvasTextStyle,
  type FreeformCanvasKind,
  canvasColor,
  canvasItemSize,
  canvasTextStyle,
  isCanvasTextKind,
  isContainerCanvasKind,
  isLinkedCanvasKind,
} from '~/lib/projects/canvas/canvas-types';

import {
  getWorkspaceDocDownloadUrlAction,
  registerUploadedWorkspaceDocAction,
} from '../../../_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '../../../_lib/workspace-content/docs-constants';
import {
  createWorkspaceLinkAction,
  fetchWorkspaceLinkMetadataAction,
} from '../../../_lib/workspace-content/links-actions';
import { getErrorMessage } from '../../_lib/error-message';
import type {
  CanvasItemInput,
  ProjectCanvasComment,
  ProjectCanvasContact,
  ProjectCanvasDoc,
  ProjectCanvasMember,
  ProjectCanvasNote,
  ProjectCanvasPerson,
} from '../../_lib/schema/project-canvas.schema';
import type {
  JobBoardResult,
  JobBoardTask,
} from '../../_lib/schema/project-phases.schema';
import {
  createProjectCanvasNote,
  deleteProjectCanvasItems,
  loadProjectCanvas,
  loadProjectCanvasNote,
  upsertProjectCanvasItems,
} from '../../_lib/server/project-canvas.actions';
import {
  createJobTask,
  moveTask,
  reorderPhaseTasks,
  updateJobTask,
} from '../../_lib/server/server-actions';
import {
  CanvasAddTaskDialog,
  type NewCanvasTask,
} from './canvas/canvas-add-task-dialog';
import { type CanvasAiApply, CanvasAiDialog } from './canvas/canvas-ai-dialog';
import {
  CANVAS_TOOL_SHORTCUTS,
  CanvasPenOverlay,
  CanvasPresence,
  CanvasRectOverlay,
  CanvasRemoteCursors,
  CanvasSelectionBar,
  type CanvasTool,
  CanvasToolbar,
  ToolButton,
} from './canvas/canvas-chrome';
import {
  CanvasCommentPins,
  CanvasCommentsPanel,
} from './canvas/canvas-comments';
import {
  type CanvasActions,
  CanvasActionsProvider,
  type CanvasClient,
  type CanvasLookups,
  CanvasLookupsProvider,
  type CanvasNodeData,
  type CanvasPerson,
  type CanvasPersonRef,
  taskAssigneeId,
} from './canvas/canvas-context';
import { CanvasEmbedDialog } from './canvas/canvas-embed-dialog';
import {
  CANVAS_IMAGE_ACCEPT,
  CANVAS_IMAGE_BUCKET,
  CANVAS_IMAGE_MAX_BYTES,
  canvasImageExtension,
  placedImageSize,
} from './canvas/canvas-images';
import { CANVAS_KIND_LABELS, canvasItemText } from './canvas/canvas-item-text';
import { CanvasMetricDialog } from './canvas/canvas-metric-dialog';
import {
  type CanvasEdgeData,
  canvasEdgeTypes,
  canvasNodeTypes,
} from './canvas/canvas-nodes';
import { CanvasNoteDialog } from './canvas/canvas-note-dialog';
import {
  type CanvasReading,
  CanvasReadingDialog,
} from './canvas/canvas-reading-dialog';
import { CanvasSearchDialog } from './canvas/canvas-search';
import { CanvasShortcutsDialog } from './canvas/canvas-shortcuts-dialog';
import { CanvasTeamDialog } from './canvas/canvas-team-dialog';
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
import { UNPHASED_KEY } from './job-project.constants';

type FlowNode = Node<CanvasNodeData>;
type FlowEdge = Edge<CanvasEdgeData>;

export type CanvasGuestDoc =
  | { kind: 'written'; title: string; content: string }
  | { kind: 'uploaded'; url: string };

/**
 * A project guest is viewing. The canvas is read only unless their invite
 * lets them edit it (`canEdit`); comments follow their invite either way.
 */
export type CanvasGuestMode = {
  canComment: boolean;
  onOpenTask: (taskId: string) => void;
  loadDoc: (docId: string) => Promise<CanvasGuestDoc>;
  /** Upload a file to the project (guests with canvas editing). */
  uploadFile: (file: File) => Promise<{ docId: string }>;
  /** Present when the invite lets the guest add tasks. */
  createTask?: (input: { title: string }) => Promise<{ id: string }>;
};

type JobProjectCanvasProps = {
  accountId: string;
  accountSlug: string;
  jobId: string;
  board: JobBoardResult;
  canEdit: boolean;
  onBoardChange: (board: JobBoardResult) => void;
  onRefreshBoard: () => Promise<void>;
  /** Deep link: select this item and open its comments. */
  focusItemId?: string | null;
  guest?: CanvasGuestMode;
};

const UPSERT_CHUNK = 300;
const DELETE_CHUNK = 500;
const DUPLICATE_OFFSET = 24;
const NUDGE_SAVE_DELAY_MS = 400;
const ARROW_NUDGE: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};
const ZOOM_DURATION_MS = 200;
const STATUS_TONES: Record<string, string> = {
  todo: 'var(--ozer-gold-500)',
  in_progress: 'var(--ozer-accent)',
  client_review: 'var(--ozer-info)',
  done: 'var(--ozer-sage-500)',
};
const BOARD_VIEW_KEY = 'ozer.canvas.board-view.';
const BOARD_VIEW_OPTIONS: Record<
  CanvasBoardView,
  { label: string; icon: LucideIcon }
> = {
  phase: {
    label: 'Phase columns — tasks stack in board order',
    icon: Columns3,
  },
  status: {
    label: 'Status columns — to do, in progress, review, done',
    icon: ListTodo,
  },
  free: { label: 'Unlocked — put cards anywhere', icon: LockOpen },
};

/** Stand-in item for the board layout's own column headers and drop marker. */
function boardNodeItem(id: string): CanvasItem {
  return {
    id,
    kind: 'text',
    refId: null,
    x: 0,
    y: 0,
    w: null,
    h: null,
    zIndex: 0,
    data: {},
    updatedAt: PENDING_CANVAS_TIMESTAMP,
    updatedBy: null,
  };
}

/**
 * Last canvas copy in this tab. Some browsers drop custom clipboard types,
 * so a paste whose plain text matches falls back to this.
 */
let lastCanvasCopy: { text: string; clip: CanvasClipboard } | null = null;

const TEXT_EDIT_KINDS = new Set(['sticky', 'text', 'shape', 'frame']);
const PLACE_TOOLS: Partial<Record<CanvasTool, FreeformCanvasKind>> = {
  sticky: 'sticky',
  text: 'text',
  shape: 'shape',
  frame: 'frame',
  metric: 'metric',
};
const DRAW_TOOLS = new Set<CanvasTool>(['shape', 'frame']);
const SECTION_PAD = 32;
const SECTION_HEADER = 40;
const DROP_STAGGER = 24;
const CANVAS_DOC_MAX_BYTES = 50 * 1024 * 1024;
const AI_ITEM_LIMIT = 80;
const AI_PLACE_GAP = 60;
const IDEA_SIZE = { w: 220, h: 150 };
const LINK_WITH_IMAGE_H = 280;
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  brief: ClipboardList,
  marketing: Megaphone,
  content_calendar: CalendarRange,
  targets: Target,
};
const COLOR_MODE: Partial<Record<CanvasItem['kind'], 'fill' | 'stroke'>> = {
  sticky: 'fill',
  shape: 'fill',
  frame: 'fill',
  metric: 'stroke',
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
  'path',
  'title',
  'fontSize',
  'bold',
  'italic',
  'preset',
  'showTasks',
  'description',
  'faviconUrl',
  'imageUrl',
  'linkId',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'label',
  'value',
  'goal',
  'display',
  'unit',
  'start',
  'startDate',
  'dueDate',
  'metricSource',
  'milestones',
  'history',
  'panel',
] as const satisfies ReadonlyArray<keyof CanvasItemData>;

// Anything missing from DATA_KEYS is silently dropped on save. Adding a field
// to CanvasItemData without listing it above is now a type error.
type UnsavedDataKey = Exclude<keyof CanvasItemData, (typeof DATA_KEYS)[number]>;
const ALL_DATA_KEYS_SAVED: [UnsavedDataKey] extends [never] ? true : never =
  true;
void ALL_DATA_KEYS_SAVED;

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

function isTextItem(
  item: CanvasItem,
): item is CanvasItem & { kind: CanvasTextKind } {
  return isCanvasTextKind(item.kind);
}

/** A new container sits behind any container it wraps so it never hides them. */
function containerZIndexFor(
  items: CanvasItem[],
  box: { x: number; y: number; w: number; h: number },
) {
  const wrapped = items.filter((item) => {
    if (!isContainerCanvasKind(item.kind)) return false;
    const size = canvasItemSize(item);
    return (
      item.x >= box.x &&
      item.y >= box.y &&
      item.x + size.w <= box.x + box.w &&
      item.y + size.h <= box.y + box.h
    );
  });
  if (wrapped.length === 0) return nextZIndex(items, true);
  return Math.min(...wrapped.map((item) => item.zIndex)) - 1;
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
      return lookups.guest || lookups.teamById.has(id);
    case 'client':
      return lookups.guest || lookups.client?.id === id;
    case 'note':
      return lookups.notesById.has(id);
    case 'contact':
      return lookups.guest || lookups.contactsById.has(id);
    case 'doc':
      return lookups.docsById.has(id);
    default:
      return true;
  }
}

function minimapColor(node: Node) {
  const nodeData = node.data as CanvasNodeData | undefined;
  const item = nodeData?.item;
  if (!item || nodeData?.board) return 'transparent';
  if (item.kind === 'sticky' || item.kind === 'shape') {
    return canvasColor(item.data.color, 'yellow').fill;
  }
  if (item.kind === 'phase' || item.kind === 'frame') return 'transparent';
  if (item.kind === 'metric')
    return canvasColor(item.data.color, 'green').stroke;
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
  focusItemId = null,
  guest,
}: JobProjectCanvasProps) {
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, zoomTo } =
    useReactFlow();
  const { resolvedTheme } = useTheme();
  const { data: user } = useUser();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [available, setAvailable] = useState(true);
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [notes, setNotes] = useState<ProjectCanvasNote[]>([]);
  const [memberDetails, setMemberDetails] = useState<ProjectCanvasMember[]>([]);
  const [contacts, setContacts] = useState<ProjectCanvasContact[]>([]);
  const [docs, setDocs] = useState<ProjectCanvasDoc[]>([]);
  const [people, setPeople] = useState<ProjectCanvasPerson[]>([]);
  const [reading, setReading] = useState<CanvasReading | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamFocus, setTeamFocus] = useState<CanvasPersonRef | null>(null);
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
  const [uploadingImages, setUploadingImages] = useState(0);
  const [uploadingFiles, setUploadingFiles] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  /** A note id, or `'new'` while writing a new project note. */
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const newNoteAtRef = useRef<{ x: number; y: number } | null>(null);
  /** Items to select once they reach React Flow (pasted, duplicated, new). */
  const pendingSelectionRef = useRef<Set<string> | null>(null);
  const pasteCountRef = useRef(0);
  const savingNoteRef = useRef(false);
  const nudgeRef = useRef<{
    before: Map<string, CanvasItem>;
    timer: number;
  } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [comments, setComments] = useState<ProjectCanvasComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentItemId, setCommentItemId] = useState<string | null>(null);
  const [boardView, setBoardView] = useState<CanvasBoardView>(() => {
    try {
      const stored = window.localStorage.getItem(`${BOARD_VIEW_KEY}${jobId}`);
      return CANVAS_BOARD_VIEWS.find((view) => view === stored) ?? 'phase';
    } catch {
      return 'phase';
    }
  });
  /** Where the dragged board card would land (a marker line + column). */
  const [boardDrop, setBoardDrop] = useState<{
    columnKey: string;
    x: number;
    y: number;
    w: number;
  } | null>(null);
  /** Bumped to snap board cards back to their columns after a drag. */
  const [boardTick, setBoardTick] = useState(0);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [embedItemId, setEmbedItemId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const inlineSlotRef = useRef<HTMLDivElement>(null);
  // The canvas renders into this node, which moves between the page and
  // <body>, so going full screen never remounts React Flow. The app shell's
  // wrappers can't trap a fixed overlay, and dialogs, menus and toasts
  // (portalled to <body>) still show above it.
  const [frameHost] = useState(() => {
    const host = document.createElement('div');
    host.style.display = 'contents';
    return host;
  });
  const [linkUrl, setLinkUrl] = useState('');
  const [linkBusy, setLinkBusy] = useState<
    ReadonlyMap<string, 'fetching' | 'saving'>
  >(() => new Map());

  const supabase = useSupabase();
  const savingLinksRef = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<CanvasItem[]>([]);
  const pendingCounts = useRef(new Map<string, number>());
  const versions = useRef(new Map<string, number>());
  const interactingIds = useRef(new Set<string>());
  const dragRef = useRef<{
    start: { x: number; y: number };
    children: Map<string, { x: number; y: number }>;
    exclude: Set<string>;
  } | null>(null);
  const initialisedRef = useRef(false);
  const fittedRef = useRef(false);

  const editable = canEdit && available;
  const isGuest = Boolean(guest);

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
      setMemberDetails(snapshot.members);
      setContacts(snapshot.contacts);
      setDocs(snapshot.docs);
      setComments(snapshot.comments);
      setPeople(snapshot.people);
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
      const owner = taskAssigneeId(task);
      if (owner && task.status !== 'done' && task.status !== 'cancelled') {
        openTaskCountByPerson.set(
          owner,
          (openTaskCountByPerson.get(owner) ?? 0) + 1,
        );
      }
    }

    const peopleById = new Map<string, CanvasPerson>();
    for (const person of people) {
      peopleById.set(person.id, {
        id: person.id,
        name: person.name,
        email: null,
        pictureUrl: person.pictureUrl,
      });
    }
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

    const detailsById = new Map(
      memberDetails.map((details) => [details.userId, details]),
    );
    const teamById = new Map<string, CanvasPerson>(
      board.assignees.map((assignee) => {
        const details = detailsById.get(assignee.user_id);
        return [
          assignee.user_id,
          {
            id: assignee.user_id,
            name: assignee.name,
            email: assignee.email,
            pictureUrl: assignee.picture_url,
            role: details ? details.role : assignee.role_on_job,
            description: details?.description ?? null,
          },
        ];
      }),
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
      accountId,
      accountSlug,
      jobId,
      canEdit: editable,
      guest: isGuest,
      boardView,
      phasesById: new Map(board.phases.map((phase) => [phase.id, phase])),
      tasksById,
      subtaskCounts,
      peopleById,
      teamById,
      openTaskCountByPerson,
      client,
      notesById: new Map(notes.map((note) => [note.id, note])),
      contactsById: new Map(contacts.map((contact) => [contact.id, contact])),
      docsById: new Map(docs.map((doc) => [doc.id, doc])),
    };
  }, [
    accountSlug,
    allTasks,
    board.assignees,
    board.client,
    board.contactAssignees,
    board.members,
    board.phases,
    boardView,
    contacts,
    docs,
    editable,
    isGuest,
    jobId,
    memberDetails,
    notes,
    people,
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
      contacts: contacts.map((contact) => ({ id: contact.id })),
      docs: docs.map((doc) => ({ id: doc.id })),
    }),
    [
      allTasks,
      board.assignees,
      board.phases,
      contacts,
      docs,
      lookups.client,
      notes,
    ],
  );

  const me = useMemo(() => {
    if (!user?.id) return null;
    const member = board.members.find((m) => m.user_id === user.id);
    const person = people.find((p) => p.id === user.id);
    return {
      userId: user.id,
      name:
        member?.name ||
        member?.email ||
        person?.name ||
        user.email ||
        'Teammate',
      pictureUrl: member?.picture_url ?? person?.pictureUrl ?? null,
    };
  }, [board.members, people, user?.email, user?.id]);

  const mutationsInFlight = useRef(0);
  const refreshWanted = useRef(false);

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
      // Our own task writes echo back as database events. Refreshing in the
      // middle of them would read half-saved data and snap cards back.
      if (mutationsInFlight.current > 0) {
        refreshWanted.current = true;
      } else {
        void onRefreshBoard();
      }
      void resync();
    },
    onResync: () => void resync(),
  });

  const {
    broadcastItems,
    broadcastDeletes,
    broadcastDrag,
    broadcastDragEnd,
    broadcastLinkedChanged,
  } = realtime;

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
    // Guests only see part of the project, so they never tidy or lay it out.
    if (!editable || isGuest) return;

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

  const baseDisplayItems = useMemo(() => {
    if (!available) {
      return layoutUnplacedLinkedItems(jobId, entities, []).creates;
    }
    return items.filter(
      (item) =>
        !isLinkedCanvasKind(item.kind) || isLinkedPresent(item, lookups),
    );
  }, [available, entities, items, jobId, lookups]);

  // Board views place phases and tasks in columns without touching their saved
  // positions, so switching to the free layout brings the old arrangement back.
  const boardLayout = useMemo(() => {
    if (boardView === 'free' || !available) return null;
    return layoutCanvasBoard({
      mode: boardView,
      projectId: jobId,
      phases: board.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
      })),
      tasks: allTasks
        .filter((task) => !task.parent_task_id)
        .map((task) => ({
          id: task.id,
          phaseId: task.phase_id,
          status: task.status,
        })),
      notes: notes.map((note) => ({ id: note.id, phaseId: note.phaseId })),
      items: baseDisplayItems,
    });
  }, [
    allTasks,
    available,
    baseDisplayItems,
    board.phases,
    boardView,
    jobId,
    notes,
  ]);

  const displayItems = boardLayout?.items ?? baseDisplayItems;
  const boardItemsById = useMemo(
    () => new Map(displayItems.map((item) => [item.id, item])),
    [displayItems],
  );
  useEffect(() => {
    const remoteDrags = realtime.remoteDrags;
    const pendingSelection = pendingSelectionRef.current;
    setNodes((prev) => {
      const prevById = new Map(prev.map((node) => [node.id, node]));
      const boardNodes: FlowNode[] = [];
      if (boardLayout) {
        for (const column of boardLayout.columns) {
          if (!column.header) continue;
          const id = `board-column:${column.key}`;
          boardNodes.push({
            id,
            type: 'boardColumn',
            position: { x: column.x, y: column.y },
            width: column.w,
            height: column.h,
            zIndex: 0,
            draggable: false,
            selectable: false,
            focusable: false,
            connectable: false,
            deletable: false,
            data: {
              item: boardNodeItem(id),
              board: {
                label: column.label,
                count: column.tasks.length,
                tone: column.status
                  ? (STATUS_TONES[column.status] ?? 'var(--ozer-accent)')
                  : 'var(--workspace-shell-text-muted)',
                active: boardDrop?.columnKey === column.key,
              },
            },
          });
        }
        if (boardDrop) {
          boardNodes.push({
            id: 'board-drop',
            type: 'boardDrop',
            position: { x: boardDrop.x, y: boardDrop.y },
            width: boardDrop.w,
            height: 4,
            zIndex: 5000,
            draggable: false,
            selectable: false,
            focusable: false,
            connectable: false,
            deletable: false,
            data: {
              item: boardNodeItem('board-drop'),
              board: { label: '', count: 0, tone: '', active: true },
            },
          });
        }
      }
      const itemNodes = displayItems
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
            selected: pendingSelection
              ? pendingSelection.has(item.id)
              : (old?.selected ?? false),
            measured: old?.measured,
            style: item.kind === 'draw' ? { pointerEvents: 'none' } : undefined,
            // Board cards sit in their columns: only tasks move, and only for
            // people who can reorder them.
            draggable: boardLayout?.positioned.has(item.id)
              ? item.kind === 'task' && editable && !isGuest
              : undefined,
            className:
              connectFrom === item.id
                ? 'rounded-xl ring-2 ring-[var(--ozer-accent)] ring-offset-2'
                : dropTargetId === item.id
                  ? 'rounded-xl ring-2 ring-[var(--ozer-accent)]/70'
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
      return [...boardNodes, ...itemNodes];
    });
  }, [
    boardDrop,
    boardLayout,
    boardTick,
    connectFrom,
    displayItems,
    dropTargetId,
    editable,
    isGuest,
    realtime.remoteDrags,
  ]);

  useEffect(() => {
    const nodeIds = new Set(
      displayItems
        .filter((item) => item.kind !== 'connector')
        .map((item) => item.id),
    );
    // Runs after the node sync (same render), so both see the pending selection.
    const pendingSelection = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    setEdges((prev) => {
      const selected =
        pendingSelection ??
        new Set(prev.filter((edge) => edge.selected).map((edge) => edge.id));
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

  /** Where a dragged board card would land, or null when it is over nothing. */
  const planBoardCardDrop = useCallback(
    (node: FlowNode, dragged: FlowNode[] = [node]) => {
      if (!boardLayout) return null;
      const item = boardItemsById.get(node.id);
      if (!item || item.kind !== 'task') return null;
      const size = canvasItemSize(item);
      const excluded = new Set(dragged.map((n) => n.id));
      excluded.add(node.id);
      return planBoardDrop(boardLayout.columns, boardItemsById, excluded, {
        x: node.position.x + size.w / 2,
        y: node.position.y + size.h / 2,
      });
    },
    [boardItemsById, boardLayout],
  );

  const showBoardDrop = useCallback(
    (node: FlowNode, dragged: FlowNode[]) => {
      const plan = planBoardCardDrop(node, dragged);
      if (!plan || !boardLayout) {
        setBoardDrop(null);
        setDropTargetId(null);
        return;
      }
      const { column } = plan;
      const draggedIds = new Set(dragged.map((n) => n.id));
      const rest = column.tasks.filter((task) => !draggedIds.has(task.itemId));
      const at = rest[Math.min(plan.index, rest.length)];
      const previous = rest[plan.index - 1];
      let y = column.y + (column.header ? 52 : PHASE_HEADER);
      if (at) {
        y = (boardItemsById.get(at.itemId)?.y ?? y) - TASK_GAP / 2;
      } else if (previous) {
        const last = boardItemsById.get(previous.itemId);
        if (last) y = last.y + canvasItemSize(last).h + TASK_GAP / 2;
      }
      setBoardDrop({
        columnKey: column.key,
        x: column.x + 16,
        y: y - 2,
        w: column.w - 32,
      });
      setDropTargetId(
        column.header
          ? null
          : (boardLayout.items.find(
              (item) => item.kind === 'phase' && item.refId === column.phaseId,
            )?.id ?? null),
      );
    },
    [boardItemsById, boardLayout, planBoardCardDrop],
  );

  const finishMutation = useCallback(() => {
    mutationsInFlight.current = Math.max(0, mutationsInFlight.current - 1);
    if (mutationsInFlight.current === 0 && refreshWanted.current) {
      refreshWanted.current = false;
      void onRefreshBoard();
    }
  }, [onRefreshBoard]);

  const reorderTasks = useCallback(
    async (phaseId: string | null, order: string[]) => {
      onBoardChange({
        ...board,
        tasksByPhase: reorderBoardTasks(
          board.tasksByPhase,
          phaseId ?? UNPHASED_KEY,
          phaseId,
          order,
        ),
      });
      mutationsInFlight.current += 1;
      try {
        await reorderPhaseTasks({
          accountId,
          accountSlug,
          jobId,
          phaseId,
          taskIds: order,
        });
        broadcastLinkedChanged();
      } catch (error) {
        toast.error(getErrorMessage(error));
        refreshWanted.current = true;
      } finally {
        finishMutation();
      }
    },
    [
      accountId,
      accountSlug,
      board,
      broadcastLinkedChanged,
      finishMutation,
      jobId,
      onBoardChange,
    ],
  );

  const changeTaskStatuses = useCallback(
    async (tasks: JobBoardTask[], status: string) => {
      if (tasks.length === 0) return;
      onBoardChange(
        tasks.reduce(
          (next, task) => replaceBoardTask(next, { ...task, status }),
          board,
        ),
      );
      mutationsInFlight.current += 1;
      try {
        const results = await Promise.allSettled(
          tasks.map((task) =>
            updateJobTask({
              accountId,
              accountSlug,
              jobId,
              taskId: task.id,
              status: status as 'todo',
            }),
          ),
        );
        const failed = results.find((result) => result.status === 'rejected');
        if (failed && failed.status === 'rejected') {
          toast.error(getErrorMessage(failed.reason));
          refreshWanted.current = true;
        }
        broadcastLinkedChanged();
      } finally {
        finishMutation();
      }
    },
    [
      accountId,
      accountSlug,
      board,
      broadcastLinkedChanged,
      finishMutation,
      jobId,
      onBoardChange,
    ],
  );

  /** Drop board cards: reorder/move them between phases, or change their status. */
  const applyBoardDrop = useCallback(
    (node: FlowNode, dragged: FlowNode[]) => {
      const plan = planBoardCardDrop(node, dragged);
      if (!plan) return;

      // Every dragged task card, in the order they sit on the board.
      const movingIds = new Set(dragged.map((n) => n.id));
      movingIds.add(node.id);
      const columnPosition = new Map<string, number>();
      boardLayout?.columns.forEach((column, columnIndex) =>
        column.tasks.forEach((entry, taskIndex) =>
          columnPosition.set(entry.itemId, columnIndex * 10_000 + taskIndex),
        ),
      );
      const moving = [...movingIds]
        .filter((id) => boardItemsById.get(id)?.kind === 'task')
        .sort(
          (left, right) =>
            (columnPosition.get(left) ?? 0) - (columnPosition.get(right) ?? 0),
        )
        .flatMap((id) => {
          const refId = boardItemsById.get(id)?.refId;
          const task = refId ? lookups.tasksById.get(refId) : undefined;
          return task ? [task] : [];
        });
      if (moving.length === 0) return;

      if (boardView === 'phase') {
        const current = plan.column.tasks.map((entry) => entry.taskId);
        const order = moveManyInOrder(
          current,
          moving.map((task) => task.id),
          plan.index,
        );
        const samePhase = moving.every(
          (task) => (task.phase_id ?? null) === plan.column.phaseId,
        );
        if (
          samePhase &&
          order.length === current.length &&
          order.every((id, index) => id === current[index])
        ) {
          return;
        }
        void reorderTasks(plan.column.phaseId, order);
        return;
      }
      const status = plan.column.status;
      if (status) {
        void changeTaskStatuses(
          moving.filter((task) => boardStatusColumn(task.status) !== status),
          status,
        );
      }
    },
    [
      boardItemsById,
      boardLayout,
      boardView,
      changeTaskStatuses,
      lookups.tasksById,
      planBoardCardDrop,
      reorderTasks,
    ],
  );

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
      const exclude = new Set([...draggedIds, ...children.keys()]);
      dragRef.current = { start: { ...node.position }, children, exclude };
      for (const id of exclude) interactingIds.current.add(id);
    },
    [],
  );

  const containerUnder = useCallback(
    (
      id: string,
      position: { x: number; y: number },
      exclude: Set<string>,
      kinds?: CanvasItem['kind'][],
    ) => {
      const item = itemById(id);
      if (!item) return null;
      const size = canvasItemSize(item);
      return containerAt(
        { x: position.x + size.w / 2, y: position.y + size.h / 2 },
        itemsRef.current,
        { exclude, kinds },
      );
    },
    [itemById],
  );

  const onNodeDrag: OnNodeDrag<FlowNode> = useCallback(
    (_event, node, dragged) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (boardLayout?.positioned.has(node.id)) {
        showBoardDrop(node, dragged);
        return;
      }
      const start = itemById(node.id);
      const target = containerUnder(node.id, node.position, drag.exclude);
      const origin = start && containerUnder(node.id, start, drag.exclude)?.id;
      setDropTargetId(target && target.id !== origin ? target.id : null);
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
    [boardLayout, broadcastDrag, containerUnder, itemById, showBoardDrop],
  );

  const reassignTaskPhases = useCallback(
    async (moves: Array<{ taskId: string; phaseId: string }>) => {
      let moved = 0;
      for (const { taskId, phaseId } of moves) {
        try {
          await moveTask({ accountId, accountSlug, jobId, taskId, phaseId });
          moved += 1;
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      }
      if (moved === 0) return;
      const phaseName =
        new Set(moves.map((move) => move.phaseId)).size === 1
          ? lookups.phasesById.get(moves[0]!.phaseId)?.name
          : null;
      toast.success(
        `${moved === 1 ? 'Task' : `${moved} tasks`} moved to ${phaseName ?? 'new phases'}`,
      );
      void onRefreshBoard();
      broadcastLinkedChanged();
    },
    [
      accountId,
      accountSlug,
      broadcastLinkedChanged,
      jobId,
      lookups.phasesById,
      onRefreshBoard,
    ],
  );

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_event, node, dragged) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDropTargetId(null);
      setBoardDrop(null);
      // Board cards sit in their columns; a drop reorders them instead of
      // saving a position, and everything snaps back to the layout.
      const managed = new Set(
        boardLayout
          ? dragged
              .filter((n) => boardLayout.positioned.has(n.id))
              .map((n) => n.id)
          : [],
      );
      if (managed.size > 0) {
        if (editable && !isGuest && managed.has(node.id))
          applyBoardDrop(
            node,
            dragged.filter((n) => managed.has(n.id)),
          );
        for (const id of managed) interactingIds.current.delete(id);
        setBoardTick((tick) => tick + 1);
      }
      const free = dragged.filter((n) => !managed.has(n.id));
      const positions = new Map(free.map((n) => [n.id, n.position]));
      const phaseMoves: Array<{ taskId: string; phaseId: string }> = [];
      if (drag && editable && !isGuest) {
        for (const draggedNode of free) {
          const item = itemById(draggedNode.id);
          if (item?.kind !== 'task' || !item.refId) continue;
          const phase = containerUnder(
            item.id,
            draggedNode.position,
            drag.exclude,
            ['phase'],
          );
          const task = lookups.tasksById.get(item.refId);
          if (phase?.refId && task && task.phase_id !== phase.refId) {
            phaseMoves.push({ taskId: item.refId, phaseId: phase.refId });
          }
        }
      }
      if (phaseMoves.length > 0) void reassignTaskPhases(phaseMoves);
      if (drag && !managed.has(node.id)) {
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
    [
      applyBoardDrop,
      boardLayout,
      broadcastDragEnd,
      commit,
      containerUnder,
      editable,
      isGuest,
      itemById,
      lookups.tasksById,
      reassignTaskPhases,
    ],
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

  const changeBoardView = useCallback(
    (next: CanvasBoardView) => {
      setBoardView(next);
      try {
        window.localStorage.setItem(`${BOARD_VIEW_KEY}${jobId}`, next);
      } catch {
        // The choice just won't be remembered.
      }
      window.setTimeout(
        () =>
          fitView({
            padding: 0.15,
            maxZoom: 1,
            duration: ZOOM_DURATION_MS,
          }),
        80,
      );
    },
    [fitView, jobId],
  );

  const placeFreeform = useCallback(
    (
      kind: FreeformCanvasKind,
      center: { x: number; y: number },
      rect?: { x: number; y: number; w: number; h: number },
    ) => {
      const defaults: Partial<Record<FreeformCanvasKind, CanvasItemData>> = {
        sticky: { text: '', color: 'yellow' },
        text: { text: '' },
        shape: { text: '', shape: shapeType, color: 'blue' },
        frame: { title: 'Section', color: 'slate' },
        metric: { title: 'Figure', color: 'green' },
      };
      const placed = newFreeformItem(kind, center, defaults[kind] ?? {}, 0);
      const item: CanvasItem = rect
        ? { ...placed, x: rect.x, y: rect.y, w: rect.w, h: rect.h }
        : placed;
      const current = itemsRef.current;
      item.zIndex = isContainerCanvasKind(kind)
        ? containerZIndexFor(current, {
            x: item.x,
            y: item.y,
            w: item.w ?? 0,
            h: item.h ?? 0,
          })
        : nextZIndex(current, false);
      commit([{ before: null, after: item }]);
      if (TEXT_EDIT_KINDS.has(kind) || kind === 'metric') setEditingId(item.id);
      return item;
    },
    [commit, shapeType],
  );

  const onDrawRect = useCallback(
    (
      rect: { x: number; y: number; w: number; h: number } | null,
      point: { x: number; y: number },
    ) => {
      const kind = PLACE_TOOLS[tool];
      if (!editable || !kind) return;
      const min = kind === 'frame' ? 120 : 40;
      placeFreeform(
        kind,
        point,
        rect
          ? { ...rect, w: Math.max(rect.w, min), h: Math.max(rect.h, min) }
          : undefined,
      );
      setTool('select');
    },
    [editable, placeFreeform, tool],
  );

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!editable) return;
      if (tool === 'connect') {
        setConnectFrom(null);
        return;
      }
      const kind = PLACE_TOOLS[tool];
      if (!kind || DRAW_TOOLS.has(tool)) return;
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

  const openTask = useCallback(
    (taskId: string) => {
      if (guest) guest.onOpenTask(taskId);
      else setSelectedTaskId(taskId);
    },
    [guest],
  );

  const readingRequestRef = useRef(0);
  const showReading = useCallback(
    (load: () => Promise<{ title: string; markdown: string }>) => {
      const request = ++readingRequestRef.current;
      setReading({ status: 'loading' });
      load()
        .then((result) => {
          if (request === readingRequestRef.current) {
            setReading({ status: 'ready', ...result });
          }
        })
        .catch((error: unknown) => {
          if (request === readingRequestRef.current) {
            setReading({ status: 'error', message: getErrorMessage(error) });
          }
        });
    },
    [],
  );

  const readNote = useCallback(
    (noteId: string) =>
      showReading(async () => {
        const note = await loadProjectCanvasNote({ accountId, jobId, noteId });
        return { title: note.title || 'Untitled note', markdown: note.content };
      }),
    [accountId, jobId, showReading],
  );

  const closeReading = useCallback(() => {
    readingRequestRef.current += 1;
    setReading(null);
  }, []);

  const editPerson = useCallback((person: CanvasPersonRef) => {
    setTeamFocus(person);
    setTeamOpen(true);
  }, []);

  const openDoc = useCallback(
    (docId: string) => {
      const doc = docs.find((entry) => entry.id === docId);
      if (!doc) return;
      if (guest && doc.kind === 'written') {
        showReading(async () => {
          const result = await guest.loadDoc(docId);
          return result.kind === 'written'
            ? { title: result.title, markdown: result.content }
            : { title: doc.title, markdown: '' };
        });
        return;
      }
      if (guest) {
        const tab = window.open('about:blank', '_blank');
        if (tab) tab.opener = null;
        guest
          .loadDoc(docId)
          .then((result) => {
            if (result.kind !== 'uploaded') {
              throw new Error('This file is no longer available');
            }
            if (tab) tab.location.href = result.url;
            else window.open(result.url, '_blank', 'noopener');
          })
          .catch((error: unknown) => {
            tab?.close();
            toast.error(getErrorMessage(error));
          });
        return;
      }
      if (doc.kind === 'written') {
        window.open(
          pathsConfig.app.accountDocDetail
            .replace('[account]', accountSlug)
            .replace('[docId]', doc.id),
          '_blank',
          'noopener',
        );
        return;
      }
      // Open synchronously so the browser doesn't treat it as a pop-up.
      const tab = window.open('about:blank', '_blank');
      if (tab) tab.opener = null;
      getWorkspaceDocDownloadUrlAction({ accountId, docId })
        .then(({ url }) => {
          if (!url) throw new Error('This file is no longer available');
          if (tab) tab.location.href = url;
          else window.open(url, '_blank', 'noopener');
        })
        .catch((error: unknown) => {
          tab?.close();
          toast.error(getErrorMessage(error));
        });
    },
    [accountId, accountSlug, docs, guest, showReading],
  );

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

  /** Double-click or Enter: open, edit or follow the item. */
  const openItem = useCallback(
    (item: CanvasItem) => {
      if (item.kind === 'task' && item.refId) {
        openTask(item.refId);
      } else if (item.kind === 'doc' && item.refId) {
        openDoc(item.refId);
      } else if (item.kind === 'link') {
        const url = item.data.url;
        if (item.data.display === 'embed' && resolveEmbed(url)) {
          setEmbedItemId(item.id);
        } else if (url && /^https?:\/\//i.test(url)) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else if (editable && item.kind === 'note' && item.refId) {
        setEditingNoteId(item.refId);
      } else if (isGuest && item.kind === 'note' && item.refId) {
        readNote(item.refId);
      } else if (
        editable &&
        !isGuest &&
        (item.kind === 'member' || item.kind === 'contact') &&
        item.refId
      ) {
        editPerson({ kind: item.kind, id: item.refId });
      } else if (
        editable &&
        (TEXT_EDIT_KINDS.has(item.kind) || item.kind === 'metric')
      ) {
        setEditingId(item.id);
      }
    },
    [editPerson, editable, isGuest, openDoc, openTask, readNote],
  );

  const onNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: FlowNode) => openItem(node.data.item),
    [openItem],
  );

  const placeLinked = useCallback(
    (ref: CanvasLinkedRef, center: { x: number; y: number }) => {
      const size = CANVAS_DEFAULT_SIZES[ref.kind];
      const item = buildLinkedCanvasItem(jobId, ref, {
        x: center.x - size.w / 2,
        y: center.y - size.h / 2,
      });
      if (!itemById(item.id)) commit([{ before: null, after: item }]);
      return item.id;
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
                : ref.kind === 'contact'
                  ? lookups.contactsById.get(id)?.name
                  : ref.kind === 'doc'
                    ? lookups.docsById.get(id)?.title
                    : lookups.notesById.get(id)?.title || 'Untitled note';
      return { ...ref, label: label || 'Untitled' };
    });
  }, [available, entities, items, lookups]);

  const uploadImages = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      if (!editable) return;
      const images = files.filter((file) => canvasImageExtension(file));
      if (images.length < files.length) {
        toast.error('Only PNG, JPG, WebP or GIF images can be added');
      }
      const origin = at ?? viewportCenter();
      setUploadingImages((count) => count + images.length);
      for (const [index, file] of images.entries()) {
        try {
          if (file.size > CANVAS_IMAGE_MAX_BYTES) {
            toast.error(`${file.name} is over 10MB`);
            continue;
          }
          const id = createCanvasItemId();
          const path = `${accountId}/${jobId}/${id}.${canvasImageExtension(file)}`;
          const [size, upload] = await Promise.all([
            placedImageSize(file),
            supabase.storage.from(CANVAS_IMAGE_BUCKET).upload(path, file, {
              contentType: file.type,
              cacheControl: '31536000',
              upsert: false,
            }),
          ]);
          if (upload.error) throw upload.error;
          const offset = index * DROP_STAGGER;
          commit([
            {
              before: null,
              after: {
                id,
                kind: 'image',
                refId: null,
                x: origin.x - size.w / 2 + offset,
                y: origin.y - size.h / 2 + offset,
                w: size.w,
                h: size.h,
                zIndex: nextZIndex(itemsRef.current, false),
                data: { path, title: file.name.slice(0, 200) },
                updatedAt: PENDING_CANVAS_TIMESTAMP,
                updatedBy: null,
              },
            },
          ]);
        } catch (error) {
          toast.error(
            `Couldn't upload ${file.name}: ${getErrorMessage(error)}`,
          );
        } finally {
          setUploadingImages((count) => count - 1);
        }
      }
    },
    [accountId, commit, editable, jobId, supabase, viewportCenter],
  );

  const setLinkState = useCallback(
    (id: string, state: 'fetching' | 'saving' | null) => {
      setLinkBusy((prev) => {
        const next = new Map(prev);
        if (state) next.set(id, state);
        else next.delete(id);
        return next;
      });
    },
    [],
  );

  const addImageFromUrl = useCallback(
    (url: string, at: { x: number; y: number }) => {
      commit([
        {
          before: null,
          after: newFreeformItem(
            'image',
            at,
            { url },
            nextZIndex(itemsRef.current, false),
          ),
        },
      ]);
    },
    [commit],
  );

  const addLinkCard = useCallback(
    async (url: string, at?: { x: number; y: number }) => {
      if (!editable) return;
      // Videos play right on the canvas; the switcher offers a smaller
      // preview or a plain text link instead.
      const embed = resolveEmbed(url);
      const asVideo = embed?.aspect != null;
      const center = at ?? viewportCenter();
      const placed = newFreeformItem(
        'link',
        center,
        asVideo ? { url, display: 'embed' } : { url },
        nextZIndex(itemsRef.current, false),
      );
      const videoSize = linkDisplaySize('embed', embed);
      const card = asVideo
        ? {
            ...placed,
            x: center.x - videoSize.w / 2,
            y: center.y - videoSize.h / 2,
            w: videoSize.w,
            h: videoSize.h,
          }
        : placed;
      commit([{ before: null, after: card }]);
      setLinkState(card.id, 'fetching');
      try {
        const meta = await fetchWorkspaceLinkMetadataAction({ url });
        const before = itemById(card.id);
        if (!before) return;
        const preview = linkCardPreview(meta);
        const grow =
          preview.imageUrl &&
          canvasItemSize(before).h === CANVAS_DEFAULT_SIZES.link.h;
        commit(
          [
            {
              before,
              after: {
                ...before,
                h: grow ? LINK_WITH_IMAGE_H : before.h,
                data: { ...before.data, ...preview },
              },
            },
          ],
          { record: false },
        );
      } catch {
        // The card still works as a plain link without a preview.
      } finally {
        setLinkState(card.id, null);
      }
    },
    [commit, editable, itemById, setLinkState, viewportCenter],
  );

  const saveLinks = useCallback(
    async (ids: string[]) => {
      const targets = ids.flatMap((id) => {
        const item = itemById(id);
        const url = item?.kind === 'link' ? item.data.url : undefined;
        return item &&
          url &&
          !item.data.linkId &&
          !savingLinksRef.current.has(id)
          ? [{ item, url }]
          : [];
      });
      const results = await Promise.all(
        targets.map(async ({ item, url }) => {
          savingLinksRef.current.add(item.id);
          setLinkState(item.id, 'saving');
          try {
            const { link } = await createWorkspaceLinkAction({
              accountId,
              accountSlug,
              title: item.data.title ?? '',
              url,
              description: item.data.description ?? '',
              faviconUrl: item.data.faviconUrl ?? null,
              ogImageUrl: item.data.imageUrl ?? null,
              link: { type: 'project', id: jobId },
            });
            const current = itemById(item.id);
            if (current) {
              commit(
                [
                  {
                    before: current,
                    after: {
                      ...current,
                      data: { ...current.data, linkId: link.id },
                    },
                  },
                ],
                { record: false },
              );
            }
            return true;
          } catch (error) {
            toast.error(`Couldn't save link: ${getErrorMessage(error)}`);
            return false;
          } finally {
            savingLinksRef.current.delete(item.id);
            setLinkState(item.id, null);
          }
        }),
      );
      const saved = results.filter(Boolean).length;
      if (saved > 0) {
        toast.success(
          saved === 1
            ? "Saved to the project's links in Notes"
            : `${saved} links saved to the project's links in Notes`,
        );
      }
    },
    [accountId, accountSlug, commit, itemById, jobId, setLinkState],
  );

  const submitLink = () => {
    const raw = linkUrl.trim();
    const url =
      canvasUrlFromText(raw) ??
      (/^[^\s/]+\.[^\s]+$/.test(raw)
        ? canvasUrlFromText(`https://${raw}`)
        : null);
    if (!url) {
      toast.error('Enter a web address, e.g. https://example.com');
      return;
    }
    if (isCanvasImageUrl(url)) addImageFromUrl(url, viewportCenter());
    else void addLinkCard(url);
    setLinkOpen(false);
    setLinkUrl('');
  };

  const uploadDocs = useCallback(
    async (files: File[], at?: { x: number; y: number }) => {
      if (!editable || files.length === 0) return;
      const origin = at ?? viewportCenter();
      const size = CANVAS_DEFAULT_SIZES.doc;
      setUploadingFiles((count) => count + files.length);
      let placed = 0;
      for (const file of files) {
        try {
          if (file.size > CANVAS_DOC_MAX_BYTES) {
            toast.error(`${file.name} is over 50MB`);
            continue;
          }
          const title = file.name.slice(0, 500);
          let docId: string;
          if (guest) {
            ({ docId } = await guest.uploadFile(file));
          } else {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${accountId}/projects/${jobId}/${Date.now()}_${safeName}`;
            const { error: uploadError } = await supabase.storage
              .from(ACCOUNT_DOCS_BUCKET)
              .upload(filePath, file, { upsert: false });
            if (uploadError) throw uploadError;
            ({ docId } = await registerUploadedWorkspaceDocAction({
              accountId,
              accountSlug,
              title,
              link: { type: 'project', id: jobId },
              filePath,
              mimeType: file.type || null,
              fileSizeBytes: file.size,
            }));
          }
          setDocs((prev) => [
            {
              id: docId,
              title,
              kind: 'uploaded',
              mimeType: file.type || null,
              sizeBytes: file.size,
              docType: 'general',
              updatedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          const offset = placed * (size.h + DROP_STAGGER);
          placed += 1;
          commit([
            {
              before: null,
              after: {
                ...buildLinkedCanvasItem(
                  jobId,
                  { kind: 'doc', refId: docId },
                  {
                    x: origin.x - size.w / 2,
                    y: origin.y - size.h / 2 + offset,
                  },
                ),
                zIndex: nextZIndex(itemsRef.current, false),
              },
            },
          ]);
        } catch (error) {
          toast.error(
            `Couldn't upload ${file.name}: ${getErrorMessage(error)}`,
          );
        } finally {
          setUploadingFiles((count) => count - 1);
        }
      }
      if (placed > 0) broadcastLinkedChanged();
    },
    [
      accountId,
      accountSlug,
      broadcastLinkedChanged,
      commit,
      editable,
      guest,
      jobId,
      supabase,
      viewportCenter,
    ],
  );

  const onDragOver = useCallback(
    (event: DragEvent) => {
      const types = event.dataTransfer.types;
      if (
        types.includes(CANVAS_TRAY_DRAG_TYPE) ||
        (editable &&
          (types.includes('Files') || types.includes('text/uri-list')))
      ) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
    },
    [editable],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      if (!editable) return;
      const point = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        event.preventDefault();
        const images = files.filter((file) => canvasImageExtension(file));
        const others = files.filter((file) => !canvasImageExtension(file));
        if (images.length > 0) void uploadImages(images, point);
        if (others.length > 0) {
          void uploadDocs(
            others,
            images.length > 0
              ? { x: point.x, y: point.y + CANVAS_DEFAULT_SIZES.doc.h * 2 }
              : point,
          );
        }
        return;
      }
      const raw = event.dataTransfer.getData(CANVAS_TRAY_DRAG_TYPE);
      if (!raw) {
        const url = event.dataTransfer
          .getData('text/uri-list')
          .split('\n')
          .map((line) => canvasUrlFromText(line))
          .find((line): line is string => Boolean(line));
        if (!url) return;
        event.preventDefault();
        if (isCanvasImageUrl(url)) addImageFromUrl(url, point);
        else void addLinkCard(url, point);
        return;
      }
      event.preventDefault();
      try {
        const ref = JSON.parse(raw) as { kind?: string; refId?: string };
        if (!ref.kind || !isLinkedCanvasKind(ref.kind) || !ref.refId) return;
        placeLinked({ kind: ref.kind, refId: ref.refId }, point);
      } catch {
        // Ignore drops that aren't tray entries.
      }
    },
    [
      addImageFromUrl,
      addLinkCard,
      editable,
      placeLinked,
      screenToFlowPosition,
      uploadDocs,
      uploadImages,
    ],
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
  const singleSelected =
    selectedItems.length === 1 && selectedItems[0]!.kind !== 'connector'
      ? selectedItems[0]!
      : null;

  const wrapInSection = useCallback(() => {
    const bounds = canvasItemsBounds(selectedItems);
    if (!bounds) return;
    placeFreeform(
      'frame',
      { x: 0, y: 0 },
      {
        x: bounds.x - SECTION_PAD,
        y: bounds.y - SECTION_PAD - SECTION_HEADER,
        w: bounds.w + SECTION_PAD * 2,
        h: bounds.h + SECTION_PAD * 2 + SECTION_HEADER,
      },
    );
  }, [placeFreeform, selectedItems]);

  const styledItems = useMemo(() => {
    const textItems = selectedItems.filter(isTextItem);
    return textItems.length === selectedItems.length ? textItems : [];
  }, [selectedItems]);
  const selectionTextStyle = styledItems[0]
    ? canvasTextStyle(styledItems[0].kind, styledItems[0].data)
    : undefined;

  const applyTextStyle = useCallback(
    (patch: Partial<CanvasTextStyle>) => {
      patchItems(
        styledItems.map((item) => {
          const style = canvasTextStyle(item.kind, item.data);
          const next: Partial<CanvasItem> = {
            data: { ...item.data, ...style, ...patch },
          };
          if (
            item.kind === 'text' &&
            patch.fontSize &&
            patch.fontSize !== style.fontSize
          ) {
            const h = canvasItemSize(item).h;
            next.h = Math.round(
              Math.max(
                (h * patch.fontSize) / style.fontSize,
                patch.fontSize * 1.4,
              ),
            );
          }
          return { id: item.id, patch: next };
        }),
      );
    },
    [patchItems, styledItems],
  );

  const toggleTextStyle = useCallback(
    (key: 'bold' | 'italic') => {
      if (!selectionTextStyle) return;
      applyTextStyle({ [key]: !selectionTextStyle[key] });
    },
    [applyTextStyle, selectionTextStyle],
  );

  const arrangeByPhase = useCallback(() => {
    const { creates, updates } = arrangeCanvasByPhase(
      jobId,
      entities,
      itemsRef.current,
    );
    if (creates.length === 0 && updates.length === 0) {
      toast.info(
        board.phases.length === 0
          ? 'Add phases to the project first'
          : 'Already arranged by phase',
      );
      return;
    }
    commit([
      ...creates.map((after) => ({ before: null, after })),
      ...updates.map((after) => ({
        before: itemById(after.id) ?? null,
        after,
      })),
    ]);
    requestAnimationFrame(() =>
      fitView({ padding: 0.15, maxZoom: 1, duration: 400 }),
    );
  }, [board.phases.length, commit, entities, fitView, itemById, jobId]);

  const arrangeTeam = useCallback(() => {
    const { creates, updates } = arrangeTeamSection(
      jobId,
      entities,
      itemsRef.current,
      {
        id: createCanvasItemId(),
        zIndex: nextZIndex(itemsRef.current, true),
      },
    );
    if (creates.length === 0 && updates.length === 0) {
      toast.info(
        entities.members.length === 0 &&
          entities.contacts.length === 0 &&
          !entities.clientId
          ? 'Add people to the project team first'
          : 'Team section is up to date',
      );
      return;
    }
    commit([
      ...creates.map((after) => ({ before: null, after })),
      ...updates.map((after) => ({
        before: itemById(after.id) ?? null,
        after,
      })),
    ]);
    const section = [...creates, ...updates].find(
      (item) => item.kind === 'frame' && item.data.preset === 'team',
    );
    requestAnimationFrame(() =>
      fitView({
        nodes: section ? [{ id: section.id }] : undefined,
        padding: 0.15,
        maxZoom: 1,
        duration: 400,
      }),
    );
  }, [commit, entities, fitView, itemById, jobId]);

  const insertTemplate = useCallback(
    (template: CanvasSectionTemplate) => {
      const bounds = canvasItemsBounds(itemsRef.current);
      const size = sectionTemplateSize(template);
      const center = viewportCenter();
      const origin = bounds
        ? { x: bounds.x + bounds.w + 160, y: bounds.y }
        : { x: center.x - size.w / 2, y: center.y - size.h / 2 };
      const created = buildSectionTemplate(
        template,
        origin,
        {
          container: nextZIndex(itemsRef.current, true),
          item: nextZIndex(itemsRef.current, false),
        },
        createCanvasItemId,
      );
      commit(created.map((after) => ({ before: null, after })));
      const frameId = created[0]?.id;
      window.setTimeout(
        () =>
          fitView({
            nodes: frameId ? [{ id: frameId }] : undefined,
            padding: 0.1,
            maxZoom: 1,
            duration: 400,
          }),
        50,
      );
    },
    [commit, fitView, viewportCenter],
  );

  const teamList = useMemo(
    () => [...lookups.teamById.values()],
    [lookups.teamById],
  );
  const workspaceMembers = useMemo<CanvasPerson[]>(
    () =>
      board.members.map((member) => ({
        id: member.user_id,
        name: member.name,
        email: member.email,
        pictureUrl: member.picture_url ?? null,
      })),
    [board.members],
  );
  const onTeamChanged = useCallback(() => {
    void onRefreshBoard();
    void resync();
    broadcastLinkedChanged();
  }, [broadcastLinkedChanged, onRefreshBoard, resync]);

  const displayById = useMemo(
    () => new Map(displayItems.map((item) => [item.id, item])),
    [displayItems],
  );

  const focusItem = useCallback(
    (id: string) => {
      setNodes((prev) =>
        prev.map((node) =>
          Boolean(node.selected) === (node.id === id)
            ? node
            : { ...node, selected: node.id === id },
        ),
      );
      setEdges((prev) =>
        prev.map((edge) =>
          edge.selected ? { ...edge, selected: false } : edge,
        ),
      );
      requestAnimationFrame(() =>
        fitView({ nodes: [{ id }], padding: 0.6, maxZoom: 1.1, duration: 400 }),
      );
    },
    [fitView],
  );

  const canAddTask = editable && (!isGuest || Boolean(guest?.createTask));

  const addTask = useCallback(
    async (input: NewCanvasTask) => {
      try {
        let taskId: string;
        if (guest?.createTask) {
          taskId = (await guest.createTask({ title: input.title })).id;
        } else {
          const row = await createJobTask({
            accountId,
            accountSlug,
            jobId,
            phaseId: input.phaseId,
            title: input.title,
            dueDate: input.dueDate
              ? new Date(`${input.dueDate}T12:00:00`)
              : null,
          });
          taskId = row.id;
        }
        await onRefreshBoard();
        broadcastLinkedChanged();
        const size = CANVAS_DEFAULT_SIZES.task;
        const center = viewportCenter();
        const card = buildLinkedCanvasItem(
          jobId,
          { kind: 'task', refId: taskId },
          { x: center.x - size.w / 2, y: center.y - size.h / 2 },
        );
        // Board views place the new task in its column on their own; on the
        // free canvas it lands where you're looking.
        if (!boardLayout) {
          commit([
            {
              before: null,
              after: { ...card, zIndex: nextZIndex(itemsRef.current, false) },
            },
          ]);
        }
        setAddTaskOpen(false);
        toast.success('Task added');
        window.setTimeout(() => focusItem(card.id), 250);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [
      accountId,
      accountSlug,
      boardLayout,
      broadcastLinkedChanged,
      commit,
      focusItem,
      guest,
      jobId,
      onRefreshBoard,
      viewportCenter,
    ],
  );

  const searchEntries = useMemo<CanvasSearchEntry[]>(
    () =>
      displayItems
        .filter(
          (item) =>
            item.kind !== 'draw' &&
            (item.kind !== 'connector' || Boolean(item.data.label)),
        )
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          ...canvasItemText(item, lookups),
        })),
    [displayItems, lookups],
  );

  const commentThreads = useMemo(
    () => groupCanvasComments(comments),
    [comments],
  );
  const openCommentCount = commentThreads.filter(
    (thread) => !thread.resolved,
  ).length;

  const itemLabel = useCallback(
    (id: string) => {
      const item = displayById.get(id);
      return item ? canvasItemText(item, lookups).label : null;
    },
    [displayById, lookups],
  );

  const openComments = useCallback((itemId: string | null) => {
    setCommentItemId(itemId);
    setCommentsOpen(true);
  }, []);

  const upsertComment = useCallback(
    (comment: ProjectCanvasComment) => {
      setComments((prev) =>
        prev.some((existing) => existing.id === comment.id)
          ? prev.map((existing) =>
              existing.id === comment.id ? comment : existing,
            )
          : [...prev, comment],
      );
      broadcastLinkedChanged();
    },
    [broadcastLinkedChanged],
  );

  const removeComment = useCallback(
    (commentId: string) => {
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      broadcastLinkedChanged();
    },
    [broadcastLinkedChanged],
  );

  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusItemId || status !== 'ready' || nodes.length === 0) return;
    if (deepLinkedRef.current === focusItemId) return;
    const frame = requestAnimationFrame(() => {
      deepLinkedRef.current = focusItemId;
      if (displayById.has(focusItemId)) focusItem(focusItemId);
      openComments(focusItemId);
    });
    return () => cancelAnimationFrame(frame);
  }, [displayById, focusItem, focusItemId, nodes.length, openComments, status]);

  const insertTimeline = useCallback(() => {
    const existing = itemsRef.current.find((item) => item.kind === 'timeline');
    if (existing) {
      focusItem(existing.id);
      toast.info('This canvas already has a timeline');
      return;
    }
    const unphased = allTasks.some(
      (task) => !task.parent_task_id && !task.phase_id && task.due_date,
    );
    const rows = Math.max(board.phases.length + (unphased ? 1 : 0), 1);
    const bounds = canvasItemsBounds(itemsRef.current);
    const size = CANVAS_DEFAULT_SIZES.timeline;
    const w = Math.min(Math.max(size.w, bounds?.w ?? 0), 2400);
    const h = Math.min(Math.max(size.h, 100 + rows * 32), 720);
    const center = viewportCenter();
    const item: CanvasItem = {
      id: createCanvasItemId(),
      kind: 'timeline',
      refId: null,
      x: bounds ? bounds.x : center.x - w / 2,
      y: bounds ? bounds.y + bounds.h + 120 : center.y - h / 2,
      w,
      h,
      zIndex: nextZIndex(itemsRef.current, false),
      data: { showTasks: true },
      updatedAt: PENDING_CANVAS_TIMESTAMP,
      updatedBy: null,
    };
    commit([{ before: null, after: item }]);
    window.setTimeout(() => focusItem(item.id), 50);
  }, [allTasks, board.phases.length, commit, focusItem, viewportCenter]);

  const insertRoadmap = useCallback(
    (panel: 'roadmap' | 'calendar') => {
      const bounds = canvasItemsBounds(itemsRef.current);
      const size = CANVAS_DEFAULT_SIZES.roadmap;
      const center = viewportCenter();
      const item: CanvasItem = {
        id: createCanvasItemId(),
        kind: 'roadmap',
        refId: null,
        x: bounds ? bounds.x : center.x - size.w / 2,
        y: bounds ? bounds.y + bounds.h + 120 : center.y - size.h / 2,
        w: size.w,
        h: size.h,
        zIndex: nextZIndex(itemsRef.current, false),
        data: { panel },
        updatedAt: PENDING_CANVAS_TIMESTAMP,
        updatedBy: null,
      };
      commit([{ before: null, after: item }]);
      window.setTimeout(() => focusItem(item.id), 50);
    },
    [commit, focusItem, viewportCenter],
  );

  const aiSelection = useMemo<CanvasAiItem[]>(() => {
    if (!aiOpen) return [];
    const seen = new Set<string>();
    const out: CanvasAiItem[] = [];
    const add = (item: CanvasItem) => {
      if (
        seen.has(item.id) ||
        item.kind === 'connector' ||
        item.kind === 'draw' ||
        item.kind === 'timeline' ||
        item.kind === 'roadmap'
      ) {
        return;
      }
      seen.add(item.id);
      const { label, detail } = canvasItemText(item, lookups);
      const text = (
        detail.startsWith(label)
          ? detail
          : [label, detail].filter(Boolean).join(' — ')
      ).slice(0, 1500);
      if (text.trim()) out.push({ kind: CANVAS_KIND_LABELS[item.kind], text });
    };
    for (const item of selectedItems) {
      add(item);
      if (isContainerCanvasKind(item.kind)) {
        itemsInsideContainer(item, displayItems)
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .forEach(add);
      }
    }
    return out.slice(0, AI_ITEM_LIMIT);
  }, [aiOpen, displayItems, lookups, selectedItems]);

  const aiSections = useMemo<CanvasSectionOutline[]>(() => {
    if (!aiOpen) return [];
    return displayItems
      .filter((item) => item.kind === 'frame')
      .map((frame) => outlineCanvasSection(displayItems, frame.id))
      .filter((outline): outline is CanvasSectionOutline => outline !== null);
  }, [aiOpen, displayItems]);

  const aiDefaultSectionId =
    selectedItems.length === 1 &&
    aiSections.some((section) => section.id === selectedItems[0]!.id)
      ? selectedItems[0]!.id
      : null;

  const aiPhases = useMemo(
    () => board.phases.map((phase) => ({ id: phase.id, name: phase.name })),
    [board.phases],
  );

  const applyAi = useCallback(
    async (result: CanvasAiApply) => {
      const selectionBounds = canvasItemsBounds(selectedItems);
      const center = viewportCenter();
      const anchor = selectionBounds
        ? {
            x: selectionBounds.x + selectionBounds.w + AI_PLACE_GAP,
            y: selectionBounds.y,
          }
        : { x: center.x - 200, y: center.y - 150 };
      const item = (
        kind: FreeformCanvasKind,
        box: { x: number; y: number; w: number; h: number },
        data: CanvasItemData,
        zIndex: number,
      ): CanvasItem => ({
        id: createCanvasItemId(),
        kind,
        refId: null,
        ...box,
        zIndex,
        data,
        updatedAt: PENDING_CANVAS_TIMESTAMP,
        updatedBy: null,
      });

      if (result.mode === 'summarise') {
        const sticky = item(
          'sticky',
          {
            ...anchor,
            w: 340,
            h: Math.min(Math.max(140 + result.bullets.length * 44, 200), 640),
          },
          {
            text: `${result.title}\n\n${result.bullets.map((b) => `• ${b}`).join('\n')}`,
            color: 'blue',
            fontSize: 14,
          },
          nextZIndex(itemsRef.current, false),
        );
        commit([{ before: null, after: sticky }]);
        window.setTimeout(() => focusItem(sticky.id), 50);
        return;
      }

      if (result.mode === 'brainstorm') {
        const cols = Math.min(3, result.ideas.length);
        const rows = Math.ceil(result.ideas.length / cols);
        const gap = 16;
        const box = {
          ...anchor,
          w: SECTION_PAD * 2 + cols * IDEA_SIZE.w + (cols - 1) * gap,
          h:
            SECTION_PAD +
            SECTION_HEADER +
            rows * IDEA_SIZE.h +
            (rows - 1) * gap +
            SECTION_PAD,
        };
        const current = itemsRef.current;
        const frame = item(
          'frame',
          box,
          { title: 'Ideas', color: 'yellow' },
          containerZIndexFor(current, box),
        );
        const baseZ = nextZIndex(current, false);
        const stickies = result.ideas.map((text, index) =>
          item(
            'sticky',
            {
              x: box.x + SECTION_PAD + (index % cols) * (IDEA_SIZE.w + gap),
              y:
                box.y +
                SECTION_PAD +
                SECTION_HEADER +
                Math.floor(index / cols) * (IDEA_SIZE.h + gap),
              ...IDEA_SIZE,
            },
            { text, color: 'yellow', fontSize: 14 },
            baseZ + index,
          ),
        );
        commit([frame, ...stickies].map((after) => ({ before: null, after })));
        window.setTimeout(() => focusItem(frame.id), 50);
        return;
      }

      if (result.mode === 'section') {
        const { creates, updates } = placeSectionNotes(
          itemsRef.current,
          result.sectionId,
          result.placements,
          {
            createId: createCanvasItemId,
            zIndex: nextZIndex(itemsRef.current, false),
          },
        );
        if (creates.length === 0) {
          throw new Error('That section has changed — try again');
        }
        commit([
          ...creates.map((after) => ({ before: null, after })),
          ...updates.map((after) => ({
            before: itemById(after.id) ?? null,
            after,
          })),
        ]);
        window.setTimeout(() => focusItem(result.sectionId), 50);
        return;
      }

      const created: string[] = [];
      for (const task of result.tasks) {
        try {
          const row = await createJobTask({
            accountId,
            accountSlug,
            jobId,
            phaseId: result.phaseId,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate ? new Date(`${task.dueDate}T12:00:00`) : null,
          });
          created.push(row.id);
        } catch (error) {
          toast.error(`${task.title}: ${getErrorMessage(error)}`);
        }
      }
      if (created.length === 0) throw new Error("Couldn't create the tasks");
      await onRefreshBoard();
      broadcastLinkedChanged();
      const size = CANVAS_DEFAULT_SIZES.task;
      const perColumn = 6;
      const baseZ = nextZIndex(itemsRef.current, false);
      commit(
        created.map((refId, index) => ({
          before: null,
          after: {
            ...buildLinkedCanvasItem(
              jobId,
              { kind: 'task', refId },
              {
                x: anchor.x + Math.floor(index / perColumn) * (size.w + 24),
                y: anchor.y + (index % perColumn) * (size.h + 16),
              },
            ),
            zIndex: baseZ + index,
          },
        })),
      );
      toast.success(
        `${created.length} task${created.length === 1 ? '' : 's'} added to the project`,
      );
    },
    [
      accountId,
      accountSlug,
      broadcastLinkedChanged,
      commit,
      focusItem,
      itemById,
      jobId,
      onRefreshBoard,
      selectedItems,
      viewportCenter,
    ],
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

  const addAndSelect = useCallback(
    (created: CanvasItem[]) => {
      if (!editable || created.length === 0) return;
      pendingSelectionRef.current = new Set(created.map((item) => item.id));
      commit(created.map((after) => ({ before: null, after })));
    },
    [commit, editable],
  );

  const pasteCopies = useCallback(
    (
      source: CanvasItem[],
      offset: { dx: number; dy: number },
      keepLinkIds: boolean,
    ) => {
      addAndSelect(
        pasteCanvasItems(source, {
          ...offset,
          newId: createCanvasItemId,
          zBase: (container) => nextZIndex(itemsRef.current, container),
          keepLinkIds,
        }),
      );
    },
    [addAndSelect],
  );

  const duplicateSelection = useCallback(() => {
    const source = copyCanvasItems(selectedItems, itemsRef.current);
    if (source.length === 0) {
      if (selectedItems.length > 0) {
        toast.info(
          "Project cards can't be duplicated — they're on the canvas once",
        );
      }
      return;
    }
    pasteCopies(source, { dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET }, true);
  }, [pasteCopies, selectedItems]);

  const visibleFlowBox = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, w: 0, h: 0 };
    const topLeft = screenToFlowPosition({ x: rect.left, y: rect.top });
    const bottomRight = screenToFlowPosition({
      x: rect.right,
      y: rect.bottom,
    });
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }, [screenToFlowPosition]);

  const pasteClipboard = useCallback(
    (clip: CanvasClipboard) => {
      if (clip.accountId !== accountId) {
        toast.error(
          'Canvas items can only be pasted within the same workspace',
        );
        return;
      }
      const sameProject = clip.projectId === jobId;
      pasteCountRef.current += 1;
      const offset = canvasPasteOffset(clip.items, visibleFlowBox(), {
        sameProject,
        nudge: DUPLICATE_OFFSET * pasteCountRef.current,
      });
      pasteCopies(clip.items, offset, sameProject);
    },
    [accountId, jobId, pasteCopies, visibleFlowBox],
  );

  const sendToBack = useCallback(() => {
    const current = itemsRef.current;
    const lowest = (container: boolean) =>
      current
        .filter(
          (item) =>
            item.kind !== 'connector' &&
            isContainerCanvasKind(item.kind) === container,
        )
        .reduce((min, item) => Math.min(min, item.zIndex), 0);
    const targets = selectedItems.filter((item) => item.kind !== 'connector');
    patchItems(
      targets.map((item, index) => ({
        id: item.id,
        patch: {
          zIndex:
            lowest(isContainerCanvasKind(item.kind)) - targets.length + index,
        },
      })),
    );
  }, [patchItems, selectedItems]);

  const flushNudge = useCallback(() => {
    const pending = nudgeRef.current;
    if (!pending) return;
    nudgeRef.current = null;
    window.clearTimeout(pending.timer);
    const changes: CanvasChange[] = [];
    for (const before of pending.before.values()) {
      const after = itemById(before.id);
      if (after && (after.x !== before.x || after.y !== before.y)) {
        changes.push({ before, after });
      }
    }
    commit(changes);
  }, [commit, itemById]);

  /**
   * Arrow keys move the selection (and anything inside a selected section)
   * straight away; the move is saved as one change once the keys go quiet.
   */
  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (!editable) return;
      const current = itemsRef.current;
      const moving = new Map<string, CanvasItem>();
      for (const item of selectedItems) {
        if (item.kind === 'connector') continue;
        moving.set(item.id, item);
        if (isContainerCanvasKind(item.kind)) {
          for (const child of itemsInsideContainer(item, current)) {
            moving.set(child.id, child);
          }
        }
      }
      if (moving.size === 0) return;

      const pending = nudgeRef.current ?? {
        before: new Map<string, CanvasItem>(),
        timer: 0,
      };
      for (const id of moving.keys()) {
        const original = itemById(id);
        if (original && !pending.before.has(id)) {
          pending.before.set(id, original);
        }
      }
      window.clearTimeout(pending.timer);
      pending.timer = window.setTimeout(flushNudge, NUDGE_SAVE_DELAY_MS);
      nudgeRef.current = pending;

      updateItems((prev) =>
        prev.map((item) =>
          moving.has(item.id)
            ? { ...item, x: item.x + dx, y: item.y + dy }
            : item,
        ),
      );
    },
    [editable, flushNudge, itemById, selectedItems, updateItems],
  );

  useEffect(() => () => flushNudge(), [flushNudge]);

  const selectAll = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) => (node.selected ? node : { ...node, selected: true })),
    );
    setEdges((prev) =>
      prev.map((edge) => (edge.selected ? edge : { ...edge, selected: true })),
    );
  }, []);

  const startNewNote = useCallback(
    (at?: { x: number; y: number }) => {
      if (!editable || !available) return;
      newNoteAtRef.current = at ?? viewportCenter();
      setEditingNoteId('new');
    },
    [available, editable, viewportCenter],
  );

  const onNoteCreated = useCallback(
    (note: ProjectCanvasNote) => {
      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
      const cardId = placeLinked(
        { kind: 'note', refId: note.id },
        newNoteAtRef.current ?? viewportCenter(),
      );
      newNoteAtRef.current = null;
      pendingSelectionRef.current = new Set([cardId]);
      broadcastLinkedChanged();
      toast.success("Note added to the project's notes");
    },
    [broadcastLinkedChanged, placeLinked, viewportCenter],
  );

  /** Turn a sticky or text box into a project note, keeping its spot. */
  const saveAsProjectNote = useCallback(
    async (item: CanvasItem) => {
      const text = item.data.text?.trim();
      if (!editable || !text || savingNoteRef.current) return;
      savingNoteRef.current = true;
      const [firstLine, ...rest] = text.split('\n');
      try {
        const note = await createProjectCanvasNote({
          accountId,
          jobId,
          title: (firstLine ?? '').slice(0, 200),
          content: rest.join('\n').trim(),
        });
        setNotes((prev) => [note, ...prev]);
        const card = buildLinkedCanvasItem(
          jobId,
          { kind: 'note', refId: note.id },
          { x: item.x, y: item.y },
        );
        const before = itemById(item.id);
        const rewired = connectorsTouching(itemsRef.current, [item.id]).map(
          (connector) => ({
            before: connector,
            after: {
              ...connector,
              data: {
                ...connector.data,
                source:
                  connector.data.source === item.id
                    ? card.id
                    : connector.data.source,
                target:
                  connector.data.target === item.id
                    ? card.id
                    : connector.data.target,
              },
            },
          }),
        );
        pendingSelectionRef.current = new Set([card.id]);
        commit([
          { before: null, after: card },
          ...rewired,
          ...(before ? [{ before, after: null }] : []),
        ]);
        broadcastLinkedChanged();
        toast.success("Saved to the project's notes");
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        savingNoteRef.current = false;
      }
    },
    [accountId, broadcastLinkedChanged, commit, editable, itemById, jobId],
  );

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

  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Browser full screen is optional; the canvas still fills the window.
      });
    }
  }, []);

  useLayoutEffect(() => {
    const parent = fullscreen ? document.body : inlineSlotRef.current;
    parent?.appendChild(frameHost);
    return () => frameHost.remove();
  }, [frameHost, fullscreen, status]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Leaving browser full screen (Esc) leaves canvas full screen too.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [fullscreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.closest('[role="listbox"],[role="menu"],[role="dialog"]'))
      ) {
        return;
      }
      if (
        selectedTaskId ||
        imageOpen ||
        editingNoteId ||
        teamOpen ||
        searchOpen ||
        aiOpen ||
        linkOpen ||
        shortcutsOpen ||
        reading
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      const onControl = target?.tagName === 'BUTTON' || target?.tagName === 'A';
      if (mod && !event.altKey && key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }
      if (editable && mod && (event.key === ']' || event.key === '[')) {
        event.preventDefault();
        if (event.key === ']') bringToFront();
        else sendToBack();
        return;
      }
      if (mod && !event.altKey && (key === 'f' || key === 'k')) {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (editable && mod && event.altKey && event.code === 'KeyG') {
        event.preventDefault();
        wrapInSection();
        return;
      }
      if (
        editable &&
        mod &&
        (key === 'b' || key === 'i') &&
        styledItems.length
      ) {
        event.preventDefault();
        toggleTextStyle(key === 'b' ? 'bold' : 'italic');
        return;
      }
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
      if (event.shiftKey && key === 'f') {
        event.preventDefault();
        if (fullscreen) setFullscreen(false);
        else enterFullscreen();
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.shiftKey && event.code === 'Digit1') {
        event.preventDefault();
        void fitView({ padding: 0.15, duration: ZOOM_DURATION_MS * 2 });
        return;
      }
      if (event.shiftKey && event.code === 'Digit2') {
        event.preventDefault();
        if (selectedIds.length > 0) {
          void fitView({
            nodes: selectedIds.map((id) => ({ id })),
            padding: 0.3,
            maxZoom: 1.5,
            duration: ZOOM_DURATION_MS * 2,
          });
        }
        return;
      }
      if (event.shiftKey && event.code === 'Digit0') {
        event.preventDefault();
        void zoomTo(1, { duration: ZOOM_DURATION_MS });
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        void zoomIn({ duration: ZOOM_DURATION_MS });
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        void zoomOut({ duration: ZOOM_DURATION_MS });
        return;
      }
      const arrow = ARROW_NUDGE[event.key];
      if (arrow && !onControl && selectedItems.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        nudgeSelection(arrow.x * step, arrow.y * step);
        return;
      }
      if (event.key === 'Enter' && !onControl && singleSelected) {
        event.preventDefault();
        openItem(singleSelected);
        return;
      }
      if (key === 'n' && !event.shiftKey && editable) {
        event.preventDefault();
        startNewNote();
        return;
      }
      if (key === 'k' && !event.shiftKey && canAddTask) {
        event.preventDefault();
        setAddTaskOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        if (fullscreen && tool === 'select' && !connectFrom && !commentsOpen) {
          setFullscreen(false);
          return;
        }
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
  }, [
    aiOpen,
    bringToFront,
    commentsOpen,
    connectFrom,
    duplicateSelection,
    editable,
    editingNoteId,
    enterFullscreen,
    fitView,
    fullscreen,
    imageOpen,
    linkOpen,
    nudgeSelection,
    openItem,
    reading,
    redo,
    searchOpen,
    selectAll,
    selectedIds,
    selectedItems.length,
    selectedTaskId,
    sendToBack,
    shortcutsOpen,
    singleSelected,
    startNewNote,
    canAddTask,
    styledItems.length,
    teamOpen,
    toggleTextStyle,
    tool,
    undo,
    wrapInSection,
    zoomIn,
    zoomOut,
    zoomTo,
  ]);

  useEffect(() => {
    if (!editable) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== document.body &&
        !wrapperRef.current?.contains(target)
      ) {
        return;
      }
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '')
      ) {
        return;
      }
      if (
        selectedTaskId ||
        imageOpen ||
        editingNoteId ||
        teamOpen ||
        searchOpen ||
        aiOpen ||
        linkOpen ||
        shortcutsOpen
      ) {
        return;
      }
      const plain = event.clipboardData?.getData('text/plain') ?? '';
      const raw = event.clipboardData?.getData(CANVAS_CLIPBOARD_MIME);
      const clip = raw
        ? parseCanvasClipboard(raw)
        : lastCanvasCopy && plain === lastCanvasCopy.text
          ? lastCanvasCopy.clip
          : null;
      if (clip) {
        event.preventDefault();
        pasteClipboard(clip);
        return;
      }
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) {
        const url = canvasUrlFromText(plain);
        if (!url) return;
        event.preventDefault();
        if (isCanvasImageUrl(url)) addImageFromUrl(url, viewportCenter());
        else void addLinkCard(url);
        return;
      }
      event.preventDefault();
      const images = files.filter((file) => canvasImageExtension(file));
      const others = files.filter((file) => !canvasImageExtension(file));
      if (images.length > 0) void uploadImages(images);
      if (others.length > 0) void uploadDocs(others);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [
    addImageFromUrl,
    addLinkCard,
    aiOpen,
    editable,
    editingNoteId,
    imageOpen,
    linkOpen,
    pasteClipboard,
    searchOpen,
    selectedTaskId,
    shortcutsOpen,
    teamOpen,
    uploadDocs,
    uploadImages,
    viewportCenter,
  ]);

  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== document.body &&
        !wrapperRef.current?.contains(target)
      ) {
        return;
      }
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '') ||
        window.getSelection()?.toString()
      ) {
        return;
      }
      if (selectedItems.length === 0) return;
      const items = copyCanvasItems(selectedItems, itemsRef.current);
      if (items.length === 0) {
        toast.info(
          "Project cards can't be copied — they're on the canvas once",
        );
        return;
      }
      const clip: CanvasClipboard = {
        v: 1,
        accountId,
        projectId: jobId,
        items,
      };
      const text =
        items
          .map((item) => item.data.text?.trim() || item.data.title?.trim())
          .filter(Boolean)
          .join('\n') || `${items.length} canvas item(s)`;
      event.preventDefault();
      event.clipboardData?.setData(CANVAS_CLIPBOARD_MIME, JSON.stringify(clip));
      event.clipboardData?.setData('text/plain', text);
      lastCanvasCopy = { text, clip };
      pasteCountRef.current = 0;
      if (event.type === 'cut' && editable) {
        removeItems(
          items
            .filter((item) => item.kind !== 'connector')
            .map((item) => item.id),
        );
        pasteCountRef.current = -1;
      }
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
    };
  }, [accountId, editable, jobId, removeItems, selectedItems]);

  const setLinkDisplay = useCallback(
    (id: string, display: LinkDisplay) => {
      const item = itemById(id);
      if (!item || item.kind !== 'link') return;
      const size = linkDisplaySize(display, resolveEmbed(item.data.url));
      // A preview with a picture needs the room.
      if (display === 'card' && item.data.imageUrl) size.h = LINK_WITH_IMAGE_H;
      patchItems([
        {
          id,
          patch: {
            w: size.w,
            h: size.h,
            data: { ...item.data, display },
          },
        },
      ]);
    },
    [itemById, patchItems],
  );

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
      editNote: isGuest && !editable ? readNote : setEditingNoteId,
      editPerson,
      openDoc,
      openEmbed: setEmbedItemId,
      setLinkDisplay,
      saveLink: (id) => void saveLinks([id]),
      linkBusy,
      editingId,
      setEditingId,
    }),
    [
      commit,
      editPerson,
      editable,
      editingId,
      isGuest,
      itemById,
      linkBusy,
      openDoc,
      openTask,
      patchItems,
      readNote,
      saveLinks,
      setLinkDisplay,
    ],
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
    const unsavedLinkIds = selectedItems
      .filter(
        (item) =>
          item.kind === 'link' &&
          item.data.url &&
          !item.data.linkId &&
          !linkBusy.has(item.id),
      )
      .map((item) => item.id);
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
        textStyle={selectionTextStyle}
        onTextStyleChange={applyTextStyle}
        onEditNote={
          single?.kind === 'note' && single.refId
            ? () => setEditingNoteId(single.refId)
            : undefined
        }
        onWrapInSection={
          selectedItems.some((item) => item.kind !== 'connector')
            ? wrapInSection
            : undefined
        }
        onComment={
          single && single.kind !== 'connector'
            ? () => openComments(single.id)
            : undefined
        }
        onAi={isGuest ? undefined : () => setAiOpen(true)}
        saveLinksCount={isGuest ? 0 : unsavedLinkIds.length}
        onSaveLinks={() => void saveLinks(unsavedLinkIds)}
        onSaveAsNote={
          single &&
          (single.kind === 'sticky' || single.kind === 'text') &&
          single.data.text?.trim()
            ? () => void saveAsProjectNote(single)
            : undefined
        }
      />
    );
  })();

  const presenceMe = me ? { ...me, color: canvasPeerColor(me.userId) } : null;
  const placing = Boolean(PLACE_TOOLS[tool]) || tool === 'connect';

  const closeNoteDialog = (open: boolean) => {
    if (!open) setEditingNoteId(null);
  };

  const onNoteSaved = (note: ProjectCanvasNote) => {
    setNotes((prev) =>
      prev.map((existing) => (existing.id === note.id ? note : existing)),
    );
    realtime.broadcastLinkedChanged();
  };

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

          <div ref={inlineSlotRef} className="contents" />
          {createPortal(
            <div
              className={cn(
                'flex overflow-hidden bg-[var(--ozer-surface-canvas)]',
                fullscreen
                  ? 'fixed inset-0 z-50 h-dvh w-screen'
                  : 'h-[calc(100vh-15rem)] min-h-[560px] rounded-xl border border-[color:var(--workspace-shell-border)]',
              )}
              data-test="project-canvas"
              data-fullscreen={fullscreen || undefined}
            >
              {trayOpen && editable && !isGuest ? (
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
                  disableKeyboardA11y
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
                  {available ? (
                    <CanvasCommentPins
                      threads={commentThreads}
                      itemsById={displayById}
                      activeItemId={commentsOpen ? commentItemId : null}
                      onOpen={openComments}
                    />
                  ) : null}
                  {DRAW_TOOLS.has(tool) && editable ? (
                    <CanvasRectOverlay onDraw={onDrawRect} />
                  ) : null}
                  {tool === 'pen' && editable ? (
                    <CanvasPenOverlay
                      color={CANVAS_COLORS[penColor].stroke}
                      width={penWidth}
                      onStroke={onStroke}
                    />
                  ) : null}
                </ReactFlow>

                {editable ? (
                  <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2">
                    {isGuest ? null : (
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
                        {trayEntries.length > 0
                          ? ` (${trayEntries.length})`
                          : ''}
                      </Button>
                    )}
                    {board.phases.length > 0 &&
                    boardView === 'free' &&
                    !isGuest ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="pointer-events-auto h-8 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] shadow-sm"
                        title="Lay phases out as columns with their tasks and notes inside"
                        onClick={arrangeByPhase}
                      >
                        <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                        Arrange by phase
                      </Button>
                    ) : null}
                    {isGuest ? null : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="pointer-events-auto h-8 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] shadow-sm"
                        title="Client contacts and team members, with their roles"
                        onClick={() => {
                          setTeamFocus(null);
                          setTeamOpen(true);
                        }}
                      >
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        Team
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="pointer-events-auto h-8 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] shadow-sm"
                        >
                          Templates
                          <ChevronDown className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72">
                        <DropdownMenuItem onSelect={insertTimeline}>
                          <GanttChart className="mr-2 h-4 w-4" />
                          <div className="min-w-0">
                            <div className="text-sm">Timeline lane</div>
                            <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                              Phases, milestones and task due dates, live
                            </div>
                          </div>
                        </DropdownMenuItem>
                        {isGuest ? null : (
                          <DropdownMenuItem
                            onSelect={() => insertRoadmap('roadmap')}
                          >
                            <Route className="mr-2 h-4 w-4" />
                            <div className="min-w-0">
                              <div className="text-sm">Roadmap</div>
                              <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                                Phases, tasks, content and notes by week or
                                month
                              </div>
                            </div>
                          </DropdownMenuItem>
                        )}
                        {isGuest ? null : (
                          <DropdownMenuItem
                            onSelect={() => insertRoadmap('calendar')}
                          >
                            <CalendarRange className="mr-2 h-4 w-4" />
                            <div className="min-w-0">
                              <div className="text-sm">Content calendar</div>
                              <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                                Posts per day with platforms and status
                              </div>
                            </div>
                          </DropdownMenuItem>
                        )}
                        {isGuest ? null : (
                          <DropdownMenuItem onSelect={arrangeTeam}>
                            <Users className="mr-2 h-4 w-4" />
                            <div className="min-w-0">
                              <div className="text-sm">Team</div>
                              <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                                Client, contacts and team with roles
                              </div>
                            </div>
                          </DropdownMenuItem>
                        )}
                        {CANVAS_SECTION_TEMPLATES.map((template) => {
                          const Icon =
                            TEMPLATE_ICONS[template.preset] ?? LayoutGrid;
                          return (
                            <DropdownMenuItem
                              key={template.preset}
                              onSelect={() => insertTemplate(template)}
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              <div className="min-w-0">
                                <div className="text-sm">{template.title}</div>
                                <div className="text-xs text-[var(--workspace-shell-text-muted)]">
                                  {template.description}
                                </div>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {uploadingImages + uploadingFiles > 0 ? (
                      <span className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] px-2.5 py-1.5 text-xs text-[var(--workspace-shell-text-muted)] shadow-sm">
                        Uploading {uploadingImages + uploadingFiles} file
                        {uploadingImages + uploadingFiles === 1 ? '' : 's'}…
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {selectionBar}

                <CanvasPresence
                  peers={realtime.peers}
                  me={presenceMe}
                  connected={realtime.connected}
                  actions={
                    <>
                      {available ? (
                        <>
                          {CANVAS_BOARD_VIEWS.map((view) => {
                            const option = BOARD_VIEW_OPTIONS[view];
                            const Icon = option.icon;
                            return (
                              <ToolButton
                                key={view}
                                label={option.label}
                                active={boardView === view}
                                onClick={() => changeBoardView(view)}
                              >
                                <Icon className="h-4 w-4" />
                              </ToolButton>
                            );
                          })}
                          <span
                            aria-hidden
                            className="mx-0.5 h-5 w-px shrink-0 bg-[var(--workspace-shell-border)]"
                          />
                        </>
                      ) : null}
                      <ToolButton
                        label="Search the canvas (⌘F)"
                        onClick={() => setSearchOpen(true)}
                      >
                        <Search className="h-4 w-4" />
                      </ToolButton>
                      <ToolButton
                        label={
                          fullscreen
                            ? 'Exit full screen (Esc)'
                            : 'Full screen (⇧F)'
                        }
                        active={fullscreen}
                        onClick={() =>
                          fullscreen ? setFullscreen(false) : enterFullscreen()
                        }
                      >
                        {fullscreen ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </ToolButton>
                      <ToolButton
                        label="Keyboard shortcuts (?)"
                        onClick={() => setShortcutsOpen(true)}
                      >
                        <Keyboard className="h-4 w-4" />
                      </ToolButton>
                      {available ? (
                        <span className="relative">
                          <ToolButton
                            label="Comments"
                            active={commentsOpen}
                            onClick={() => {
                              if (commentsOpen) {
                                setCommentsOpen(false);
                              } else {
                                openComments(null);
                              }
                            }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </ToolButton>
                          {openCommentCount > 0 && !commentsOpen ? (
                            <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ozer-accent)] px-1 text-[9px] font-bold text-[var(--ozer-white)]">
                              {openCommentCount}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {editable && !isGuest ? (
                        <ToolButton
                          label="Canvas AI"
                          onClick={() => setAiOpen(true)}
                        >
                          <Sparkles className="h-4 w-4" />
                        </ToolButton>
                      ) : null}
                    </>
                  }
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
                  onAddLink={() => setLinkOpen(true)}
                  onAddFile={() => docInputRef.current?.click()}
                  onAddNote={available ? () => startNewNote() : undefined}
                  onAddTask={
                    canAddTask ? () => setAddTaskOpen(true) : undefined
                  }
                  penColor={penColor}
                  onPenColorChange={setPenColor}
                  penWidth={penWidth}
                  onPenWidthChange={setPenWidth}
                  shapeType={shapeType}
                  onShapeTypeChange={setShapeType}
                  connectPending={Boolean(connectFrom)}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = '';
                    void uploadDocs(files);
                  }}
                />
              </div>

              {commentsOpen && available ? (
                <CanvasCommentsPanel
                  accountId={accountId}
                  accountSlug={accountSlug}
                  jobId={jobId}
                  threads={commentThreads}
                  itemLabel={itemLabel}
                  activeItemId={commentItemId}
                  onActiveItemChange={setCommentItemId}
                  onFocusItem={focusItem}
                  selection={
                    singleSelected
                      ? {
                          id: singleSelected.id,
                          label: canvasItemText(singleSelected, lookups).label,
                        }
                      : null
                  }
                  people={lookups.peopleById}
                  mentionable={guest ? [] : workspaceMembers}
                  currentUserId={user?.id ?? null}
                  canModerate={editable && !isGuest}
                  canComment={guest ? guest.canComment : true}
                  onUpsert={upsertComment}
                  onRemove={removeComment}
                  onClose={() => setCommentsOpen(false)}
                />
              ) : null}
            </div>,
            frameHost,
          )}
        </div>

        <CanvasSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          entries={searchEntries}
          onPick={focusItem}
        />

        {editable && !isGuest ? (
          <CanvasAiDialog
            open={aiOpen}
            onOpenChange={setAiOpen}
            accountId={accountId}
            jobId={jobId}
            selection={aiSelection}
            sections={aiSections}
            defaultSectionId={aiDefaultSectionId}
            phases={aiPhases}
            onApply={applyAi}
          />
        ) : null}

        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add image</DialogTitle>
            </DialogHeader>
            <input
              ref={fileInputRef}
              type="file"
              accept={CANVAS_IMAGE_ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length === 0) return;
                setImageOpen(false);
                void uploadImages(files);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)] hover:text-[var(--workspace-shell-text)]"
            >
              <Upload className="h-5 w-5" />
              <span className="font-medium text-[var(--workspace-shell-text)]">
                Upload from your computer
              </span>
              <span className="text-xs">
                PNG, JPG, WebP or GIF up to 10MB — or drop / paste onto the
                canvas
              </span>
            </button>
            <div className="flex items-center gap-3 text-xs text-[var(--workspace-shell-text-muted)]">
              <span className="h-px flex-1 bg-[var(--workspace-shell-border)]" />
              or link to one
              <span className="h-px flex-1 bg-[var(--workspace-shell-border)]" />
            </div>
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

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add link</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitLink();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="canvas-link-url">Web address</Label>
                <Input
                  id="canvas-link-url"
                  data-test="canvas-link-url"
                  value={linkUrl}
                  autoFocus
                  placeholder="https://"
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  We&apos;ll fetch the page title and preview. You can also
                  paste or drop a link straight onto the canvas, then save it to
                  the project&apos;s links in Notes.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  data-test="canvas-link-submit"
                  disabled={!linkUrl.trim()}
                >
                  Add to canvas
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <CanvasNoteDialog
          accountId={accountId}
          jobId={jobId}
          noteId={editingNoteId}
          onOpenChange={closeNoteDialog}
          onSaved={onNoteSaved}
          onCreated={onNoteCreated}
        />

        <CanvasShortcutsDialog
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />

        <CanvasReadingDialog reading={reading} onClose={closeReading} />

        <CanvasAddTaskDialog
          open={addTaskOpen}
          phases={board.phases.map((phase) => ({
            id: phase.id,
            name: phase.name,
          }))}
          defaultPhaseId={board.phases[0]?.id ?? null}
          canPickPhase={!isGuest}
          onOpenChange={setAddTaskOpen}
          onCreate={addTask}
        />

        <CanvasEmbedDialog
          embed={
            embedItemId
              ? resolveEmbed(
                  items.find((item) => item.id === embedItemId)?.data.url,
                )
              : null
          }
          title={items.find((item) => item.id === embedItemId)?.data.title}
          onClose={() => setEmbedItemId(null)}
        />

        <CanvasMetricDialog
          item={
            editingId
              ? (items.find(
                  (item) => item.id === editingId && item.kind === 'metric',
                ) ?? null)
              : null
          }
          onSave={(id, patch, size) => {
            actions.updateItemData(id, patch);
            const target = items.find((item) => item.id === id);
            if (size && target) {
              actions.resizeItem(id, {
                x: target.x,
                y: target.y,
                width: size.w,
                height: size.h,
              });
            }
          }}
          onClose={() => setEditingId(null)}
        />

        {isGuest ? null : (
          <CanvasTeamDialog
            open={teamOpen}
            onOpenChange={setTeamOpen}
            accountId={accountId}
            accountSlug={accountSlug}
            jobId={jobId}
            canEdit={editable}
            focus={teamFocus}
            team={teamList}
            workspaceMembers={workspaceMembers}
            client={lookups.client}
            contacts={contacts}
            onChanged={onTeamChanged}
            onLayoutSection={() => {
              setTeamOpen(false);
              arrangeTeam();
            }}
          />
        )}

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
