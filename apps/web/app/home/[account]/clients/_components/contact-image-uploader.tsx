'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Camera } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

function normalizeContactPhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}

function contactInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function ContactImageUploader({
  accountId,
  contactId,
  displayName,
  pictureUrl,
  onUpdated,
  disabled = false,
  className,
}: {
  accountId: string;
  contactId: string;
  displayName: string;
  pictureUrl: string | null;
  onUpdated: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    normalizeContactPhotoUrl(pictureUrl),
  );

  useEffect(() => {
    setPreviewUrl(normalizeContactPhotoUrl(pictureUrl));
  }, [pictureUrl]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);

      try {
        const nextUrl = await uploadContactPhotoViaApi(
          file,
          accountId,
          contactId,
        );
        setPreviewUrl(nextUrl);
        toast.success('Contact photo updated');
        onUpdated();
      } catch (error) {
        console.error('[contacts] photo upload', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to update photo',
        );
      } finally {
        setUploading(false);
      }
    },
    [accountId, contactId, onUpdated],
  );

  const onFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file');
        return;
      }

      void uploadFile(file);
    },
    [uploadFile],
  );

  const openPicker = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  return (
    <div className={cn('shrink-0', className)}>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={openPicker}
        className={cn(
          'group relative h-9 w-9 overflow-hidden rounded-full border border-[color:var(--workspace-shell-border)]',
          'bg-[var(--workspace-control-surface)] ring-1 ring-white/10 transition',
          'hover:border-[var(--ozer-accent)]/40 hover:ring-[var(--ozer-accent)]/30',
          'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        aria-label={previewUrl ? 'Change contact photo' : 'Add contact photo'}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center text-[11px] font-semibold text-[var(--workspace-shell-text)]">
            {contactInitials(displayName)}
          </span>
        )}

        {!disabled ? (
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/45 text-[var(--workspace-shell-text)]',
              'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            <Camera className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileSelected}
      />
    </div>
  );
}

async function readUploadPhotoResponse(response: Response) {
  const raw = await response.text();

  if (!raw.trim()) {
    return {} as { pictureUrl?: string | null; error?: string };
  }

  try {
    return JSON.parse(raw) as {
      pictureUrl?: string | null;
      error?: string;
    };
  } catch {
    throw new Error(
      raw.startsWith('<')
        ? `Upload failed (${response.status}). The server returned an error page instead of JSON.`
        : raw.slice(0, 200) || `Upload failed (${response.status})`,
    );
  }
}

async function uploadContactPhotoViaApi(
  file: File,
  accountId: string,
  contactId: string,
) {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('contactId', contactId);
  body.append('file', file);

  const response = await fetch('/api/contacts/upload-photo', {
    method: 'POST',
    body,
  });

  const payload = await readUploadPhotoResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? 'Upload failed');
  }

  const nextUrl = normalizeContactPhotoUrl(payload.pictureUrl);
  if (!nextUrl) {
    throw new Error('Upload succeeded but no photo URL was returned');
  }

  return nextUrl;
}
