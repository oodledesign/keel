'use client';

import {
  type CSSProperties,
  type ReactNode,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  BookmarkPlus,
  Building2,
  CalendarDays,
  Check,
  ExternalLink,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  GanttChart,
  Globe,
  Image as ImageIcon,
  Link2,
  ListChecks,
  NotebookPen,
  PencilLine,
  Pin,
  StickyNote,
} from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  type NoteMarkdownRun,
  parseNoteMarkdown,
} from '~/lib/notes/note-markdown';
import { canvasPathToSvg } from '~/lib/projects/canvas/canvas-path';
import { buildCanvasTimeline } from '~/lib/projects/canvas/canvas-timeline';
import {
  type CanvasItem,
  type CanvasItemData,
  type CanvasTextKind,
  canvasColor,
  canvasTextStyle,
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
import { useCanvasImageUrl } from './canvas-images';

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
  keepAspectRatio = false,
}: {
  id: string;
  selected: boolean;
  minWidth?: number;
  minHeight?: number;
  keepAspectRatio?: boolean;
}) {
  const { canEdit } = useCanvasLookups();
  const { resizeItem } = useCanvasActions();
  return (
    <NodeResizer
      isVisible={selected && canEdit}
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspectRatio}
      lineClassName="!border-[var(--ozer-accent)]"
      handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-[var(--ozer-accent)] !bg-[var(--ozer-surface-panel)]"
      onResizeEnd={(_event, box) => resizeItem(id, box)}
    />
  );
}

type EditableField = 'text' | 'title';

function textStyleCss(
  kind: CanvasTextKind,
  data: CanvasItemData,
  regularWeight = 400,
): CSSProperties {
  const style = canvasTextStyle(kind, data);
  return {
    fontSize: style.fontSize,
    lineHeight: 1.3,
    fontWeight: style.bold ? 700 : regularWeight,
    fontStyle: style.italic ? 'italic' : 'normal',
  };
}

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

function PersonCard({
  id,
  selected,
  name,
  pictureUrl,
  badge,
  role,
  description,
  meta,
  onEdit,
}: {
  id: string;
  selected: boolean;
  name: string;
  pictureUrl: string | null;
  badge: string;
  role: string | null | undefined;
  description: string | null | undefined;
  meta: string;
  onEdit: () => void;
}) {
  const { canEdit } = useCanvasLookups();
  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col gap-1.5 overflow-hidden px-3 py-2.5',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
      title={canEdit ? 'Double-click to edit role and description' : undefined}
    >
      <Resizer id={id} selected={selected} minWidth={200} minHeight={64} />
      <ConnectHandles />
      <div className="flex items-center gap-2.5">
        <ProfileAvatar
          displayName={name}
          pictureUrl={pictureUrl}
          className="h-9 w-9 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold">{name}</p>
          <p className="truncate text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
            {role || (
              <span className="text-[var(--workspace-shell-text-muted)]">
                {badge}
              </span>
            )}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className={cn(iconLinkClass, 'opacity-0 group-hover:opacity-100')}
            title="Edit role"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="line-clamp-3 min-h-0 flex-1 text-[11px] leading-snug text-[var(--workspace-shell-text-muted)]">
        {description || meta}
      </p>
    </div>
  );
}

function MemberNode({ id, data, selected }: CanvasNodeProps) {
  const { teamById, openTaskCountByPerson } = useCanvasLookups();
  const { editPerson } = useCanvasActions();
  const person = teamById.get(data.item.refId ?? '');
  if (!person) return null;
  const openTasks = openTaskCountByPerson.get(person.id) ?? 0;

  return (
    <PersonCard
      id={id}
      selected={selected}
      name={person.name || person.email || 'Team member'}
      pictureUrl={person.pictureUrl}
      badge="Team member"
      role={person.role}
      description={person.description}
      meta={`Team · ${openTasks} open task${openTasks === 1 ? '' : 's'}`}
      onEdit={() => editPerson({ kind: 'member', id: person.id })}
    />
  );
}

