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
  Pin,
  Plus,
  Upload,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
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

import pathsConfig from '~/config/paths.config';

import { ACCOUNT_DOCS_BUCKET } from '../../_lib/workspace-content/docs-constants';
import {
  getWorkspaceDocDownloadUrlAction,
  registerUploadedWorkspaceDocAction,
} from '../../_lib/workspace-content/docs-actions';
import { docContentPreview, previewContent } from '../../_lib/workspace-content/context-resolve';
import {
  deleteWorkspaceNoteAction,
  saveWorkspaceNoteAction,
} from '../../_lib/workspace-content/notes-actions';
import type {
  CustomNoteCategory,
  DocListItem,
  LinkOption,
  NoteFileCategory,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import { CategoryBadge, CategorySelect } from './category-select';
import { LinkToSelect, type LinkValue } from './link-to-select';
import { PublicSharingSection } from './public-sharing-section';
import { TagsInput } from './tags-input';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)]';

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

function matchesListFilter(
  item: UnifiedItem,
  listFilter: ListFilter,
) {
  if (listFilter === 'notes' && item.kind !== 'note') return false;
  if (listFilter === 'files' && item.kind !== 'file') return false;
  if (listFilter === 'pinned' && !item.data.isPinned) return false;
  return true;
}

export function WorkspaceNotesPage({
  accountId,
  accountSlug,
  notes: initialNotes,
  docs: initialDocs = [],
  tableAvailable,
  docsTableAvailable = true,
  variant,
  linkOptions,
  canEdit = true,
  defaultLink,
  hideFilters = false,
  newNoteHref,
  customCategories = [],
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
  newNoteHref?: string;
  customCategories?: CustomNoteCategory[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [docs, setDocs] = useState(initialDocs);
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<DocListItem | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('upload') === '1') {
      setUploadOpen(true);
    }
  }, [searchParams]);

  useEffect(() => setNotes(initialNotes), [initialNotes]);
  useEffect(() => setDocs(initialDocs), [initialDocs]);

  const unified = useMemo(() => {
    const items: UnifiedItem[] = [
      ...notes.map((n) => ({ kind: 'note' as const, data: n })),
      ...docs.map((d) => ({ kind: 'file' as const, data: d })),
    ];
    return items
      .filter((item) => matchesListFilter(item, listFilter))
      .sort(
        (a, b) =>
          new Date(b.data.updatedAt).getTime() -
          new Date(a.data.updatedAt).getTime(),
      );
  }, [notes, docs, listFilter]);

  if (!tableAvailable && !docsTableAvailable) {
    return (
      <p className="text-sm text-zinc-400">
        Notes and files are not available yet. Apply the latest database
        migrations and refresh.
      </p>
    );
  }

  const filterBtn = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-[#2A9D8F]/20 text-[#5eead4]'
        : 'text-zinc-400 hover:bg-white/5 hover:text-white',
    );

  const noteDetailPath = (noteId: string) =>
    newNoteHref
      ? pathsConfig.app.personalNoteDetail.replace('[noteId]', noteId)
      : pathsConfig.app.accountNoteDetail
          .replace('[account]', accountSlug)
          .replace('[noteId]', noteId);

  const createNoteHref =
    newNoteHref ??
    pathsConfig.app.accountNoteNew.replace('[account]', accountSlug);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideFilters ? (
          <div className="flex flex-wrap gap-2">
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
          </div>
        ) : (
          <div />
        )}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New
                <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            >
              <DropdownMenuItem onClick={() => router.push(createNoteHref)}>
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
        <p className="text-sm text-zinc-400">Nothing matches this filter.</p>
      ) : (
        <ul className="space-y-3">
          {unified.map((item) =>
            item.kind === 'note' ? (
              <li key={`note-${item.data.id}`}>
                <button
                  type="button"
                  onClick={() => router.push(noteDetailPath(item.data.id))}
                  className={cn(
                    panelClass,
                    'w-full p-4 text-left transition hover:border-[#2A9D8F]/30 hover:bg-white/[0.02]',
                  )}
                >
                  <NoteListRow
                    note={item.data}
                    showPin={variant === 'work' || variant === 'property'}
                    customCategories={customCategories}
                  />
                </button>
              </li>
            ) : (
              <li key={`file-${item.data.id}`}>
                <FileListRow
                  doc={item.data}
                  accountId={accountId}
                  onEdit={() => setEditingFile(item.data)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      <UploadFileSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        linkOptions={linkOptions}
        defaultLink={defaultLink}
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
        />
      ) : null}
    </div>
  );
}

function NoteListRow({
  note,
  showPin,
  customCategories = [],
}: {
  note: NoteListItem;
  showPin: boolean;
  customCategories?: CustomNoteCategory[];
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {showPin && note.isPinned ? (
            <Pin className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : null}
          <Badge className="bg-white/5 text-[10px] text-zinc-400">Note</Badge>
          <CategoryBadge category={note.category} customCategories={customCategories} />
          {note.isPublic ? (
            <Globe className="h-3.5 w-3.5 text-[#5eead4]" aria-label="Public" />
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

function FileListRow({
  doc,
  accountId,
  onEdit,
}: {
  doc: DocListItem;
  accountId: string;
  onEdit: () => void;
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
        'flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 transition hover:border-[#2A9D8F]/30 hover:bg-white/[0.02]',
      )}
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && onEdit()}
      role="button"
      tabIndex={0}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-white/5 text-[10px] text-zinc-400">File</Badge>
            <CategoryBadge category={doc.category} />
            {doc.isPublic ? (
              <Globe className="h-3.5 w-3.5 text-[#5eead4]" aria-label="Public" />
            ) : null}
            <span className="font-medium text-white">{doc.title}</span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {doc.kind === 'uploaded'
              ? `${doc.mimeType ?? 'file'} · ${formatBytes(doc.fileSizeBytes)}`
              : docContentPreview(doc.content) || 'Written document'}
          </p>
          {doc.context ? (
            <Badge
              variant="outline"
              className="mt-2 border-[#2A9D8F]/30 text-[10px] text-[#5eead4]"
            >
              {doc.context.label}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{formatDate(doc.updatedAt)}</span>
        {doc.kind === 'uploaded' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10"
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
  const router = useRouter();
  const [noteTitle, setNoteTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [category, setCategory] = useState<NoteFileCategory>(
    note?.category ?? 'idea',
  );
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [link, setLink] = useState<LinkValue>(
    note ? linkFromItem(note) : defaultLink ?? null,
  );
  const [savedNoteId, setSavedNoteId] = useState<string | undefined>(note?.id);

  useEffect(() => {
    if (open) {
      setNoteTitle(note?.title ?? '');
      setContent(note?.content ?? '');
      setIsPinned(note?.isPinned ?? false);
      setCategory(note?.category ?? 'idea');
      setTags(note?.tags ?? []);
      setLink(note ? linkFromItem(note) : defaultLink ?? null);
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
        if (!note && !savedNoteId) {
          onOpenChange(false);
          router.push(
            pathsConfig.app.accountNoteDetail
              .replace('[account]', accountSlug)
              .replace('[noteId]', result.noteId),
          );
          return;
        }
        onSaved();
        toast.success(note || savedNoteId ? 'Note saved' : 'Note created');
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
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
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
          <CategorySelect
            value={category}
            onChange={setCategory}
            disabled={pending}
          />
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
            <p className="text-xs text-zinc-500">
              Save once to enable a public sharing link.
            </p>
          )}
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

function UploadFileSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  linkOptions,
  defaultLink,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  defaultLink?: LinkValue;
  onUploaded: () => void;
}) {
  const supabase = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<NoteFileCategory>('idea');
  const [tags, setTags] = useState<string[]>([]);
  const [link, setLink] = useState<LinkValue>(defaultLink ?? null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">Upload file</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">File</Label>
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
              className="w-full border-white/10"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {file ? file.name : 'Choose file (images, PDFs, documents)'}
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-white/10 bg-[var(--workspace-shell-panel)] text-white"
            />
          </div>
          <CategorySelect
            value={category}
            onChange={setCategory}
            disabled={pending}
          />
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
          <Button
            type="button"
            disabled={pending}
            className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
            onClick={submit}
          >
            Upload
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FileDetailSheet({
  open,
  onOpenChange,
  doc,
  accountId,
  accountSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocListItem;
  accountId: string;
  accountSlug: string;
}) {
  const [pending, startTransition] = useTransition();

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-[var(--workspace-shell-canvas)] text-white sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-white">{doc.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <CategoryBadge category={doc.category} />
            {doc.context ? (
              <Badge
                variant="outline"
                className="border-[#2A9D8F]/30 text-xs text-[#5eead4]"
              >
                {doc.context.label}
              </Badge>
            ) : null}
          </div>
          {doc.kind === 'uploaded' ? (
            <>
              <p className="text-sm text-zinc-400">
                {doc.mimeType ?? 'file'} · {formatBytes(doc.fileSizeBytes)}
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                disabled={pending}
                onClick={download}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-zinc-300">
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
      </SheetContent>
    </Sheet>
  );
}
