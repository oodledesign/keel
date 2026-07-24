'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import {
  ChevronDown,
  Download,
  File,
  FileImage,
  FileText,
  Globe,
  ListFilter,
  Pin,
  Plus,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  workspaceBtnPrimaryMd,
  workspaceCardHover,
  workspaceFilterActive,
  workspaceSuccessBadgeBorder,
} from '~/lib/workspace-ui';

import {
  docContentPreview,
  previewContent,
} from '../../_lib/workspace-content/context-resolve';
import {
  deleteWorkspaceDocAction,
  getWorkspaceDocDownloadUrlAction,
  registerUploadedWorkspaceDocAction,
  updateWorkspaceDocMetadataAction,
} from '../../_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '../../_lib/workspace-content/docs-constants';
import { generateFinancialYearOptions } from '../../_lib/workspace-content/financial-year';
import {
  deleteWorkspaceNoteAction,
  saveWorkspaceNoteAction,
} from '../../_lib/workspace-content/notes-actions';
import type {
  CustomNoteCategory,
  DocListItem,
  DocTypeOption,
  LinkOption,
  NoteFileCategory,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import {
  DOC_TYPE_LABELS,
  DOC_TYPE_OPTIONS,
  getDocTypeLabel,
  isPreviewableMimeType,
} from '../../_lib/workspace-content/types';
import { CategoryBadge, CategorySelect } from './category-select';
import { LinkToSelect, type LinkValue } from './link-to-select';
import { PublicSharingSection } from './public-sharing-section';
import { TagsInput } from './tags-input';
import { WorkspaceFilePreview } from './workspace-file-preview';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

type ListFilter = 'all' | 'pinned' | 'notes' | 'files';

type UnifiedItem =
  | { kind: 'note'; data: NoteListItem }
  | { kind: 'file'; data: DocListItem };

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

function linkFromItem(item: NoteListItem | DocListItem): LinkValue {
  if (item.projectId) return { type: 'project', id: item.projectId };
  if (item.jobId) return { type: 'job', id: item.jobId };
  if (item.clientOrgId || item.clientId) {
    return { type: 'client', id: item.clientOrgId ?? item.clientId! };
  }
  if (item.propertyId) return { type: 'property', id: item.propertyId };
  if (item.taskId) return { type: 'task', id: item.taskId };
  return null;
}

function matchesListFilter(item: UnifiedItem, listFilter: ListFilter) {
  if (listFilter === 'notes' && item.kind !== 'note') return false;
  if (listFilter === 'files' && item.kind !== 'file') return false;
  if (listFilter === 'pinned' && !item.data.isPinned) return false;
  return true;
}

function isProjectLinked(item: NoteListItem | DocListItem) {
  if (item.projectId || item.jobId) return true;
  return item.context?.type === 'project' || item.context?.type === 'job';
}

export function WorkspaceNotesPage({
  accountId,
  accountSlug,
  notes: initialNotes,
  docs: initialDocs = [],
  tableAvailable,
  docsTableAvailable = true,
  variant,
  linkOptions = [],
  canEdit = true,
  defaultLink,
  hideFilters = false,
  customCategories = [],
  initialListFilter = 'all',
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  docs?: DocListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  variant: WorkspaceNotesVariant;
  linkOptions: LinkOption[];
  canEdit?: boolean;
  defaultLink?: LinkValue;
  hideFilters?: boolean;
  customCategories?: CustomNoteCategory[];
  initialListFilter?: ListFilter;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [docs, setDocs] = useState(initialDocs);
  const [listFilter, setListFilter] = useState<ListFilter>(initialListFilter);
  const [propertyFilterId, setPropertyFilterId] = useState('__all__');
  const [showProjectLinked, setShowProjectLinked] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteListItem | null>(null);
  const [editingFile, setEditingFile] = useState<DocListItem | null>(null);
  const [notePending, startNoteTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const openNewNote = () => {
    setEditingNote(null);
    setNoteSheetOpen(true);
  };

  const openEditNote = (note: NoteListItem) => {
    setEditingNote(note);
    setNoteSheetOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('upload') === '1') {
      setUploadOpen(true);
    }
    if (searchParams.get('new') === '1') {
      openNewNote();
    }
    const docId = searchParams.get('doc');
    if (docId) {
      const doc = docs.find((item) => item.id === docId);
      if (doc) {
        setEditingFile(doc);
      }
    }
  }, [searchParams, docs]);

  useEffect(() => setNotes(initialNotes), [initialNotes]);
  useEffect(() => setDocs(initialDocs), [initialDocs]);
  useEffect(() => setListFilter(initialListFilter), [initialListFilter]);

  const propertyOptions = useMemo(
    () => linkOptions.filter((option) => option.type === 'property'),
    [linkOptions],
  );

  const financialYearOptions = useMemo(
    () => generateFinancialYearOptions(),
    [],
  );

  const deleteNote = (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    startDeleteTransition(async () => {
      try {
        await deleteWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId,
        });
        toast.success('Note deleted');
        router.refresh();
      } catch {
        toast.error('Could not delete note');
      }
    });
  };

  const deleteFile = (docId: string) => {
    if (!confirm('Delete this file?')) return;
    startDeleteTransition(async () => {
      try {
        await deleteWorkspaceDocAction({
          accountId,
          accountSlug,
          docId,
        });
        toast.success('File deleted');
        setEditingFile((current) => (current?.id === docId ? null : current));
        router.refresh();
      } catch {
        toast.error('Could not delete file');
      }
    });
  };

  const unified = useMemo(() => {
    const items: UnifiedItem[] = [
      ...notes.map((n) => ({ kind: 'note' as const, data: n })),
      ...docs.map((d) => ({ kind: 'file' as const, data: d })),
    ];
    return items
      .filter((item) => matchesListFilter(item, listFilter))
      .filter(
        (item) =>
          hideFilters || showProjectLinked || !isProjectLinked(item.data),
      )
      .filter(
        (item) =>
          propertyFilterId === '__all__' ||
          item.data.propertyId === propertyFilterId,
      )
      .sort(
        (a, b) =>
          new Date(b.data.updatedAt).getTime() -
          new Date(a.data.updatedAt).getTime(),
      );
  }, [
    notes,
    docs,
    listFilter,
    hideFilters,
    showProjectLinked,
    propertyFilterId,
  ]);

  if (!tableAvailable && !docsTableAvailable) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Notes and files are not available yet. Apply the latest database
        migrations and refresh.
      </p>
    );
  }

  const filterBtn = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
      active
        ? workspaceFilterActive
        : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideFilters ? (
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: 'all' as const, label: 'All' },
                { key: 'pinned' as const, label: 'Pinned' },
                { key: 'notes' as const, label: 'Notes' },
                { key: 'files' as const, label: 'Files' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setListFilter(f.key)}
                className={filterBtn(listFilter === f.key)}
              >
                {f.label}
              </button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                    !showProjectLinked &&
                      'border-[var(--ozer-accent)]/30 text-[var(--ozer-accent-muted)]',
                  )}
                >
                  <ListFilter className="mr-1.5 h-4 w-4" />
                  Show
                  <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-52 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              >
                <DropdownMenuLabel className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Include in list
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--workspace-shell-sidebar-accent)]" />
                <DropdownMenuCheckboxItem
                  checked={showProjectLinked}
                  onCheckedChange={setShowProjectLinked}
                  className="text-[var(--workspace-shell-text)] focus:bg-[var(--workspace-shell-sidebar-accent)] focus:text-[var(--workspace-shell-text)]"
                >
                  Project notes
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {propertyOptions.length > 0 ? (
              <Select
                value={propertyFilterId}
                onValueChange={setPropertyFilterId}
              >
                <SelectTrigger className="h-8 w-[180px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectItem value="__all__">All properties</SelectItem>
                  {propertyOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : (
          <div />
        )}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" className={workspaceBtnPrimaryMd}>
                <Plus className="mr-1.5 h-4 w-4" />
                New
                <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            >
              <DropdownMenuItem onClick={openNewNote}>
                <Plus className="mr-2 h-4 w-4" />
                New note
              </DropdownMenuItem>
              {docsTableAvailable ? (
                <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload file
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {unified.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Nothing matches this filter.
        </p>
      ) : (
        <ul className="space-y-3">
          {unified.map((item) =>
            item.kind === 'note' ? (
              <li key={`note-${item.data.id}`}>
                <button
                  type="button"
                  onClick={() => openEditNote(item.data)}
                  className={cn(
                    panelClass,
                    'w-full p-4 text-left',
                    workspaceCardHover,
                  )}
                >
                  <NoteListRow
                    note={item.data}
                    showPin={variant === 'work' || variant === 'property'}
                    customCategories={customCategories}
                    canDelete={canEdit}
                    deletePending={deletePending}
                    onDelete={() => deleteNote(item.data.id)}
                  />
                </button>
              </li>
            ) : (
              <li key={`file-${item.data.id}`}>
                <FileListRow
                  doc={item.data}
                  accountId={accountId}
                  canDelete={canEdit}
                  deletePending={deletePending}
                  onDelete={() => deleteFile(item.data.id)}
                  onEdit={() => setEditingFile(item.data)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      <NoteFormSheet
        open={noteSheetOpen}
        onOpenChange={(open) => {
          setNoteSheetOpen(open);
          if (!open) {
            setEditingNote(null);
          }
        }}
        title={editingNote ? 'Edit note' : 'New note'}
        accountId={accountId}
        accountSlug={accountSlug}
        linkOptions={linkOptions}
        note={editingNote ?? undefined}
        defaultLink={defaultLink}
        pending={notePending}
        canDelete={canEdit}
        customCategories={customCategories}
        onSaved={() => {
          router.refresh();
        }}
        onDeleted={() => {
          setNoteSheetOpen(false);
          setEditingNote(null);
          router.refresh();
        }}
        startTransition={startNoteTransition}
      />

      <UploadFileSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        linkOptions={linkOptions}
        defaultLink={defaultLink}
        financialYearOptions={financialYearOptions}
        onUploaded={() => {
          setUploadOpen(false);
          router.refresh();
        }}
      />

      {editingFile ? (
        <FileDetailSheet
          open={Boolean(editingFile)}
          onOpenChange={(open) => !open && setEditingFile(null)}
          doc={editingFile}
          accountId={accountId}
          accountSlug={accountSlug}
          linkOptions={linkOptions}
          financialYearOptions={financialYearOptions}
          canEdit={canEdit}
          onSaved={() => {
            router.refresh();
          }}
          onDeleted={() => {
            setEditingFile(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function NoteListRow({
  note,
  showPin,
  customCategories = [],
  canDelete,
  deletePending,
  onDelete,
}: {
  note: NoteListItem;
  showPin: boolean;
  customCategories?: CustomNoteCategory[];
  canDelete?: boolean;
  deletePending?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showPin && note.isPinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : null}
          <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text-muted)]">
            Note
          </Badge>
          <CategoryBadge
            category={note.category}
            customCategories={customCategories}
          />
          {note.isPublic ? (
            <Globe
              className="h-3.5 w-3.5 text-[var(--ozer-accent-muted)]"
              aria-label="Public"
            />
          ) : null}
          <h3 className="truncate font-medium text-[var(--workspace-shell-text)]">
            {note.title}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">
          {previewContent(note.content, 100) || 'No content yet'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {note.context ? (
            <Badge
              variant="outline"
              className={cn('text-xs', workspaceSuccessBadgeBorder)}
            >
              {note.context.label}
            </Badge>
          ) : null}
          {note.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[10px] text-[var(--workspace-shell-text-muted)]"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={deletePending}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          {formatDate(note.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function FileListRow({
  doc,
  accountId,
  onEdit,
  canDelete,
  deletePending,
  onDelete,
}: {
  doc: DocListItem;
  accountId: string;
  onEdit: () => void;
  canDelete?: boolean;
  deletePending?: boolean;
  onDelete?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = mimeIcon(doc.mimeType);

  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  return (
    <div
      className={cn(
        panelClass,
        'flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4',
        workspaceCardHover,
      )}
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && onEdit()}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text-muted)]">
              File
            </Badge>
            {getDocTypeLabel(doc.docType) ? (
              <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text)]">
                {getDocTypeLabel(doc.docType)}
              </Badge>
            ) : null}
            <CategoryBadge category={doc.category} />
            {doc.isPublic ? (
              <Globe
                className="h-3.5 w-3.5 text-[var(--ozer-accent-muted)]"
                aria-label="Public"
              />
            ) : null}
            <span className="font-medium text-[var(--workspace-shell-text)]">
              {doc.title}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {doc.kind === 'uploaded'
              ? `${doc.mimeType ?? 'file'} · ${formatBytes(doc.fileSizeBytes)}`
              : docContentPreview(doc.content) || 'Written document'}
          </p>
          {doc.context ? (
            <Badge
              variant="outline"
              className="mt-2 border-[var(--ozer-accent)]/30 text-[10px] text-[var(--ozer-accent-muted)]"
            >
              {doc.context.label}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          {formatDate(doc.updatedAt)}
        </span>
        {canDelete ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={deletePending}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
        {doc.kind === 'uploaded' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)]"
            disabled={pending}
            onClick={download}
          >
            <Download className="mr-1 h-4 w-4" />
            Download
          </Button>
        ) : null}
      </div>
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
  customCategories = [],
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
  customCategories?: CustomNoteCategory[];
  onSaved: () => void;
  onDeleted?: () => void;
  startTransition: (fn: () => void) => void;
}) {
  const [noteTitle, setNoteTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [category, setCategory] = useState<NoteFileCategory>(
    note?.category ?? 'idea',
  );
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [link, setLink] = useState<LinkValue>(
    note ? linkFromItem(note) : (defaultLink ?? null),
  );
  const [savedNoteId, setSavedNoteId] = useState<string | undefined>(note?.id);

  useEffect(() => {
    if (open) {
      setNoteTitle(note?.title ?? '');
      setContent(note?.content ?? '');
      setIsPinned(note?.isPinned ?? false);
      setCategory(note?.category ?? 'idea');
      setTags(note?.tags ?? []);
      setLink(note ? linkFromItem(note) : (defaultLink ?? null));
      setSavedNoteId(note?.id);
    }
  }, [open, note, defaultLink]);

  const save = () => {
    startTransition(async () => {
      try {
        const result = await saveWorkspaceNoteAction({
          accountId,
          accountSlug,
          noteId: savedNoteId,
          title: noteTitle,
          content,
          isPinned,
          category,
          tags,
          link,
        });
        setSavedNoteId(result.noteId);
        toast.success(note || savedNoteId ? 'Note saved' : 'Note created');
        onOpenChange(false);
        onSaved();
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
      <SheetContent className="w-full overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-[var(--workspace-shell-text)]">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Title (optional)
            </Label>
            <Input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <CategorySelect
            value={category}
            onChange={setCategory}
            disabled={pending}
            customCategories={customCategories}
          />
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Content
            </Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              className="min-h-[200px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] font-mono text-sm text-[var(--workspace-shell-text)]"
            />
          </div>
          {linkOptions.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Link to
              </Label>
              <LinkToSelect
                options={linkOptions}
                value={link}
                onChange={setLink}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Tags
            </Label>
            <TagsInput tags={tags} onChange={setTags} disabled={pending} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-[color:var(--workspace-shell-border)]"
            />
            Pin note
          </label>
          {savedNoteId ? (
            <PublicSharingSection
              accountId={accountId}
              accountSlug={accountSlug}
              itemType="note"
              itemId={savedNoteId}
              isPublic={note?.isPublic ?? false}
              disabled={pending}
            />
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Save once to enable a public sharing link.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className={workspaceBtnPrimaryMd}
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

function UploadFileSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  linkOptions,
  defaultLink,
  financialYearOptions,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  defaultLink?: LinkValue;
  financialYearOptions: string[];
  onUploaded: () => void;
}) {
  const supabase = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocTypeOption>('general');
  const [financialYear, setFinancialYear] = useState<string>('__none__');
  const [category, setCategory] = useState<NoteFileCategory>('idea');
  const [tags, setTags] = useState<string[]>([]);
  const [link, setLink] = useState<LinkValue>(defaultLink ?? null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDocType('general');
      setFinancialYear('__none__');
      setCategory('idea');
      setTags([]);
      setLink(defaultLink ?? null);
      setFile(null);
    }
  }, [open, defaultLink]);

  const submit = () => {
    startTransition(async () => {
      try {
        if (!file) {
          toast.error('Choose a file to upload');
          return;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${accountId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(ACCOUNT_DOCS_BUCKET)
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        await registerUploadedWorkspaceDocAction({
          accountId,
          accountSlug,
          title: title || file.name,
          docType,
          financialYear: financialYear === '__none__' ? null : financialYear,
          category,
          tags,
          link,
          filePath,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
        });
        toast.success('File uploaded');
        onUploaded();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not upload file');
      }
    });
  };

  const localPreviewUrl = useMemo(() => {
    if (!file || !isPreviewableMimeType(file.type)) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const fields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">File</Label>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFile(f ?? null);
            if (f && !title.trim()) {
              setTitle(f.name.replace(/\.[^.]+$/, ''));
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full border-[color:var(--workspace-shell-border)]"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {file ? file.name : 'Choose file (images, PDFs, documents)'}
        </Button>
      </div>
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">
          Title
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Name shown in the documents list"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">
          Document type
        </Label>
        <Select
          value={docType}
          onValueChange={(value) => setDocType(value as DocTypeOption)}
        >
          <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            {DOC_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {DOC_TYPE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">
          Financial year
        </Label>
        <Select value={financialYear} onValueChange={setFinancialYear}>
          <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
            <SelectItem value="__none__">None</SelectItem>
            {financialYearOptions.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CategorySelect
        value={category}
        onChange={setCategory}
        disabled={pending}
        accountId={accountId}
        accountSlug={accountSlug}
      />
      {linkOptions.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-[var(--workspace-shell-text-muted)]">
            Link to
          </Label>
          <LinkToSelect options={linkOptions} value={link} onChange={setLink} />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label className="text-[var(--workspace-shell-text-muted)]">Tags</Label>
        <TagsInput tags={tags} onChange={setTags} disabled={pending} />
      </div>
    </div>
  );

  const preview = localPreviewUrl ? (
    <div className="flex h-full min-h-[14rem] flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
      <p className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-3 py-2 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
        Preview
      </p>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        {file?.type.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL
          <img
            src={localPreviewUrl}
            alt={title || file.name}
            className="max-h-[min(28rem,55dvh)] w-full rounded-lg object-contain"
          />
        ) : (
          <iframe
            title={`${title || file?.name || 'File'} preview`}
            src={`${localPreviewUrl}#view=FitH`}
            className="h-[min(32rem,60dvh)] w-full rounded-lg bg-[var(--workspace-shell-panel)]"
          />
        )}
      </div>
    </div>
  ) : (
    <div className="flex h-full min-h-[14rem] items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/50 px-6 text-center text-sm text-[var(--workspace-shell-text-muted)]">
      Choose an image or PDF to see a preview here
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-0 text-[var(--workspace-shell-text)] sm:w-full sm:max-w-5xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            Upload file
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-6 py-4 md:grid-cols-2 md:overflow-hidden">
          <div className="min-h-0 space-y-4 md:overflow-y-auto md:overscroll-contain md:pr-1">
            {fields}
          </div>
          <div className="min-h-0 md:overflow-y-auto md:overscroll-contain">
            {preview}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-[color:var(--workspace-shell-border)] px-6 py-4 sm:justify-start">
          <Button
            type="button"
            disabled={pending || !file}
            className={workspaceBtnPrimaryMd}
            onClick={submit}
          >
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileDetailSheet({
  open,
  onOpenChange,
  doc,
  accountId,
  accountSlug,
  linkOptions,
  financialYearOptions,
  canEdit = true,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocListItem;
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  financialYearOptions: string[];
  canEdit?: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(doc.title);
  const [docType, setDocType] = useState<DocTypeOption>(
    (doc.docType as DocTypeOption | null) ?? 'general',
  );
  const [financialYear, setFinancialYear] = useState(
    doc.financialYear ?? '__none__',
  );
  const [category, setCategory] = useState<NoteFileCategory>(doc.category);
  const [tags, setTags] = useState<string[]>(doc.tags);
  const [link, setLink] = useState<LinkValue>(linkFromItem(doc));

  useEffect(() => {
    if (open) {
      setTitle(doc.title);
      setDocType((doc.docType as DocTypeOption | null) ?? 'general');
      setFinancialYear(doc.financialYear ?? '__none__');
      setCategory(doc.category);
      setTags(doc.tags);
      setLink(linkFromItem(doc));
    }
  }, [open, doc]);

  const download = () => {
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
  };

  const save = () => {
    startTransition(async () => {
      try {
        await updateWorkspaceDocMetadataAction({
          accountId,
          accountSlug,
          docId: doc.id,
          title,
          docType,
          financialYear: financialYear === '__none__' ? null : financialYear,
          category,
          tags,
          link,
        });
        toast.success('File updated');
        onOpenChange(false);
        onSaved?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save file');
      }
    });
  };

  const remove = () => {
    if (!confirm('Delete this file?')) return;
    startTransition(async () => {
      try {
        await deleteWorkspaceDocAction({
          accountId,
          accountSlug,
          docId: doc.id,
        });
        toast.success('File deleted');
        onOpenChange(false);
        onDeleted?.();
      } catch {
        toast.error('Could not delete file');
      }
    });
  };

  const showPreview =
    doc.kind === 'uploaded' && isPreviewableMimeType(doc.mimeType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-0 text-[var(--workspace-shell-text)] sm:w-full sm:max-w-5xl',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-6 py-4 pr-12 text-left">
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            Edit file
          </DialogTitle>
        </DialogHeader>
        <div
          className={cn(
            'grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain px-6 py-4 md:overflow-hidden',
            showPreview ? 'md:grid-cols-2' : 'md:grid-cols-1',
          )}
        >
          <div className="min-h-0 space-y-4 md:overflow-y-auto md:overscroll-contain md:pr-1">
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEdit || pending}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Document type
              </Label>
              <Select
                value={docType}
                onValueChange={(value) => setDocType(value as DocTypeOption)}
                disabled={!canEdit || pending}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {DOC_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {DOC_TYPE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Financial year
              </Label>
              <Select
                value={financialYear}
                onValueChange={setFinancialYear}
                disabled={!canEdit || pending}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  <SelectItem value="__none__">None</SelectItem>
                  {financialYearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CategorySelect
              value={category}
              onChange={setCategory}
              disabled={!canEdit || pending}
              accountId={accountId}
              accountSlug={accountSlug}
            />
            {linkOptions.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Link to
                </Label>
                <LinkToSelect
                  options={linkOptions}
                  value={link}
                  onChange={setLink}
                  disabled={!canEdit || pending}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Tags
              </Label>
              <TagsInput
                tags={tags}
                onChange={setTags}
                disabled={!canEdit || pending}
              />
            </div>
            {doc.kind === 'uploaded' ? (
              <>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {doc.mimeType ?? 'file'} · {formatBytes(doc.fileSizeBytes)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[color:var(--workspace-shell-border)]"
                  disabled={pending}
                  onClick={download}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                {doc.content || 'No content'}
              </p>
            )}
            <PublicSharingSection
              accountId={accountId}
              accountSlug={accountSlug}
              itemType="file"
              itemId={doc.id}
              isPublic={doc.isPublic}
            />
          </div>
          {showPreview ? (
            <div className="min-h-0 md:overflow-y-auto md:overscroll-contain">
              <WorkspaceFilePreview
                accountId={accountId}
                docId={doc.id}
                mimeType={doc.mimeType}
                title={doc.title}
                panel
              />
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <DialogFooter className="shrink-0 gap-2 border-t border-[color:var(--workspace-shell-border)] px-6 py-4 sm:justify-start">
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className={workspaceBtnPrimaryMd}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={pending}
              className="border-red-500/30 text-red-300"
            >
              Delete
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
