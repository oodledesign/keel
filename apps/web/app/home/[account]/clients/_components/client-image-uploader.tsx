'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Camera, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

function normalizeClientPhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

export function ClientImageUploader({
  accountId,
  clientId,
  displayName,
  pictureUrl,
  onUpdated,
  size = 'lg',
  className,
}: {
  accountId: string;
  clientId: string;
  displayName: string;
  pictureUrl: string | null;
  onUpdated: () => void;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    normalizeClientPhotoUrl(pictureUrl),
  );

  useEffect(() => {
    setPreviewUrl(normalizeClientPhotoUrl(pictureUrl));
  }, [pictureUrl]);

  const dimension = size === 'lg' ? 'h-24 w-24 md:h-28 md:w-28' : 'h-20 w-20';

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);

      try {
        const nextUrl = await uploadClientPhotoViaApi(
          file,
          accountId,
          clientId,
        );
        setPreviewUrl(nextUrl);
        toast.success('Client photo updated');
        onUpdated();
      } catch (error) {
        console.error('[clients] photo upload', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to update photo',
        );
      } finally {
        setUploading(false);
      }
    },
    [accountId, clientId, onUpdated],
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

  const onRemovePhoto = useCallback(async () => {
    setUploading(true);

    try {
      await removeClientPhotoViaApi(accountId, clientId);
      setPreviewUrl(null);
      toast.success('Client photo removed');
      onUpdated();
    } catch (error) {
      console.error('[clients] photo remove', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove photo',
      );
    } finally {
      setUploading(false);
    }
  }, [accountId, clientId, onUpdated]);

  const openPicker = () => {
    inputRef.current?.click();
  };

  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <button
        type="button"
        disabled={uploading}
        onClick={openPicker}
        className={cn(
          'group relative shrink-0 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]',
          'bg-[var(--workspace-control-surface)] ring-2 ring-white/10 transition',
          'hover:border-[var(--ozer-accent)]/40 hover:ring-[var(--ozer-accent)]/30',
          'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
          dimension,
        )}
        aria-label={previewUrl ? 'Change client photo' : 'Add client photo'}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--workspace-shell-text)]">
            <span className="text-2xl font-semibold">
              {clientInitials(displayName)}
            </span>
            <Camera className="h-4 w-4 text-[var(--ozer-accent-muted)] opacity-90" />
          </span>
        )}

        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-[var(--workspace-shell-text)]',
            'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          {previewUrl ? 'Change' : 'Add photo'}
        </span>
      </button>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onFileSelected}
      />

      {previewUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={uploading}
          className="h-8 px-2 text-[var(--workspace-shell-text-muted)] hover:text-red-300"
          onClick={() => void onRemovePhoto()}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Remove photo
        </Button>
      ) : null}
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

async function uploadClientPhotoViaApi(
  file: File,
  accountId: string,
  clientId: string,
) {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('clientId', clientId);
  body.append('file', file);

  const response = await fetch('/api/clients/upload-photo', {
    method: 'POST',
    body,
  });

  const payload = await readUploadPhotoResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? 'Upload failed');
  }

  const nextUrl = normalizeClientPhotoUrl(payload.pictureUrl);
  if (!nextUrl) {
    throw new Error('Upload succeeded but no photo URL was returned');
  }

  return nextUrl;
}

async function removeClientPhotoViaApi(accountId: string, clientId: string) {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('clientId', clientId);
  body.append('remove', '1');

  const response = await fetch('/api/clients/upload-photo', {
    method: 'POST',
    body,
  });

  const payload = await readUploadPhotoResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? 'Remove failed');
  }
}