function ContactNode({ id, data, selected }: CanvasNodeProps) {
  const { contactsById } = useCanvasLookups();
  const { editPerson } = useCanvasActions();
  const contact = contactsById.get(data.item.refId ?? '');
  if (!contact) return null;
  const badge = contact.isClientContact ? 'Client contact' : 'Contact';

  return (
    <PersonCard
      id={id}
      selected={selected}
      name={contact.name}
      pictureUrl={contact.pictureUrl}
      badge={badge}
      role={contact.role}
      description={contact.description}
      meta={[badge, contact.companyName, contact.email, contact.phone]
        .filter(Boolean)
        .join(' · ')}
      onEdit={() => editPerson({ kind: 'contact', id: contact.id })}
    />
  );
}

function DocIcon({
  doc,
  className,
}: {
  doc: { kind: string; mimeType: string | null };
  className?: string;
}) {
  const mime = doc.mimeType ?? '';
  if (doc.kind === 'written') return <NotebookPen className={className} />;
  if (mime.startsWith('image/')) return <FileImage className={className} />;
  if (mime.startsWith('video/')) return <FileVideo className={className} />;
  if (/spreadsheet|excel|csv/.test(mime)) {
    return <FileSpreadsheet className={className} />;
  }
  if (/zip|compressed|archive/.test(mime)) {
    return <FileArchive className={className} />;
  }
  return <FileText className={className} />;
}

