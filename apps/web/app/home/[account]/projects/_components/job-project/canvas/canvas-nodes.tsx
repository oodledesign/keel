'use client';

import { type CSSProperties, memo, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  Handle,
  type Node,
  type NodeProps,
  NodeResizer,
  Position,
  getBezierPath,
} from '@xyflow/react';
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Link2,
  ListChecks,
  Pin,
  StickyNote,
} from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { canvasPathToSvg } from '~/lib/projects/canvas/canvas-path';
import {
  type CanvasItem,
  type CanvasItemData,
  canvasColor,
} from '~/lib/projects/canvas/canvas-types';
import { projectPhaseHref } from '~/lib/projects/project-paths';
import { taskStatusBadgeClass } from '~/lib/projects/task-status-badge';

import {
  PHASE_STATUS_LABELS,
  PHASE_STATUS_STYLES,
  PRIORITY_DOT,
  TASK_STATUS_LABELS,
  formatShortDate,
  phaseHeaderTitleClass,
} from '../job-project.constants';
import {
  type CanvasNodeData,
  useCanvasActions,
  useCanvasLookups,
} from './canvas-context';

type CanvasNode = Node<CanvasNodeData>;
type CanvasNodeProps = NodeProps<CanvasNode>;

const HANDLE_SIDES = [
  [Position.Top, 'top'],
  [Position.Right, 'right'],
  [Position.Bottom, 'bottom'],
  [Position.Left, 'left'],
] as const;

const cardClass =
  'group relative h-full w-full rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] shadow-sm';

const iconLinkClass =
  'nodrag inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]';

/** Always rendered so saved arrows can attach; only interactive for editors. */
function ConnectHandles() {
  const { canEdit } = useCanvasLookups();
  return (
    <>
      {HANDLE_SIDES.map(([position, id]) => (
        <Handle
          key={id}
          id={id}
          type="source"
          position={position}
          isConnectable={canEdit}
          className={cn(
            '!h-2.5 !w-2.5 !border-2 !border-[var(--ozer-surface-panel)] !bg-[var(--ozer-accent)] transition-opacity',
            canEdit
              ? 'opacity-0 group-hover:opacity-100'
              : 'pointer-events-none !opacity-0',
          )}
        />
      ))}
    </>
  );
}

function Resizer({
  id,
  selected,
  minWidth = 60,
  minHeight = 40,
}: {
  id: string;
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
}) {
  const { canEdit } = useCanvasLookups();
  const { resizeItem } = useCanvasActions();
  return (
    <NodeResizer
      isVisible={selected && canEdit}
      minWidth={minWidth}
      minHeight={minHeight}
      lineClassName="!border-[var(--ozer-accent)]"
      handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-[var(--ozer-accent)] !bg-[var(--ozer-surface-panel)]"
      onResizeEnd={(_event, box) => resizeItem(id, box)}
    />
  );
}

type EditableField = 'text' | 'title';

/** Double-click (handled by the canvas) puts an item into edit mode. */
function EditableText({
  itemId,
  field,
  value,
  placeholder,
  className,
  style,
  singleLine = false,
}: {
  itemId: string;
  field: EditableField;
  value: string;
  placeholder: string;
  className?: string;
  style?: CSSProperties;
  singleLine?: boolean;
}) {
  const { canEdit } = useCanvasLookups();
  const { editingId } = useCanvasActions();

  if (canEdit && editingId === itemId) {
    return (
      <TextEditor
        itemId={itemId}
        field={field}
        value={value}
        className={className}
        style={style}
        singleLine={singleLine}
      />
    );
  }

  return (
    <div
      className={cn(
        'h-full w-full overflow-hidden break-words whitespace-pre-wrap',
        !value && 'opacity-50',
        className,
      )}
      style={style}
    >
      {value || placeholder}
    </div>
  );
}

