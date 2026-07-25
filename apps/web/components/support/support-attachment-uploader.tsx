'use client';

import { useRef, useState } from 'react';

import { Loader2, Paperclip, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

export type SupportAttachmentItem = {
  name: string;
  url: string;
  mimeType: string;
  size: number;
};

type Props = {
  accountId?: string;
  supportToken?: string;
  /** Authenticated platform (Ozer product) support uploads. */
  platformSupport?: boolean;
  value: SupportAttachmentItem[];
  onChange: (attachments: SupportAttachmentItem[]) => void;
  max?: number;
};

export function SupportAttachmentUploader({
  accountId,
  supportToken,
  platformSupport = false,
  value,
  onChange,
  max = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const atMax = value.length >= max;

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || atMax) return;

    setUploading(true);
    try {
      const remaining = max - value.length;
      const batch = Array.from(files).slice(0, remaining);
      const uploaded: SupportAttachmentItem[] = [];

      for (const file of batch) {
        const body = new FormData();
        body.set('file', file);
        if (supportToken) {
          body.set('supportToken', supportToken);
        } else if (platformSupport) {
          body.set('platformSupport', '1');
        } else if (accountId) {
          body.set('accountId', accountId);
        } else {
          throw new Error('Missing upload context');
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

      onChange([...value, ...uploaded]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          disabled={uploading || atMax}
          onChange={(event) => void uploadFiles(event.target.files)}
        />
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
        <span className="text-xs text-[var(--workspace-shell-text)]/50">
          {value.length}/{max} · Images or PDF, max 10MB each
        </span>
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