function docTypeLabel(doc: { kind: string; mimeType: string | null }) {
  if (doc.kind === 'written') return 'Doc';
  const mime = doc.mimeType ?? '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (/spreadsheet|excel|csv/.test(mime)) return 'Spreadsheet';
  if (/presentation|powerpoint/.test(mime)) return 'Slides';
  if (/word|document/.test(mime)) return 'Document';
  return 'File';
}

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocNode({ id, data, selected }: CanvasNodeProps) {
  const { docsById } = useCanvasLookups();
  const { openDoc } = useCanvasActions();
  const doc = docsById.get(data.item.refId ?? '');
  if (!doc) return null;

  return (
    <div
      className={cn(
        cardClass,
        'flex items-center gap-3 overflow-hidden px-3',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
      title="Double-click to open"
    >
      <Resizer id={id} selected={selected} minWidth={180} minHeight={56} />
      <ConnectHandles />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]">
        <DocIcon doc={doc} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-semibold break-words">
          {doc.title}
        </p>
        <p className="truncate text-[11px] text-[var(--workspace-shell-text-muted)]">
          {[
            docTypeLabel(doc),
            formatBytes(doc.sizeBytes),
            doc.updatedAt ? formatShortDate(doc.updatedAt) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openDoc(doc.id)}
        className={iconLinkClass}
        title="Open"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
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

function MarkdownRuns({ runs }: { runs: NoteMarkdownRun[] }) {
  return runs.map((run, index) => (
    <span
      key={index}
      className={cn(
        run.bold && 'font-semibold text-[var(--workspace-shell-text)]',
        run.italic && 'italic',
        run.underline && 'underline',
      )}
    >
      {run.text}
    </span>
  ));
}

function NoteBody({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseNoteMarkdown(markdown), [markdown]);
  return blocks.map((block, index) => {
    if (block.kind === 'heading1' || block.kind === 'heading2') {
      return (
        <p
          key={index}
          className={cn(
            'mt-2 font-semibold text-[var(--workspace-shell-text)] first:mt-0',
            block.kind === 'heading1' ? 'text-sm' : 'text-[13px]',
          )}
        >
          <MarkdownRuns runs={block.runs} />
        </p>
      );
    }
    if (block.kind === 'bullet') {
      return (
        <p
          key={index}
          className="relative mt-0.5 pl-3 before:absolute before:left-0 before:content-['•']"
        >
          <MarkdownRuns runs={block.runs} />
        </p>
      );
    }
    return (
      <p key={index} className="mt-1.5 first:mt-0">
        <MarkdownRuns runs={block.runs} />
      </p>
    );
  });
}

function NoteNode({ id, data, selected }: CanvasNodeProps) {
  const { notesById, accountSlug, canEdit } = useCanvasLookups();
  const { editNote } = useCanvasActions();
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
      title={canEdit ? 'Double-click to edit' : undefined}
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
        {canEdit ? (
          <button
            type="button"
            className={iconLinkClass}
            title="Edit note"
            onClick={() => editNote(note.id)}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
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
      <div
        className={cn(
          'relative mt-1 min-h-0 flex-1 text-xs leading-relaxed text-[var(--workspace-shell-text-muted)]',
          selected ? 'nowheel overflow-y-auto' : 'overflow-hidden',
        )}
      >
        {note.content.trim() ? (
          <NoteBody markdown={note.content} />
        ) : (
          <p>Empty note</p>
        )}
        {note.truncated ? (
          <p className="mt-2 italic">Open the note to read the rest…</p>
        ) : null}
      </div>
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
        style={textStyleCss('sticky', data.item.data)}
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
      <Resizer id={id} selected={selected} minWidth={60} minHeight={24} />
      <ConnectHandles />
      <EditableText
        itemId={id}
        field="text"
        value={data.item.data.text ?? ''}
        placeholder="Text"
        className="font-heading text-[var(--workspace-shell-text)]"
        style={{
          ...textStyleCss('text', data.item.data),
          ...(color ? { color } : null),
        }}
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
          className="flex h-auto max-h-full items-center justify-center text-center"
          style={textStyleCss('shape', data.item.data, 500)}
        />
      </div>
    </div>
  );
}

/** Figma-style section: contents move with it and it renders behind them. */
function FrameNode({ id, data, selected }: CanvasNodeProps) {
  const color = canvasColor(data.item.data.color, 'slate');
  const titleStyle = textStyleCss('frame', data.item.data);
  return (
    <div
      className={cn(
        'group relative h-full w-full rounded-2xl border-2',
        selected && 'border-dashed',
      )}
      style={{
        borderColor: selected
          ? 'var(--ozer-accent)'
          : `color-mix(in srgb, ${color.stroke} 40%, transparent)`,
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
          placeholder="Section"
          className="font-heading truncate whitespace-nowrap"
          style={{
            ...titleStyle,
            color: color.stroke,
            height: Math.ceil((titleStyle.fontSize as number) * 1.3) + 2,
          }}
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

function UploadedImageNode({ id, data, selected }: CanvasNodeProps) {
  const url = useCanvasImageUrl(data.item.data.path);
  const title = data.item.data.title;

  return (
    <div
      className={cn(
        'group relative h-full w-full overflow-hidden rounded-lg bg-[var(--workspace-shell-sidebar-accent)] shadow-sm',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
      title={title}
    >
      <Resizer
        id={id}
        selected={selected}
        minWidth={40}
        minHeight={40}
        keepAspectRatio
      />
      <ConnectHandles />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
        <img
          src={url}
          alt={title ?? 'Canvas image'}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-[var(--workspace-shell-text-muted)]">
          <ImageIcon
            className={cn('h-6 w-6', url === undefined && 'animate-pulse')}
          />
          {url === null ? "Couldn't load image" : null}
        </div>
      )}
    </div>
  );
}

function ImageNode(props: CanvasNodeProps) {
  return props.data.item.data.path ? (
    <UploadedImageNode key={props.data.item.data.path} {...props} />
  ) : (
    <LinkImageNode {...props} />
  );
}

function LinkImageNode({ id, data, selected }: CanvasNodeProps) {
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

/** An external image that quietly swaps to a fallback if it won't load. */
function RemoteImage({
  src,
  alt = '',
  className,
  fallback = null,
}: {
  src: string;
  alt?: string;
  className: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied hosts
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function LinkNode({ id, data, selected }: CanvasNodeProps) {
  const { canEdit, accountSlug } = useCanvasLookups();
  const { saveLink, linkBusy } = useCanvasActions();
  const { url, title, description, faviconUrl, imageUrl, linkId } =
    data.item.data;
  const host = safeHostname(url);
  const safeUrl = url && /^https?:\/\//i.test(url) ? url : undefined;
  const busy = linkBusy.get(id);
  const notesHref = `${pathsConfig.app.accountNotes.replace('[account]', accountSlug)}?view=links`;
  const globe = (
    <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
  );

  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col overflow-hidden',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={200} minHeight={110} />
      <ConnectHandles />
      {imageUrl ? (
        <RemoteImage
          key={imageUrl}
          src={imageUrl}
          alt={title || host || 'Link preview'}
          className="h-[45%] min-h-0 w-full shrink-0 border-b border-[color:var(--workspace-shell-border)] object-cover"
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
          {faviconUrl ? (
            <RemoteImage
              key={faviconUrl}
              src={faviconUrl}
              className="h-3.5 w-3.5 shrink-0 rounded-sm"
              fallback={globe}
            />
          ) : (
            globe
          )}
          <span className="truncate">{host || 'Link'}</span>
        </div>
        <p className="line-clamp-2 text-sm leading-snug font-semibold">
          {title || host || 'Link'}
        </p>
        {description ? (
          <p className="line-clamp-2 text-xs text-[var(--workspace-shell-text-muted)]">
            {description}
          </p>
        ) : busy === 'fetching' ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Fetching preview…
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-[color:var(--workspace-shell-border)] px-3 py-1.5 text-xs">
        {linkId ? (
          <Link
            href={notesHref}
            className="nodrag inline-flex items-center gap-1 font-medium text-[var(--workspace-shell-accent-text)] hover:underline"
            title="Saved to the project's links in Notes"
          >
            <Check className="h-3.5 w-3.5" />
            In notes
          </Link>
        ) : canEdit && safeUrl ? (
          <button
            type="button"
            data-test="canvas-link-save"
            disabled={busy === 'saving'}
            onClick={() => saveLink(id)}
            className="nodrag inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)] disabled:opacity-50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            {busy === 'saving' ? 'Saving…' : 'Save to notes'}
          </button>
        ) : null}
        <span className="flex-1" />
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

function formatTimelineDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function TimelineNode({ id, data, selected }: CanvasNodeProps) {
  const { phasesById, tasksById, canEdit, accountSlug, jobId } =
    useCanvasLookups();
  const { openTask, updateItemData } = useCanvasActions();
  const showTasks = data.item.data.showTasks ?? true;

  const layout = useMemo(
    () =>
      buildCanvasTimeline({
        phases: [...phasesById.values()].map((phase) => ({
          id: phase.id,
          name: phase.name,
          colour: phase.colour,
          startDate: phase.start_date,
          dueDate: phase.due_date,
          isMilestone: phase.is_milestone,
          progressPct: phase.progressPct,
        })),
        tasks: [...tasksById.values()]
          .filter((task) => !task.parent_task_id && task.status !== 'cancelled')
          .map((task) => ({
            id: task.id,
            title: task.title,
            phaseId: task.phase_id,
            dueDate: task.due_date,
            done: task.status === 'done',
          })),
        showTasks,
        today: new Date(),
      }),
    [phasesById, showTasks, tasksById],
  );

  const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

  return (
    <div
      className={cn(
        cardClass,
        'flex flex-col overflow-hidden',
        selected && 'ring-2 ring-[var(--ozer-accent)]',
      )}
    >
      <Resizer id={id} selected={selected} minWidth={480} minHeight={160} />
      <ConnectHandles />
      <div className="flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-2">
        <GanttChart className="h-4 w-4 text-[var(--workspace-shell-accent-text)]" />
        <p className="font-heading text-sm font-bold">Timeline</p>
        {layout ? (
          <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
            {formatTimelineDate(layout.start)} –{' '}
            {formatTimelineDate(layout.end)}
          </span>
        ) : null}
        <span className="flex-1" />
        {canEdit ? (
          <button
            type="button"
            className="nodrag rounded-md px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            onClick={() => updateItemData(id, { showTasks: !showTasks })}
          >
            {showTasks ? 'Hide tasks' : 'Show tasks'}
          </button>
        ) : null}
      </div>
      {!layout ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
          Add start and due dates to phases (or due dates to tasks) to see them
          here.
        </div>
      ) : (
        <div className="nowheel relative min-h-0 flex-1 overflow-y-auto">
          <div className="relative flex min-h-full">
            <div className="w-40 shrink-0 border-r border-[color:var(--workspace-shell-border)]">
              <div className="h-7" />
              {layout.rows.map((row) => (
                <div
                  key={row.id ?? 'none'}
                  className="flex h-8 items-center gap-1.5 px-3 text-xs"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        row.colour || 'var(--workspace-shell-text-muted)',
                    }}
                  />
                  {row.id ? (
                    <Link
                      href={projectPhaseHref(accountSlug, jobId, row.id)}
                      className="nodrag truncate hover:underline"
                      title={row.name}
                    >
                      {row.name}
                    </Link>
                  ) : (
                    <span className="truncate text-[var(--workspace-shell-text-muted)]">
                      {row.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="relative h-7 border-b border-[color:var(--workspace-shell-border)]">
                {layout.ticks.map((tick) => (
                  <span
                    key={tick.at}
                    className={cn(
                      'absolute top-1.5 -translate-x-1/2 text-[10px] whitespace-nowrap',
                      tick.major
                        ? 'font-semibold text-[var(--workspace-shell-text)]'
                        : 'text-[var(--workspace-shell-text-muted)]',
                    )}
                    style={{ left: pct(tick.at) }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
              {layout.ticks.map((tick) => (
                <span
                  key={`line-${tick.at}`}
                  className="pointer-events-none absolute top-7 bottom-0 w-px bg-[var(--workspace-shell-border)]"
                  style={{ left: pct(tick.at), opacity: tick.major ? 1 : 0.5 }}
                />
              ))}
              {layout.rows.map((row) => {
                const colour = row.colour || 'var(--ozer-accent)';
                return (
                  <div key={row.id ?? 'none'} className="relative h-8">
                    {row.from !== null && row.to !== null ? (
                      row.milestone ? (
                        <span
                          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
                          style={{ left: pct(row.from), background: colour }}
                          title={row.name}
                        />
                      ) : (
                        <span
                          className="absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-full"
                          style={{
                            left: pct(row.from),
                            width: pct(Math.max(row.to - row.from, 0.004)),
                            background: `color-mix(in srgb, ${colour} 30%, transparent)`,
                          }}
                          title={`${row.name} · ${row.progressPct}%`}
                        >
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${row.progressPct}%`,
                              background: colour,
                            }}
                          />
                        </span>
                      )
                    ) : null}
                    {row.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        className={cn(
                          'nodrag absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--ozer-surface-panel)] transition-transform hover:scale-150',
                          task.done
                            ? 'bg-emerald-500'
                            : task.overdue
                              ? 'bg-red-500'
                              : 'bg-[var(--workspace-shell-text-muted)]',
                        )}
                        style={{ left: pct(task.at) }}
                        title={task.title}
                        aria-label={`Open task ${task.title}`}
                        onClick={() => openTask(task.id)}
                      />
                    ))}
                  </div>
                );
              })}
              {layout.today !== null ? (
                <span
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[var(--ozer-accent)]"
                  style={{ left: pct(layout.today) }}
                  title="Today"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
      {layout && layout.undatedPhases.length > 0 ? (
        <p className="truncate border-t border-[color:var(--workspace-shell-border)] px-4 py-1.5 text-[11px] text-[var(--workspace-shell-text-muted)]">
          No dates yet: {layout.undatedPhases.join(', ')}
        </p>
      ) : null}
    </div>
  );
}

export const canvasNodeTypes = {
  phase: memo(PhaseNode),
  task: memo(TaskNode),
  member: memo(MemberNode),
  client: memo(ClientNode),
  note: memo(NoteNode),
  contact: memo(ContactNode),
  doc: memo(DocNode),
  sticky: memo(StickyNode),
  text: memo(TextNode),
  shape: memo(ShapeNode),
  frame: memo(FrameNode),
  image: memo(ImageNode),
  link: memo(LinkNode),
  draw: memo(DrawNode),
  timeline: memo(TimelineNode),
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