function TextEditor({
  itemId,
  field,
  value,
  className,
  style,
  singleLine,
}: {
  itemId: string;
  field: EditableField;
  value: string;
  className?: string;
  style?: CSSProperties;
  singleLine: boolean;
}) {
  const { setEditingId, updateItemData } = useCanvasActions();
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    setEditingId(null);
    if (draft !== value) {
      updateItemData(itemId, { [field]: draft } as Partial<CanvasItemData>);
    }
  };

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          done.current = true;
          setEditingId(null);
        } else if (
          event.key === 'Enter' &&
          (singleLine || event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          commit();
        }
      }}
      className={cn(
        'nodrag nowheel nopan h-full w-full resize-none bg-transparent outline-none',
        className,
      )}
      style={style}
    />
  );
}

function PhaseNode({ id, data, selected }: CanvasNodeProps) {
  const { phasesById, accountSlug, jobId } = useCanvasLookups();
  const phase = phasesById.get(data.item.refId ?? '');
  if (!phase) return null;

  const colour = phase.colour || 'var(--ozer-accent)';
  const counts = phase.taskCountsByStatus;
  const total =
    counts.todo + counts.in_progress + counts.client_review + counts.done;

  return (
    <div
      className="group relative h-full w-full rounded-2xl border-2 border-dashed"
      style={{
        borderColor: `color-mix(in srgb, ${colour} 45%, transparent)`,
        background: `color-mix(in srgb, ${colour} 6%, transparent)`,
      }}
    >
      <Resizer id={id} selected={selected} minWidth={240} minHeight={140} />
      <ConnectHandles />
      <div className="flex items-center gap-2 px-4 pt-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: colour }}
        />
        <p
          className={cn(
            'font-heading min-w-0 flex-1 truncate text-base font-bold',
            phaseHeaderTitleClass(phase.status),
          )}
        >
          {phase.name}
        </p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            PHASE_STATUS_STYLES[phase.status],
          )}
        >
          {PHASE_STATUS_LABELS[phase.status]}
        </span>
        <Link
          href={projectPhaseHref(accountSlug, jobId, phase.id)}
          className={iconLinkClass}
          title="Open phase"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex items-center gap-3 px-4 pt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
        <span>{phase.progressPct}%</span>
        <span>
          {counts.done}/{total} tasks
        </span>
        {phase.due_date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatShortDate(phase.due_date)}
          </span>
        ) : null}
      </div>
      <div className="mx-4 mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${phase.progressPct}%`, background: colour }}
        />
      </div>
    </div>
  );
}

function TaskNode({ data, selected }: CanvasNodeProps) {
  const { tasksById, peopleById, subtaskCounts } = useCanvasLookups();
  const task = tasksById.get(data.item.refId ?? '');
  if (!task) return null;

  const done = task.status === 'done' || task.status === 'cancelled';
  const assigneeId = task.user_id ?? task.assignee_contact_id;
  const assignee = assigneeId ? peopleById.get(assigneeId) : undefined;
  const subtasks = subtaskCounts.get(task.id);

  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col justify-between px-3 py-2',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
      title="Double-click to open"
    >
      <ConnectHandles />
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.none,
          )}
        />
        <p
          className={cn(
            'line-clamp-2 text-sm leading-snug font-medium',
            done && 'text-[var(--workspace-shell-text-muted)] line-through',
          )}
        >
          {task.title}
        </p>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            taskStatusBadgeClass(task.status),
          )}
        >
          {TASK_STATUS_LABELS[task.status] ?? task.status}
        </span>
        {task.due_date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatShortDate(task.due_date)}
          </span>
        ) : null}
        {subtasks ? (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {subtasks.done}/{subtasks.total}
          </span>
        ) : null}
        {assignee ? (
          <ProfileAvatar
            displayName={assignee.name ?? assignee.email}
            pictureUrl={assignee.pictureUrl}
            className="ml-auto h-5 w-5 text-[9px]"
          />
        ) : null}
      </div>
    </div>
  );
}

