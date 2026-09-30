'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ViewportPortal, useViewport } from '@xyflow/react';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  ArrowLeft,
  Check,
  Crosshair,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type CanvasCommentThread,
  activeMentionIds,
  mentionQueryAt,
} from '~/lib/projects/canvas/canvas-comments';
import {
  type CanvasItem,
  canvasItemSize,
} from '~/lib/projects/canvas/canvas-types';

import { getErrorMessage } from '../../../_lib/error-message';
import type { ProjectCanvasComment } from '../../../_lib/schema/project-canvas.schema';
import {
  addCanvasComment,
  deleteCanvasComment,
  resolveCanvasComment,
  updateCanvasComment,
} from '../../../_lib/server/project-canvas-comments.actions';
import type { CanvasPerson } from './canvas-context';

export type CanvasThread = CanvasCommentThread<ProjectCanvasComment>;

const MAX_SUGGESTIONS = 6;

function personName(person: CanvasPerson | undefined) {
  return person?.name || person?.email || 'Someone';
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/** Count bubbles pinned to the top-right corner of commented items. */
export function CanvasCommentPins({
  threads,
  itemsById,
  activeItemId,
  onOpen,
}: {
  threads: CanvasThread[];
  itemsById: Map<string, CanvasItem>;
  activeItemId: string | null;
  onOpen: (itemId: string) => void;
}) {
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      {threads.map((thread) => {
        const item = itemsById.get(thread.itemId);
        if (!item || (thread.resolved && thread.itemId !== activeItemId)) {
          return null;
        }
        const { w } = canvasItemSize(item);
        const active = thread.itemId === activeItemId;
        return (
          <button
            key={thread.itemId}
            type="button"
            onClick={() => onOpen(thread.itemId)}
            title={`${thread.comments.length} comment${thread.comments.length === 1 ? '' : 's'}`}
            className={cn(
              'nodrag nopan pointer-events-auto absolute top-0 left-0 z-[1500] flex h-7 min-w-7 items-center justify-center gap-1 rounded-full rounded-bl-sm border px-2 text-[11px] font-semibold shadow-md transition-colors',
              active
                ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] hover:border-[var(--ozer-accent)]',
            )}
            style={{
              transform: `translate(${item.x + w - 6}px, ${item.y - 6}px) scale(${1 / zoom}) translate(0, -100%)`,
              transformOrigin: '0 0',
            }}
          >
            <MessageSquare className="h-3 w-3" />
            {thread.comments.length}
          </button>
        );
      })}
    </ViewportPortal>
  );
}

type PanelProps = {
  accountId: string;
  accountSlug: string;
  jobId: string;
  threads: CanvasThread[];
  itemLabel: (itemId: string) => string | null;
  activeItemId: string | null;
  onActiveItemChange: (itemId: string | null) => void;
  onFocusItem: (itemId: string) => void;
  /** The single selected card, offered as a quick way to start a thread. */
  selection: { id: string; label: string } | null;
  people: Map<string, CanvasPerson>;
  mentionable: CanvasPerson[];
  currentUserId: string | null;
  canModerate: boolean;
  onUpsert: (comment: ProjectCanvasComment) => void;
  onRemove: (commentId: string) => void;
  onClose: () => void;
};

export function CanvasCommentsPanel(props: PanelProps) {
  const { threads, activeItemId, onClose } = props;
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const active = activeItemId
    ? (threads.find((thread) => thread.itemId === activeItemId) ?? null)
    : null;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
      <div className="flex h-11 items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-3">
        {activeItemId ? (
          <button
            type="button"
            onClick={() => props.onActiveItemChange(null)}
            className="rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            aria-label="All comments"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <MessageSquare className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
        )}
        <span className="flex-1 truncate text-sm font-semibold">
          {activeItemId
            ? (props.itemLabel(activeItemId) ?? 'Removed item')
            : 'Comments'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
          aria-label="Close comments"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {activeItemId ? (
        <ThreadView
          key={activeItemId}
          {...props}
          itemId={activeItemId}
          thread={active}
        />
      ) : (
        <ThreadList {...props} filter={filter} onFilterChange={setFilter} />
      )}
    </aside>
  );
}

