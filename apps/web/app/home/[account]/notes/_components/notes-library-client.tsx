'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  Copy,
  Download,
  File,
  FileImage,
  FileText,
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
  Upload,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { WorkspaceFilePreview } from '~/home/[account]/_components/workspace-content/workspace-file-preview';
import { previewContent } from '~/home/[account]/_lib/workspace-content/context-resolve';
import {
  deleteWorkspaceDocAction,
  getWorkspaceDocDownloadUrlAction,
  registerUploadedWorkspaceDocAction,
} from '~/home/[account]/_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
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
import type {
  DocListItem,
  NoteListItem,
} from '~/home/[account]/_lib/workspace-content/types';
import {
  getDocTypeLabel,
  isPreviewableMimeType,
} from '~/home/[account]/_lib/workspace-content/types';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

type SidebarSelection = 'all' | 'pinned' | `folder:${string}`;

type LayoutMode = 'list' | 'cards';

type ContentMode = 'notes' | 'files';

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

function formatBytes(bytes: number | null) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string | null) {
  if (!mime) return File;
  if (mime.startsWith('image/')) return FileImage;
  return FileText;
}

export function NotesLibraryClient({
  accountId,
  accountSlug,
  notes: initialNotes,
  docs: initialDocs = [],
  folders: initialFolders,
  tableAvailable,
  docsTableAvailable = false,
  foldersAvailable,
  canEdit = true,
  personalScope = false,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  docs?: DocListItem[];
  folders: NoteFolderListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  foldersAvailable: boolean;
  canEdit?: boolean;
  personalScope?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [docs, setDocs] = useState(initialDocs);
  const [folders, setFolders] = useState(initialFolders);
  const [contentMode, setContentMode] = useState<ContentMode>('notes');
  const [selection, setSelection] = useState<SidebarSelection>('all');
  const [layout, setLayout] = useState<LayoutMode>('list');
  const [query, setQuery] = useState('');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteListItem | null>(null);
  const [activeFile, setActiveFile] = useState<DocListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const handledNewQuery = useRef(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  useEffect(() => {
    setFolders(initialFolders);
  }, [initialFolders]);

  useEffect(() => {
    if (contentMode === 'files' && selection.startsWith('folder:')) {
      setSelection('all');
    }
  }, [contentMode, selection]);

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

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((doc) => {
        if (selection === 'pinned') return doc.isPinned;
        return true;
      })
      .filter((doc) => {
        if (!q) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          (doc.mimeType?.toLowerCase().includes(q) ?? false) ||
          (getDocTypeLabel(doc.docType)?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [docs, query, selection]);

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

  function uploadFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !canEdit || !docsTableAvailable) return;

    startTransition(async () => {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${accountId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(ACCOUNT_DOCS_BUCKET)
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const result = await registerUploadedWorkspaceDocAction({
          accountId,
          accountSlug,
          title: file.name,
          docType: 'general',
          tags: [],
          link: null,
          filePath,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
        });

        const created: DocListItem = {
          id: result.docId,
          title: file.name,
          content: null,
          kind: 'uploaded',
          docType: 'general',
          category: 'idea',
          isPinned: false,
          tags: [],
          projectId: null,
          jobId: null,
          clientOrgId: null,
          clientId: null,
          propertyId: null,
          taskId: null,
          context: null,
          mimeType: file.type || null,
          fileUrl: null,
          filePath,
          fileSizeBytes: file.size,
          financialYear: null,
          storageBucket: ACCOUNT_DOCS_BUCKET,
          isPublic: false,
          publicToken: null,
          updatedAt: new Date().toISOString(),
        };
        setDocs((current) => [created, ...current]);
        setActiveFile(created);
        toast.success('File uploaded');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not upload file',
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  }

  function downloadFile(doc: DocListItem) {
    startTransition(async () => {
      try {
        const { url } = await getWorkspaceDocDownloadUrlAction({
          accountId,
          docId: doc.id,
        });
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        else toast.error('Download unavailable');
      } catch {
        toast.error('Could not download file');
      }
    });
  }

  function deleteFile(doc: DocListItem) {
    if (!window.confirm(`Delete “${doc.title}”? This cannot be undone.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteWorkspaceDocAction({
          accountId,
          accountSlug,
          docId: doc.id,
        });
        setDocs((current) => current.filter((item) => item.id !== doc.id));
        if (activeFile?.id === doc.id) setActiveFile(null);
        toast.success('File deleted');
      } catch {
        toast.error('Could not delete file');
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
            {contentMode === 'files' ? 'Library' : 'Folders'}
          </p>
          {canEdit && foldersAvailable && contentMode === 'notes' ? (
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
            icon={
              contentMode === 'files' ? (
                <File className="h-4 w-4" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )
            }
            label={contentMode === 'files' ? 'All Files' : 'All Notes'}
            count={contentMode === 'files' ? docs.length : notes.length}
          />
          <SidebarButton
            active={selection === 'pinned'}
            onClick={() => setSelection('pinned')}
            icon={<Pin className="h-4 w-4" />}
            label="Pinned"
            count={
              contentMode === 'files'
                ? docs.filter((doc) => doc.isPinned).length
                : notes.filter((note) => note.isPinned).length
            }
          />

          {contentMode === 'notes' && folders.length > 0 ? (
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

          {contentMode === 'notes' && !foldersAvailable ? (
            <p className="px-3 pt-3 text-xs text-[var(--workspace-shell-text-muted)]">
              Folders need a database migration.
            </p>
          ) : null}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-3 lg:px-4">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                contentMode === 'files' ? 'Search files…' : 'Search notes…'
              }
              className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] pl-8"
            />
          </div>

          {docsTableAvailable ? (
            <div className="flex items-center rounded-full border border-[color:var(--workspace-shell-border)] p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-medium',
                  contentMode === 'notes' &&
                    'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
                )}
                onClick={() => setContentMode('notes')}
              >
                Notes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-full px-3 text-xs font-medium',
                  contentMode === 'files' &&
                    'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
                )}
                onClick={() => setContentMode('files')}
              >
                Files
              </Button>
            </div>
          ) : null}

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
            contentMode === 'files' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => uploadFile(event.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  className={`rounded-full ${workspaceBtnPrimaryMd}`}
                  disabled={pending || !docsTableAvailable}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Upload
                </Button>
              </>
            ) : (
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
            )
          ) : null}
        </div>

        <div className="flex-1 overflow-auto p-3 lg:p-4">
          {contentMode === 'files' ? (
            !docsTableAvailable ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                <p className="font-medium text-[var(--workspace-shell-text)]">
                  Files unavailable
                </p>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  Apply the latest database migrations to enable files.
                </p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                <p className="font-medium text-[var(--workspace-shell-text)]">
                  {query ? 'No matching files' : 'No files here yet'}
                </p>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  {query
                    ? 'Try a different search.'
                    : 'Upload a PDF, image, or document to keep it with this workspace.'}
                </p>
              </div>
            ) : layout === 'cards' ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDocs.map((doc) => (
                  <FileCard
                    key={doc.id}
                    doc={doc}
                    canEdit={canEdit}
                    pending={pending}
                    onOpen={() => setActiveFile(doc)}
                    onDownload={() => downloadFile(doc)}
                    onDelete={() => deleteFile(doc)}
                  />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--workspace-shell-border)] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
                {filteredDocs.map((doc) => (
                  <FileRow
                    key={doc.id}
                    doc={doc}
                    canEdit={canEdit}
                    pending={pending}
                    onOpen={() => setActiveFile(doc)}
                    onDownload={() => downloadFile(doc)}
                    onDelete={() => deleteFile(doc)}
                  />
                ))}
              </ul>
            )
          ) : filteredNotes.length === 0 ? (
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

      <Sheet
        open={Boolean(activeFile)}
        onOpenChange={(open) => {
          if (!open) setActiveFile(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-[var(--workspace-shell-text)]">
              {activeFile?.title ?? 'File'}
            </SheetTitle>
          </SheetHeader>
          {activeFile ? (
            <div className="mt-6 space-y-4">
              {isPreviewableMimeType(activeFile.mimeType) ? (
                <WorkspaceFilePreview
                  accountId={accountId}
                  docId={activeFile.id}
                  mimeType={activeFile.mimeType}
                  title={activeFile.title}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {getDocTypeLabel(activeFile.docType) ? (
                  <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-xs text-[var(--workspace-shell-text)]">
                    {getDocTypeLabel(activeFile.docType)}
                  </Badge>
                ) : null}
                <span className={`text-sm ${workspaceTextMuted}`}>
                  {activeFile.mimeType ?? 'file'} ·{' '}
                  {formatBytes(activeFile.fileSizeBytes)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeFile.kind === 'uploaded' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[color:var(--workspace-shell-border)]"
                    disabled={pending}
                    onClick={() => downloadFile(activeFile)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-500/30 text-red-300"
                    disabled={pending}
                    onClick={() => deleteFile(activeFile)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FileRow({
  doc,
  canEdit,
  pending,
  onOpen,
  onDownload,
  onDelete,
}: {
  doc: DocListItem;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const Icon = mimeIcon(doc.mimeType);

  return (
    <li className="flex items-stretch gap-1 bg-[var(--workspace-shell-panel)] transition hover:bg-[var(--workspace-shell-sidebar-accent)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left"
        onClick={onOpen}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {getDocTypeLabel(doc.docType) ? (
              <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text)]">
                {getDocTypeLabel(doc.docType)}
              </Badge>
            ) : null}
            <span className="truncate font-medium text-[var(--workspace-shell-text)]">
              {doc.title || 'Untitled file'}
            </span>
          </div>
          <p className={`mt-0.5 truncate text-xs ${workspaceTextMuted}`}>
            {doc.mimeType ?? 'file'} · {formatBytes(doc.fileSizeBytes)} ·{' '}
            {formatDate(doc.updatedAt)}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-1 pr-2">
        {doc.kind === 'uploaded' ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={pending}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function FileCard({
  doc,
  canEdit,
  pending,
  onOpen,
  onDownload,
  onDelete,
}: {
  doc: DocListItem;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const Icon = mimeIcon(doc.mimeType);

  return (
    <div className="group relative rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 transition hover:border-[var(--ozer-accent)]/30">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
            <Icon className="h-4 w-4" />
          </span>
          {getDocTypeLabel(doc.docType) ? (
            <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text)]">
              {getDocTypeLabel(doc.docType)}
            </Badge>
          ) : null}
        </div>
        <p className="line-clamp-2 font-medium text-[var(--workspace-shell-text)]">
          {doc.title || 'Untitled file'}
        </p>
        <p className={`mt-2 text-xs ${workspaceTextMuted}`}>
          {formatBytes(doc.fileSizeBytes)} · {formatDate(doc.updatedAt)}
        </p>
      </button>
      <div className="mt-3 flex gap-1">
        {doc.kind === 'uploaded' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-[color:var(--workspace-shell-border)]"
            disabled={pending}
            onClick={onDownload}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            Download
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        ) : null}
      </div>
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
