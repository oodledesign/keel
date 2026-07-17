'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { previewContent } from '~/home/[account]/_lib/workspace-content/context-resolve';
import {
  createNoteFolderAction,
  deleteNoteFolderAction,
  duplicateNoteAction,
  moveNoteToFolderAction,
} from '~/home/[account]/_lib/workspace-content/note-folders-actions';
import type { NoteFolderListItem } from '~/home/[account]/_lib/workspace-content/note-folders.loader';
import {
  createBlankWorkspaceNoteAction,
  deleteWorkspaceNoteAction,
  saveWorkspaceNoteAction,
} from '~/home/[account]/_lib/workspace-content/notes-actions';
import type { NoteListItem } from '~/home/[account]/_lib/workspace-content/types';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

type SidebarSelection = 'all' | 'pinned' | `folder:${string}`;

type LayoutMode = 'list' | 'cards';

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

function noteDetailHref(
  accountSlug: string,
  noteId: string,
  personalScope: boolean,
) {
  if (personalScope) {
    return pathsConfig.app.personalNoteDetail.replace('[noteId]', noteId);
  }
  return pathsConfig.app.accountNoteDetail
    .replace('[account]', accountSlug)
    .replace('[noteId]', noteId);
}

export function NotesLibraryClient({
  accountId,
  accountSlug,
  notes: initialNotes,
  folders: initialFolders,
  tableAvailable,
  foldersAvailable,
  canEdit = true,
  personalScope = false,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  folders: NoteFolderListItem[];
  tableAvailable: boolean;
  foldersAvailable: boolean;
  canEdit?: boolean;
  personalScope?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState(initialNotes);
  const [folders, setFolders] = useState(initialFolders);
  const [selection, setSelection] = useState<SidebarSelection>('all');
  const [layout, setLayout] = useState<LayoutMode>('list');
  const [query, setQuery] = useState('');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const handledNewQuery = useRef(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    if (
      searchParams.get('new') !== '1' ||
      !canEdit ||
      handledNewQuery.current
    ) {
      return;
    }
    handledNewQuery.current = true;
    void createAndOpenNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once for ?new=1
  }, []);

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (!note.folderId) continue;
      counts.set(note.folderId, (counts.get(note.folderId) ?? 0) + 1);
    }
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (selection === 'pinned') return note.isPinned;
        if (selection.startsWith('folder:')) {
          return note.folderId === selection.slice('folder:'.length);
        }
        return true;
      })
      .filter((note) => {
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [notes, query, selection]);

  function openNote(noteId: string) {
    router.push(noteDetailHref(accountSlug, noteId, personalScope));
  }

  function createAndOpenNote() {
    if (!canEdit) return;
    const folderId = selection.startsWith('folder:')
      ? selection.slice('folder:'.length)
      : null;

    startTransition(async () => {
      try {
        const { noteId } = await createBlankWorkspaceNoteAction({
          accountId,
          accountSlug,
          folderId,
          personalScope,
        });
        router.push(noteDetailHref(accountSlug, noteId, personalScope));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create note',
        );
      }
    });
  }

  function createFolder() {
    const name = folderName.trim();
    if (!name || !canEdit) return;

    startTransition(async () => {
      try {
        const created = await createNoteFolderAction({
          accountId,
          accountSlug,
          name,
          personalScope,
        });
        setFolders((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setSelection(`folder:${created.id}`);
        setCreateFolderOpen(false);
        setFolderName('');
        toast.success('Folder created');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create folder',
        );
      }
    });
  }

  function moveNote(note: NoteListItem, folderId: string | null) {
    startTransition(async () => {
      try {
        await moveNoteToFolderAction({
          accountId,
          accountSlug,
          noteId: note.id,
          folderId,
          personalScope,
        });
        setNotes((current) =>
          current.map((item) =>
            item.id === note.id ? { ...item, folderId } : item,
          ),
        );
        toast.success(folderId ? 'Moved to folder' : 'Removed from folder');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not move note',
        );
      }
    });
  }

  function duplicateNote(note: NoteListItem) {
    startTransition(async () => {
      try {
        const { noteId } = await duplicateNoteAction({
          accountId,
          accountSlug,
          noteId: note.id,
          personalScope,
        });
        toast.success('Note duplicated');
        openNote(noteId);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not duplicate note',
        );
      }
    });
  }

  function togglePin(note: NoteListItem) {
    startTransition(async () => {
      try {
        await saveWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId: note.id,
          title: note.title,
          content: note.content,
          isPinned: !note.isPinned,
          category: note.category,
          tags: note.tags,
          folderId: note.folderId,
          personalScope,
        });
        setNotes((current) =>
          current.map((item) =>
            item.id === note.id ? { ...item, isPinned: !item.isPinned } : item,
          ),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update note',
        );
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const noteId = deleteTarget.id;
    startTransition(async () => {
      try {
        await deleteWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId,
          personalScope,
        });
        setNotes((current) => current.filter((item) => item.id !== noteId));
        setDeleteTarget(null);
        toast.success('Note deleted');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete note',
        );
      }
    });
  }

  function deleteFolder(folder: NoteFolderListItem) {
    if (
      !window.confirm(
        `Delete folder “${folder.name}”? Notes inside will move to All Notes.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteNoteFolderAction({
          accountId,
          accountSlug,
          folderId: folder.id,
          personalScope,
        });
        setFolders((current) =>
          current.filter((item) => item.id !== folder.id),
        );
        setNotes((current) =>
          current.map((note) =>
            note.folderId === folder.id ? { ...note, folderId: null } : note,
          ),
        );
        if (selection === `folder:${folder.id}`) setSelection('all');
        toast.success('Folder deleted');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete folder',
        );
      }
    });
  }

  if (!tableAvailable) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] p-10 text-center text-sm text-[var(--workspace-shell-text-muted)]">
        Notes are unavailable until the database migrations are applied.
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 lg:flex-row lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[color:var(--workspace-shell-border)] lg:bg-[var(--workspace-shell-panel)]">
      <aside className="w-full shrink-0 border-[color:var(--workspace-shell-border)] lg:w-56 lg:border-r xl:w-64">
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <p className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            Folders
          </p>
          {canEdit && foldersAvailable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCreateFolderOpen(true)}
              title="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <nav className="space-y-0.5 px-2 pb-3">
          <SidebarButton
            active={selection === 'all'}
            onClick={() => setSelection('all')}
            icon={<FolderOpen className="h-4 w-4" />}
            label="All Notes"
            count={notes.length}
          />
          <SidebarButton
            active={selection === 'pinned'}
            onClick={() => setSelection('pinned')}
            icon={<Pin className="h-4 w-4" />}
            label="Pinned"
            count={notes.filter((note) => note.isPinned).length}
          />

          {folders.length > 0 ? (
            <div className="pt-3">
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                Your folders
              </p>
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="group flex items-center gap-0.5"
                >
                  <SidebarButton
                    active={selection === `folder:${folder.id}`}
                    onClick={() => setSelection(`folder:${folder.id}`)}
                    icon={<Folder className="h-4 w-4" />}
                    label={folder.name}
                    count={folderCounts.get(folder.id) ?? 0}
                    className="flex-1"
                  />
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteFolder(folder)}
                      title="Delete folder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {!foldersAvailable ? (
            <p className="px-3 pt-3 text-xs text-[var(--workspace-shell-text-muted)]">
              Folders need a database migration.
            </p>
          ) : null}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-3 lg:px-4">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes…"
              className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] pl-8"
            />
          </div>

          <div className="flex items-center rounded-full border border-[color:var(--workspace-shell-border)] p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-full',
                layout === 'list' &&
                  'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
              )}
              onClick={() => setLayout('list')}
              title="List view"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-full',
                layout === 'cards' &&
                  'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
              )}
              onClick={() => setLayout('cards')}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className={`rounded-full ${workspaceBtnPrimaryMd}`}
              disabled={pending}
              onClick={createAndOpenNote}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New note
            </Button>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto p-3 lg:p-4">
          {filteredNotes.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
              <p className="font-medium text-[var(--workspace-shell-text)]">
                {query ? 'No matching notes' : 'No notes here yet'}
              </p>
              <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                {query
                  ? 'Try a different search.'
                  : 'Create a note to open the full editor with formatting.'}
              </p>
            </div>
          ) : layout === 'cards' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  folders={folders}
                  canEdit={canEdit}
                  pending={pending}
                  onOpen={() => openNote(note.id)}
                  onDuplicate={() => duplicateNote(note)}
                  onPin={() => togglePin(note)}
                  onMove={(folderId) => moveNote(note, folderId)}
                  onDelete={() => setDeleteTarget(note)}
                />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
              {filteredNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  folders={folders}
                  canEdit={canEdit}
                  pending={pending}
                  onOpen={() => openNote(note.id)}
                  onDuplicate={() => duplicateNote(note)}
                  onPin={() => togglePin(note)}
                  onMove={(folderId) => moveNote(note, folderId)}
                  onDelete={() => setDeleteTarget(note)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              createFolder();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="note-folder-name">Folder name</Label>
              <Input
                id="note-folder-name"
                value={folderName}
                autoFocus
                placeholder="e.g. Client meetings"
                onChange={(event) => setFolderName(event.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className={workspaceBtnPrimaryMd}
                disabled={pending || !folderName.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
          </DialogHeader>
          <p className={`text-sm ${workspaceTextMuted}`}>
            “{deleteTarget?.title || 'Untitled'}” will be permanently deleted.
            This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  label,
  count,
  className,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition',
        active
          ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function NoteActionsMenu({
  note,
  folders,
  canEdit,
  pending,
  onOpen,
  onDuplicate,
  onPin,
  onMove,
  onDelete,
}: {
  note: NoteListItem;
  folders: NoteFolderListItem[];
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={pending}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Note actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={onOpen}>Open note</DropdownMenuItem>
        {canEdit ? (
          <>
            <DropdownMenuItem onClick={onPin}>
              {note.isPinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            {folders.length > 0 ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to folder</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onMove(null)}>
                    All Notes (no folder)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => onMove(folder.id)}
                    >
                      {folder.name}
                      {note.folderId === folder.id ? ' ✓' : ''}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoteRow({
  note,
  folders,
  canEdit,
  pending,
  onOpen,
  onDuplicate,
  onPin,
  onMove,
  onDelete,
}: {
  note: NoteListItem;
  folders: NoteFolderListItem[];
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const preview = previewContent(note.content, 120);

  return (
    <li className="flex items-stretch gap-1 bg-[var(--workspace-shell-panel)] transition hover:bg-[var(--workspace-shell-sidebar-accent)]">
      <button
        type="button"
        className="min-w-0 flex-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <div className="flex items-center gap-2">
          {note.isPinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-accent)]" />
          ) : null}
          <span className="truncate font-medium text-[var(--workspace-shell-text)]">
            {note.title || 'Untitled'}
          </span>
        </div>
        <p className={`mt-0.5 line-clamp-1 text-sm ${workspaceTextMuted}`}>
          {preview || 'No content yet'}
        </p>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          {formatDate(note.updatedAt)}
        </p>
      </button>
      <div className="flex items-center pr-2">
        <NoteActionsMenu
          note={note}
          folders={folders}
          canEdit={canEdit}
          pending={pending}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onPin={onPin}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
}

function NoteCard({
  note,
  folders,
  canEdit,
  pending,
  onOpen,
  onDuplicate,
  onPin,
  onMove,
  onDelete,
}: {
  note: NoteListItem;
  folders: NoteFolderListItem[];
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onPin: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const preview = previewContent(note.content, 160);

  return (
    <div className="group relative flex min-h-40 flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 transition hover:border-[var(--ozer-accent)]/30">
      <div className="absolute top-2 right-2">
        <NoteActionsMenu
          note={note}
          folders={folders}
          canEdit={canEdit}
          pending={pending}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onPin={onPin}
          onMove={onMove}
          onDelete={onDelete}
        />
      </div>
      <button
        type="button"
        className="flex flex-1 flex-col text-left"
        onClick={onOpen}
      >
        <div className="flex items-center gap-2 pr-8">
          {note.isPinned ? (
            <Badge
              variant="outline"
              className="rounded-full border-emerald-600/30 bg-emerald-500/10 text-[10px] text-emerald-700"
            >
              Pinned
            </Badge>
          ) : null}
          <h3 className="truncate font-semibold text-[var(--workspace-shell-text)]">
            {note.title || 'Untitled'}
          </h3>
        </div>
        <p className={`mt-2 line-clamp-4 flex-1 text-sm ${workspaceTextMuted}`}>
          {preview || 'No content yet'}
        </p>
        <p className={`mt-3 text-xs ${workspaceTextMuted}`}>
          {formatDate(note.updatedAt)}
        </p>
      </button>
    </div>
  );
}
