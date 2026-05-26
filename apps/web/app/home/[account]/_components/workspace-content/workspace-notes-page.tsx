'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Pin, Plus } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { previewContent } from '../../_lib/workspace-content/context-resolve';
import {
  deleteWorkspaceNoteAction,
  saveWorkspaceNoteAction,
} from '../../_lib/workspace-content/notes-actions';
import type { LinkOption, NoteListItem, WorkspaceNotesVariant } from '../../_lib/workspace-content/types';
import { LinkToSelect, type LinkValue } from './link-to-select';
import { TagsInput } from './tags-input';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

type WorkFilter = 'all' | 'pinned' | 'project' | 'client';
type PropertyFilter = 'all' | 'pinned' | 'property';
type GroupFilter = 'all' | 'pinned';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function noteLinkFromItem(note: NoteListItem): LinkValue {
  if (note.projectId) return { type: 'project', id: note.projectId };
  if (note.jobId) return { type: 'job', id: note.jobId };
  if (note.clientOrgId || note.clientId) {
    return { type: 'client', id: note.clientOrgId ?? note.clientId! };
  }
  if (note.propertyId) return { type: 'property', id: note.propertyId };
  if (note.taskId) return { type: 'task', id: note.taskId };
  return null;
}

export function WorkspaceNotesPage({
  accountId,
  accountSlug,
  notes: initialNotes,
  tableAvailable,
  variant,
  linkOptions,
  canEdit = true,
  defaultLink,
  hideFilters = false,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  tableAvailable: boolean;
  variant: WorkspaceNotesVariant;
  linkOptions: LinkOption[];
  canEdit?: boolean;
  defaultLink?: LinkValue;
  hideFilters?: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);
  const [workFilter, setWorkFilter] = useState<WorkFilter>('all');
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilter>('all');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<NoteListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    if (variant === 'family' || variant === 'community') {
      if (groupFilter === 'pinned') return notes.filter((n) => n.isPinned);
      return notes;
    }
    if (variant === 'property') {
      if (propertyFilter === 'pinned') return notes.filter((n) => n.isPinned);
      if (propertyFilter === 'property') return notes.filter((n) => n.propertyId);
      return notes;
    }
    if (workFilter === 'pinned') return notes.filter((n) => n.isPinned);
    if (workFilter === 'project') {
      return notes.filter((n) => n.projectId || n.jobId);
    }
    if (workFilter === 'client') {
      return notes.filter((n) => n.clientOrgId || n.clientId);
    }
    return notes;
  }, [variant, workFilter, propertyFilter, groupFilter, notes]);

  if (!tableAvailable) {
    return (
      <p className="text-sm text-zinc-400">
        Notes are not available yet. Apply the latest database migrations and
        refresh.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideFilters ? (
        <FilterBar
          variant={variant}
          workFilter={workFilter}
          setWorkFilter={setWorkFilter}
          propertyFilter={propertyFilter}
          setPropertyFilter={setPropertyFilter}
          groupFilter={groupFilter}
          setGroupFilter={setGroupFilter}
        />
        ) : <div />}
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New note
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-400">No notes match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => setEditing(note)}
                className={cn(
                  panelClass,
                  'w-full p-4 text-left transition hover:border-[#2A9D8F]/30 hover:bg-white/[0.02]',
                )}
              >
                <NoteListRow note={note} showPin={variant === 'work' || variant === 'property'} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <NoteFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New note"
        accountId={accountId}
        accountSlug={accountSlug}
        linkOptions={linkOptions}
        defaultLink={defaultLink ?? null}
        pending={pending}
        onSaved={() => {
          setCreateOpen(false);
          router.refresh();
        }}
        startTransition={startTransition}
      />

      {editing ? (
        <NoteFormSheet
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          title="Edit note"
          accountId={accountId}
          accountSlug={accountSlug}
          linkOptions={linkOptions}
          note={editing}
          pending={pending}
          canDelete={canEdit}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
          onDeleted={() => {
            setEditing(null);
            router.refresh();
          }}
          startTransition={startTransition}
        />
      ) : null}
    </div>
  );
}