function MemberNode({ data, selected }: CanvasNodeProps) {
  const { teamById, openTaskCountByPerson } = useCanvasLookups();
  const person = teamById.get(data.item.refId ?? '');
  if (!person) return null;
  const openTasks = openTaskCountByPerson.get(person.id) ?? 0;

  return (
    <div
      className={cn(
        cardClass,
        'flex items-center gap-3 rounded-full px-3',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <ConnectHandles />
      <ProfileAvatar
        displayName={person.name ?? person.email}
        pictureUrl={person.pictureUrl}
        className="h-10 w-10"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {person.name || person.email || 'Team member'}
        </p>
        <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
          {[person.role, `${openTasks} open task${openTasks === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </div>
  );
}

function ClientNode({ selected }: CanvasNodeProps) {
  const { client, accountSlug } = useCanvasLookups();
  if (!client) return null;
  const href = pathsConfig.app.accountClientDetail
    .replace('[account]', accountSlug)
    .replace('[clientId]', client.id);

  return (
    <div
      className={cn(
        cardClass,
        'flex items-center gap-3 px-3',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <ConnectHandles />
      {client.pictureUrl ? (
        <ProfileAvatar
          displayName={client.displayName}
          pictureUrl={client.pictureUrl}
          className="h-11 w-11"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]">
          <Building2 className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          Client
        </p>
        <p className="truncate text-sm font-semibold">
          {client.displayName || client.companyName || 'Client'}
        </p>
        <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
          {[client.companyName, client.email].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Link href={href} className={iconLinkClass} title="Open client">
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function NoteNode({ id, data, selected }: CanvasNodeProps) {
  const { notesById, accountSlug } = useCanvasLookups();
  const note = notesById.get(data.item.refId ?? '');
  if (!note) return null;
  const href = pathsConfig.app.accountNoteDetail
    .replace('[account]', accountSlug)
    .replace('[noteId]', note.id);

  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col overflow-hidden border-l-4 border-l-[var(--ozer-info)] px-3 py-2',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={180} minHeight={80} />
      <ConnectHandles />
      <div className="flex items-center gap-1.5">
        <StickyNote className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-info)]" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {note.title || 'Untitled note'}
        </p>
        {note.isPinned ? (
          <Pin className="h-3 w-3 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={iconLinkClass}
          title="Open note"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="mt-1 min-h-0 flex-1 overflow-hidden text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]">
        {note.preview || 'Empty note'}
      </p>
    </div>
  );
}

function StickyNode({ id, data, selected }: CanvasNodeProps) {
  const color = canvasColor(data.item.data.color, 'yellow');
  return (
    <div
      className={cn(
        'group relative h-full w-full rounded-md p-3 shadow-md',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
      style={{ background: color.fill, color: color.text }}
    >
      <Resizer id={id} selected={selected} minWidth={80} minHeight={80} />
      <ConnectHandles />
      <EditableText
        itemId={id}
        field="text"
        value={data.item.data.text ?? ''}
        placeholder="Double-click to write"
        className="text-sm leading-snug"
      />
    </div>
  );
}

function TextNode({ id, data, selected }: CanvasNodeProps) {
  const color = data.item.data.color
    ? canvasColor(data.item.data.color, 'plum').stroke
    : undefined;
  return (
    <div
      className={cn(
        'group relative h-full w-full rounded-md px-1',
        selected && 'outline-1 outline-[var(--ozer-accent)] outline-dashed',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={60} minHeight={28} />
      <ConnectHandles />
      <EditableText
        itemId={id}
        field="text"
        value={data.item.data.text ?? ''}
        placeholder="Text"
        className="font-heading text-xl leading-tight font-bold text-[var(--workspace-shell-text)]"
        style={color ? { color } : undefined}
      />
    </div>
  );
}

function ShapeOutline({
  shape,
  fill,
  stroke,
}: {
  shape: CanvasItemData['shape'];
  fill: string;
  stroke: string;
}) {
  const common = {
    fill,
    stroke,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  return (
    <svg
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {shape === 'ellipse' ? (
        <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />
      ) : shape === 'diamond' ? (
        <polygon points="50,0 100,50 50,100 0,50" {...common} />
      ) : (
        <rect x="0" y="0" width="100" height="100" rx="8" ry="8" {...common} />
      )}
    </svg>
  );
}

function ShapeNode({ id, data, selected }: CanvasNodeProps) {
  const color = canvasColor(data.item.data.color, 'blue');
  return (
    <div
      className={cn(
        'group relative h-full w-full',
        selected &&
          'outline-1 outline-offset-4 outline-[var(--ozer-accent)] outline-dashed',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={40} minHeight={40} />
      <ConnectHandles />
      <ShapeOutline
        shape={data.item.data.shape}
        fill={color.fill}
        stroke={color.stroke}
      />
      <div
        className="relative flex h-full w-full items-center justify-center p-4 text-center"
        style={{ color: color.text }}
      >
        <EditableText
          itemId={id}
          field="text"
          value={data.item.data.text ?? ''}
          placeholder=""
          className="flex h-auto max-h-full items-center justify-center text-center text-sm font-medium"
        />
      </div>
    </div>
  );
}

function FrameNode({ id, data, selected }: CanvasNodeProps) {
  const color = canvasColor(data.item.data.color, 'slate');
  return (
    <div
      className="group relative h-full w-full rounded-2xl border-2"
      style={{
        borderColor: `color-mix(in srgb, ${color.stroke} 40%, transparent)`,
        background: `color-mix(in srgb, ${color.fill} 30%, transparent)`,
      }}
    >
      <Resizer id={id} selected={selected} minWidth={160} minHeight={120} />
      <ConnectHandles />
      <div className="px-4 pt-3">
        <EditableText
          itemId={id}
          field="title"
          singleLine
          value={data.item.data.title ?? ''}
          placeholder="Frame"
          className="font-heading h-6 text-base font-bold"
          style={{ color: color.stroke }}
        />
      </div>
    </div>
  );
}

function safeHostname(url: string | undefined) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function ImageNode({ id, data, selected }: CanvasNodeProps) {
  const [failed, setFailed] = useState(false);
  const url = data.item.data.url;
  const title = data.item.data.title;
  const host = safeHostname(url);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : undefined;

  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col overflow-hidden',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={120} minHeight={80} />
      <ConnectHandles />
      {safeUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied hosts
        <img
          src={safeUrl}
          alt={title ?? host}
          className="min-h-0 w-full flex-1 object-cover"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-3 text-[var(--workspace-shell-text-muted)]">
          <Link2 className="h-6 w-6" />
          <span className="max-w-full truncate text-xs">{host || 'Link'}</span>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-[color:var(--workspace-shell-border)] px-3 py-1.5 text-xs">
        <span className="min-w-0 flex-1 truncate">{title || host}</span>
        {safeUrl ? (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={iconLinkClass}
            title="Open link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DrawNode({ data, selected }: CanvasNodeProps) {
  const { item } = data;
  const color = canvasColor(item.data.color, 'plum').stroke;
  const width = item.data.strokeWidth ?? 3;
  const d = canvasPathToSvg(item.data.points ?? []);
  const w = item.w ?? 1;
  const h = item.h ?? 1;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${w} ${h}`}
      className="overflow-visible"
      style={{ pointerEvents: 'none' }}
    >
      {selected ? (
        <rect
          x="0"
          y="0"
          width={w}
          height={h}
          fill="none"
          stroke="var(--ozer-accent)"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(width, 14)}
        strokeLinecap="round"
        style={{ pointerEvents: 'stroke' }}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'stroke' }}
      />
    </svg>
  );
}

export const canvasNodeTypes = {
  phase: memo(PhaseNode),
  task: memo(TaskNode),
  member: memo(MemberNode),
  client: memo(ClientNode),
  note: memo(NoteNode),
  sticky: memo(StickyNode),
  text: memo(TextNode),
  shape: memo(ShapeNode),
  frame: memo(FrameNode),
  image: memo(ImageNode),
  draw: memo(DrawNode),
};

export type CanvasEdgeData = { item: CanvasItem };

function ConnectorEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<Edge<CanvasEdgeData>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const color = canvasColor(data?.item.data.color, 'slate').stroke;
  const label = data?.item.data.label;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={18}
        style={{ stroke: color, strokeWidth: selected ? 3 : 2 }}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text)] shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const canvasEdgeTypes = {
  connector: memo(ConnectorEdge),
};