function ThreadList({
  threads,
  itemLabel,
  selection,
  people,
  onActiveItemChange,
  onFocusItem,
  filter,
  onFilterChange,
}: PanelProps & {
  filter: 'open' | 'resolved';
  onFilterChange: (filter: 'open' | 'resolved') => void;
}) {
  const shown = threads.filter((thread) =>
    filter === 'open' ? !thread.resolved : thread.resolved,
  );
  const openCount = threads.filter((thread) => !thread.resolved).length;

  return (
    <>
      {selection ? (
        <button
          type="button"
          onClick={() => onActiveItemChange(selection.id)}
          className="flex items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2 text-left text-sm text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Comment on &ldquo;{selection.label}&rdquo;
          </span>
        </button>
      ) : null}
      <div className="flex gap-1 border-b border-[color:var(--workspace-shell-border)] p-2">
        {(['open', 'resolved'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize',
              filter === value
                ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
          >
            {value}
            {value === 'open' && openCount > 0 ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            {filter === 'open'
              ? 'No open comments. Select a card and choose Comment to start a thread.'
              : 'No resolved threads yet.'}
          </p>
        ) : (
          shown.map((thread) => {
            const last = thread.comments[thread.comments.length - 1]!;
            const label = itemLabel(thread.itemId);
            return (
              <button
                key={thread.itemId}
                type="button"
                onClick={() => {
                  onActiveItemChange(thread.itemId);
                  if (label !== null) onFocusItem(thread.itemId);
                }}
                className="block w-full border-b border-[color:var(--workspace-shell-border)] px-3 py-2.5 text-left hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <div className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <span className="min-w-0 flex-1 truncate font-medium text-[var(--workspace-shell-text)]">
                    {label ?? 'Removed item'}
                  </span>
                  <span className="shrink-0">
                    {relativeTime(last.createdAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm">
                  <span className="font-medium">
                    {personName(people.get(last.authorId))}:
                  </span>{' '}
                  {last.body}
                </p>
                {thread.comments.length > 1 ? (
                  <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                    {thread.comments.length} comments
                  </p>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function ThreadView({
  accountId,
  accountSlug,
  jobId,
  itemId,
  thread,
  itemLabel,
  onFocusItem,
  people,
  mentionable,
  currentUserId,
  canModerate,
  onUpsert,
  onRemove,
}: PanelProps & { itemId: string; thread: CanvasThread | null }) {
  const [busy, setBusy] = useState(false);
  const exists = itemLabel(itemId) !== null;
  const canResolve =
    thread !== null && (canModerate || thread.root.authorId === currentUserId);

  const toggleResolved = async () => {
    if (!thread) return;
    setBusy(true);
    try {
      const updated = await resolveCanvasComment({
        accountId,
        jobId,
        commentId: thread.root.id,
        resolved: !thread.resolved,
      });
      onUpsert(updated);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 border-b border-[color:var(--workspace-shell-border)] px-2 py-1.5">
        {exists ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onFocusItem(itemId)}
          >
            <Crosshair className="mr-1 h-3.5 w-3.5" />
            Show on canvas
          </Button>
        ) : (
          <span className="px-2 text-xs text-[var(--workspace-shell-text-muted)]">
            This item is no longer on the canvas
          </span>
        )}
        <span className="flex-1" />
        {canResolve ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={busy}
            onClick={() => void toggleResolved()}
          >
            {thread.resolved ? (
              <>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reopen
              </>
            ) : (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                Resolve
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {thread?.resolved ? (
          <p className="rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-xs text-[var(--workspace-shell-text-muted)]">
            This thread is resolved.
          </p>
        ) : null}
        {thread ? (
          thread.comments.map((comment) => (
            <CommentRow
              key={comment.id}
              accountId={accountId}
              jobId={jobId}
              comment={comment}
              people={people}
              canEdit={comment.authorId === currentUserId}
              canDelete={canModerate || comment.authorId === currentUserId}
              onUpsert={onUpsert}
              onRemove={onRemove}
            />
          ))
        ) : (
          <p className="py-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            Start the conversation — type @ to mention a teammate.
          </p>
        )}
      </div>

      {exists || thread ? (
        <CommentComposer
          mentionable={mentionable}
          placeholder={
            thread ? 'Reply… (@ to mention)' : 'Add a comment… (@ to mention)'
          }
          onSubmit={async (body, mentions) => {
            const comment = await addCanvasComment({
              accountId,
              accountSlug,
              jobId,
              itemId,
              body,
              mentions,
            });
            onUpsert(comment);
          }}
        />
      ) : null}
    </>
  );
}

function renderBody(body: string, names: string[]): ReactNode {
  if (names.length === 0) return body;
  const escaped = names
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = body.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-medium text-[var(--ozer-accent)]">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function CommentRow({
  accountId,
  jobId,
  comment,
  people,
  canEdit,
  canDelete,
  onUpsert,
  onRemove,
}: {
  accountId: string;
  jobId: string;
  comment: ProjectCanvasComment;
  people: Map<string, CanvasPerson>;
  canEdit: boolean;
  canDelete: boolean;
  onUpsert: (comment: ProjectCanvasComment) => void;
  onRemove: (commentId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const author = people.get(comment.authorId);
  const mentionNames = comment.mentions
    .map((id) => people.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  const save = async () => {
    const body = draft.trim();
    if (!body || body === comment.body) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      onUpsert(
        await updateCanvasComment({
          accountId,
          jobId,
          commentId: comment.id,
          body,
        }),
      );
      setEditing(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteCanvasComment({ accountId, jobId, commentId: comment.id });
      onRemove(comment.id);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBusy(false);
    }
  };

  return (
    <div className="group flex gap-2">
      <ProfileAvatar
        displayName={personName(author)}
        pictureUrl={author?.pictureUrl ?? null}
        className="h-7 w-7 shrink-0 text-[10px]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold">
            {personName(author)}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--workspace-shell-text-muted)]">
            {relativeTime(comment.createdAt)}
          </span>
          <span className="flex-1" />
          {!editing && (canEdit || canDelete) ? (
            <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                  className="rounded p-1 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  aria-label="Edit comment"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="rounded p-1 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-1 space-y-1.5">
            <textarea
              value={draft}
              autoFocus
              rows={3}
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false);
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void save();
                }
              }}
              className="w-full resize-none rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-2 py-1.5 text-sm outline-none focus:border-[var(--ozer-accent)]"
            />
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={busy || !draft.trim()}
                onClick={() => void save()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
            {renderBody(comment.body, mentionNames)}
          </p>
        )}
      </div>
    </div>
  );
}

function CommentComposer({
  mentionable,
  placeholder,
  onSubmit,
}: {
  mentionable: CanvasPerson[];
  placeholder: string;
  onSubmit: (body: string, mentions: string[]) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Array<{ id: string; name: string }>>([]);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.query.toLowerCase();
    return mentionable
      .filter((person) => person.name || person.email)
      .filter((person) =>
        `${person.name ?? ''} ${person.email ?? ''}`.toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [mentionable, query]);

  const updateQuery = (value: string, caret: number) => {
    setQuery(mentionQueryAt(value, caret));
    setHighlight(0);
  };

  const pick = (person: CanvasPerson) => {
    if (!query) return;
    const name = person.name || person.email || '';
    const caret = ref.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, query.start)}@${name} ${text.slice(caret)}`;
    setText(next);
    setPicked((prev) =>
      prev.some((p) => p.id === person.id)
        ? prev
        : [...prev, { id: person.id, name }],
    );
    setQuery(null);
    const position = query.start + name.length + 2;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  };

  const submit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onSubmit(body, activeMentionIds(body, picked));
      setText('');
      setPicked([]);
      setQuery(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight(
          (current) =>
            (current + delta + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pick(suggestions[highlight] ?? suggestions[0]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="relative border-t border-[color:var(--workspace-shell-border)] p-3">
      {suggestions.length > 0 ? (
        <div
          role="listbox"
          aria-label="Mention a teammate"
          className="absolute inset-x-3 bottom-full mb-1 overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] shadow-lg"
        >
          {suggestions.map((person, index) => (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(person);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm',
                index === highlight &&
                  'bg-[var(--workspace-shell-sidebar-accent)]',
              )}
            >
              <ProfileAvatar
                displayName={personName(person)}
                pictureUrl={person.pictureUrl}
                className="h-5 w-5 text-[9px]"
              />
              <span className="min-w-0 flex-1 truncate">
                {personName(person)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={text}
        rows={2}
        maxLength={4000}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          updateQuery(event.target.value, event.target.selectionStart);
        }}
        onSelect={(event) =>
          updateQuery(
            event.currentTarget.value,
            event.currentTarget.selectionStart,
          )
        }
        onBlur={() => setQuery(null)}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-2.5 py-2 text-sm outline-none placeholder:text-[var(--workspace-shell-text-muted)] focus:border-[var(--ozer-accent)]"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
          Enter to send · Shift+Enter for a new line
        </span>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          disabled={sending || !text.trim()}
          onClick={() => void submit()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