function NoteListRow({
  note,
  showPin,
}: {
  note: NoteListItem;
  showPin: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showPin && note.isPinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : null}
          <h3 className="truncate font-medium text-white">{note.title}</h3>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
          {previewContent(note.content, 100) || 'No content yet'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {note.context ? (
            <Badge
              variant="outline"
              className="border-[#2A9D8F]/30 text-xs text-[#5eead4]"
            >
              {note.context.label}
            </Badge>
          ) : null}
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-white/10 text-[10px] text-zinc-400"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <span className="shrink-0 text-xs text-zinc-500">
        {formatDate(note.updatedAt)}
      </span>
    </div>
  );
}

function FilterBar({
  variant,
  workFilter,
  setWorkFilter,
  propertyFilter,
  setPropertyFilter,
  groupFilter,
  setGroupFilter,
}: {
  variant: WorkspaceNotesVariant;
  workFilter: WorkFilter;
  setWorkFilter: (v: WorkFilter) => void;
  propertyFilter: PropertyFilter;
  setPropertyFilter: (v: PropertyFilter) => void;
  groupFilter: GroupFilter;
  setGroupFilter: (v: GroupFilter) => void;
}) {
  const btn = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-[#2A9D8F]/20 text-[#5eead4]'
        : 'text-zinc-400 hover:bg-white/5 hover:text-white',
    );

  if (variant === 'family' || variant === 'community') {
    return (
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'pinned' as const, label: 'Pinned' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setGroupFilter(f.key)}
            className={btn(groupFilter === f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'property') {
    return (
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'pinned' as const, label: 'Pinned' },
            { key: 'property' as const, label: 'By Property' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setPropertyFilter(f.key)}
            className={btn(propertyFilter === f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { key: 'all' as const, label: 'All' },
          { key: 'pinned' as const, label: 'Pinned' },
          { key: 'project' as const, label: 'By Project' },
          { key: 'client' as const, label: 'By Client' },
        ] as const
      ).map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => setWorkFilter(f.key)}
          className={btn(workFilter === f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function NoteFormSheet({
  open,
  onOpenChange,
  title,
  accountId,
  accountSlug,
  linkOptions,
  note,
  defaultLink,
  pending,
  canDelete,
  onSaved,
  onDeleted,
  startTransition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  note?: NoteListItem;
  defaultLink?: LinkValue;
  pending: boolean;
  canDelete?: boolean;
  onSaved: () => void;
  onDeleted?: () => void;
  startTransition: (fn: () => void) => void;
}) {
  const [noteTitle, setNoteTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [link, setLink] = useState<LinkValue>(
    note ? noteLinkFromItem(note) : defaultLink ?? null,
  );

  const save = () => {
    startTransition(async () => {
      try {
        await saveWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId: note?.id,
          title: noteTitle,
          content,
          isPinned,
          tags,
          link,
        });
        onSaved();
        toast.success(note ? 'Note saved' : 'Note created');
      } catch {
        toast.error('Could not save note');
      }
    });
  };

  const remove = () => {
    if (!note || !canDelete) return;
    startTransition(async () => {
      try {
        await deleteWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId: note.id,
        });
        onDeleted?.();
        toast.success('Note deleted');
      } catch {
        toast.error('Could not delete note');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Title (optional)</Label>
            <Input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="min-h-[200px] border-white/10 bg-[var(--workspace-shell-panel)] font-mono text-sm text-white"
            />
          </div>
          {linkOptions.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-zinc-300">Link to</Label>
              <LinkToSelect
                options={linkOptions}
                value={link}
                onChange={setLink}
                disabled={Boolean(defaultLink)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label className="text-zinc-300">Tags</Label>
            <TagsInput tags={tags} onChange={setTags} disabled={pending} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-white/20"
            />
            Pin note
          </label>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
            >
              Save
            </Button>
            {note && canDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={remove}
                disabled={pending}
                className="border-red-500/30 text-red-300"
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
