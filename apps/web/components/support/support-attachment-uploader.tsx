'use client';

import { type DragEvent, useCallback, useRef, useState } from 'react';

import { Loader2, Paperclip, Upload, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

export type SupportAttachmentItem = {
  name: string;
  url: string;
  mimeType: string;
  size: number;
};

type UploadContext =
  | { platformSupport: true }
  | { accountId: string }
  | { supportToken: string };

type Props = {
  accountId?: string;
  supportToken?: string;
  /** Authenticated platform (Ozer product) support uploads. */
  platformSupport?: boolean;
  value: SupportAttachmentItem[];
  onChange: (attachments: SupportAttachmentItem[]) => void;
  max?: number;
  /** Compact drop target for messenger composer. */
  compact?: boolean;
};

const ACCEPT = 'image/*,application/pdf';

function isAcceptedFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

export async function uploadSupportAttachmentFiles(input: {
  files: FileList | File[];
  context: UploadContext;
  existing: SupportAttachmentItem[];
  max?: number;
}): Promise<SupportAttachmentItem[]> {
  const max = input.max ?? 5;
  const remaining = max - input.existing.length;
  if (remaining <= 0) {
    throw new Error('Attachment limit reached');
  }

  const list = Array.from(input.files).filter(isAcceptedFile);
  if (list.length === 0) {
    throw new Error('Please attach images or PDFs only');
  }

  const batch = list.slice(0, remaining);
  const uploaded: SupportAttachmentItem[] = [];

  for (const file of batch) {
    const body = new FormData();
    body.set('file', file);
    if ('supportToken' in input.context) {
      body.set('supportToken', input.context.supportToken);
    } else if ('platformSupport' in input.context) {
      body.set('platformSupport', '1');
    } else {
      body.set('accountId', input.context.accountId);
    }

    const response = await fetch('/api/support/upload-attachment', {
      method: 'POST',
      body,
    });

    const json = (await response.json()) as {
      attachment?: SupportAttachmentItem;
      error?: string;
    };

    if (!response.ok || !json.attachment) {
      throw new Error(json.error ?? 'Upload failed');
    }

    uploaded.push(json.attachment);
  }

  return [...input.existing, ...uploaded];
}

export function SupportAttachmentUploader({
  accountId,
  supportToken,
  platformSupport = false,
  value,
  onChange,
  max = 5,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const atMax = value.length >= max;

  const context: UploadContext | null = supportToken
    ? { supportToken }
    : platformSupport
      ? { platformSupport: true }
      : accountId
        ? { accountId }
        : null;

  const uploadFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || atMax) return;
      if (!context) {
        toast.error('Missing upload context');
        return;
      }

      setUploading(true);
      try {
        const next = await uploadSupportAttachmentFiles({
          files,
          context,
          existing: value,
          max,
        });
        onChange(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    },
    [atMax, context, max, onChange, value],
  );

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (uploading || atMax) return;
    void uploadFiles(event.dataTransfer.files);
  }

  return (
    <div className="space-y-2">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!uploading && !atMax) setDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!uploading && !atMax) setDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border border-dashed transition-colors',
          dragOver
            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
            : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
          compact ? 'px-3 py-3' : 'px-3 py-4',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={uploading || atMax}
          onChange={(event) => void uploadFiles(event.target.files)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || atMax}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            Attach files
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--workspace-shell-text)]/50">
            <Upload className="h-3.5 w-3.5" />
            {dragOver
              ? 'Drop to upload'
              : `${value.length}/${max} · Images or PDF · drag & drop`}
          </span>
        </div>
      </div>

      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((file, index) => (
            <li
              key={`${file.url}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-sm"
            >
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
              >
                {file.name}
              </a>
              <button
                type="button"
                className="shrink-0 text-[var(--workspace-shell-text)]/40 hover:text-[var(--workspace-shell-text)]"
                onClick={() => removeAt(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
