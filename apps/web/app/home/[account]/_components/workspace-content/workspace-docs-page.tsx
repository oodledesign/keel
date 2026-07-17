'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  Download,
  File,
  FileImage,
  FileText,
  Plus,
  Upload,
} from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { docContentPreview } from '../../_lib/workspace-content/context-resolve';
import {
  getWorkspaceDocDownloadUrlAction,
  registerUploadedWorkspaceDocAction,
  saveWrittenWorkspaceDocAction,
} from '../../_lib/workspace-content/docs-actions';
import { ACCOUNT_DOCS_BUCKET } from '../../_lib/workspace-content/docs-constants';
import {
  DOC_TYPE_OPTIONS,
  type DocListItem,
  type DocTypeOption,
  type LinkOption,
  type WorkspaceDocsVariant,
} from '../../_lib/workspace-content/types';
import { LinkToSelect, type LinkValue } from './link-to-select';
import { TagsInput } from './tags-input';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

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

function docTypeLabel(t: string | null) {
  if (!t) return null;
  return t.replace(/_/g, ' ');
}

export function WorkspaceDocsPage({
  accountId,
  accountSlug,
  docs: initialDocs,
  tableAvailable,
  variant,
  linkOptions,
  defaultLink,
}: {
  accountId: string;
  accountSlug: string;
  docs: DocListItem[];
  tableAvailable: boolean;
  variant: WorkspaceDocsVariant;
  linkOptions: LinkOption[];
  defaultLink?: LinkValue;
}) {
  const [docs, setDocs] = useState(initialDocs);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);
  const [kindTab, setKindTab] = useState<'written' | 'uploaded'>('written');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () => docs.filter((d) => d.kind === kindTab),
    [docs, kindTab],
  );

  if (!tableAvailable) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Docs are not available yet. Apply the latest database migrations and
        refresh.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={kindTab}
          onValueChange={(v) => setKindTab(v as 'written' | 'uploaded')}
        >
          <TabsList className="border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]">
            <TabsTrigger value="written">Written</TabsTrigger>
            <TabsTrigger value="uploaded">Uploaded</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          type="button"
          size="sm"
          className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New doc
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No documents in this tab.
        </p>
      ) : kindTab === 'written' ? (
        <ul className="space-y-3">
          {filtered.map((doc) => (
            <li key={doc.id}>
              <DocWrittenRow doc={doc} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {filtered.map((doc) => (
            <li key={doc.id}>
              <DocUploadedRow doc={doc} accountId={accountId} />
            </li>
          ))}
        </ul>
      )}

      <NewDocSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        accountId={accountId}
        accountSlug={accountSlug}
        linkOptions={linkOptions}
        defaultLink={defaultLink}
        onCreated={(doc) => {
          setDocs((prev) => [doc, ...prev]);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function DocWrittenRow({ doc }: { doc: DocListItem }) {
  return (
    <div className={cn(panelClass, 'p-4')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {doc.docType ? (
              <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-xs text-[var(--workspace-shell-text)] capitalize">
                {docTypeLabel(doc.docType)}
              </Badge>
            ) : null}
            <span className="font-medium text-[var(--workspace-shell-text)]">
              {doc.title}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">
            {docContentPreview(doc.content) || 'No content yet'}
          </p>
          {doc.context ? (
            <Badge
              variant="outline"
              className="mt-2 border-[var(--ozer-accent)]/30 text-xs text-[var(--ozer-accent-muted)]"
            >
              {doc.context.label}
            </Badge>
          ) : null}
        </div>
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          {formatDate(doc.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function DocUploadedRow({
  doc,
  accountId,
}: {
  doc: DocListItem;
  accountId: string;
}) {
  const [pending, startTransition] = useTransition();
  const Icon = mimeIcon(doc.mimeType);

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
    <div
      className={cn(
        panelClass,
        'flex flex-wrap items-center justify-between gap-3 p-4',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {doc.docType ? (
              <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-xs text-[var(--workspace-shell-text)] capitalize">
                {docTypeLabel(doc.docType)}
              </Badge>
            ) : null}
            <span className="font-medium text-[var(--workspace-shell-text)]">
              {doc.title}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {doc.mimeType ?? 'file'} · {formatBytes(doc.fileSizeBytes)}
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
      </div>
    </div>
  );
}

function NewDocSheet({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  linkOptions,
  defaultLink,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  linkOptions: LinkOption[];
  defaultLink?: LinkValue;
  onCreated: (doc: DocListItem) => void;
}) {
  const supabase = useSupabase();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<'written' | 'uploaded'>('written');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState<DocTypeOption>('general');
  const [tags, setTags] = useState<string[]>([]);
  const [link, setLink] = useState<LinkValue>(defaultLink ?? null);
  const [file, setFile] = useState<File | null>(null);

  const submit = () => {
    startTransition(async () => {
      try {
        if (kind === 'written') {
          const result = await saveWrittenWorkspaceDocAction({
            accountId,
            accountSlug,
            title: title || 'Untitled document',
            content,
            docType,
            tags,
            link,
          });
          onCreated({
            id: result.docId,
            title: title || 'Untitled document',
            content,
            kind: 'written',
            docType,
            isPinned: false,
            tags,
            projectId: null,
            jobId: null,
            clientOrgId: null,
            clientId: null,
            propertyId: null,
            taskId: null,
            context: null,
            mimeType: null,
            fileUrl: null,
            filePath: null,
            fileSizeBytes: null,
            updatedAt: new Date().toISOString(),
          });
          toast.success('Document created');
          return;
        }

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

        const result = await registerUploadedWorkspaceDocAction({
          accountId,
          accountSlug,
          title: title || file.name,
          docType,
          tags,
          link,
          filePath,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
        });

        onCreated({
          id: result.docId,
          title: title || file.name,
          content: null,
          kind: 'uploaded',
          docType,
          isPinned: false,
          tags,
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
          updatedAt: new Date().toISOString(),
        });
        toast.success('File uploaded');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save document');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-[var(--workspace-shell-text)]">
            New document
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <TabsList className="border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]">
              <TabsTrigger value="written">Written</TabsTrigger>
              <TabsTrigger value="uploaded">Upload file</TabsTrigger>
            </TabsList>
          </Tabs>

          {kind === 'uploaded' ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                File
              </Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFile(f ?? null);
                  if (f && !title.trim())
                    setTitle(f.name.replace(/\.[^.]+$/, ''));
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full border-[color:var(--workspace-shell-border)]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : 'Choose file'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Content
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === 'uploaded' ? 'Auto-fills from filename' : ''
              }
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Document type
            </Label>
            <Select
              value={docType}
              onValueChange={(v) => setDocType(v as DocTypeOption)}
            >
              <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {docTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                disabled={Boolean(defaultLink)}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[var(--workspace-shell-text-muted)]">
              Tags
            </Label>
            <TagsInput tags={tags} onChange={setTags} disabled={pending} />
          </div>

          <Button
            type="button"
            disabled={pending}
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={submit}
          >
            {kind === 'uploaded' ? 'Upload' : 'Save'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
