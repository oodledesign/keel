'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Camera, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

function normalizeProjectPhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}

function projectInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
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

async function uploadProjectPhotoViaApi(
  file: File,
  accountId: string,
  projectId: string,
) {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('projectId', projectId);
  body.append('file', file);

  const response = await fetch('/api/projects/upload-photo', {
    method: 'POST',
    body,
  });

  const payload = await readUploadPhotoResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? 'Upload failed');
  }

  const nextUrl = normalizeProjectPhotoUrl(payload.pictureUrl);
  if (!nextUrl) {
    throw new Error('Upload succeeded but no photo URL was returned');
  }

  return nextUrl;
}

async function removeProjectPhotoViaApi(accountId: string, projectId: string) {
  const body = new FormData();
  body.append('accountId', accountId);
  body.append('projectId', projectId);
  body.append('remove', '1');

  const response = await fetch('/api/projects/upload-photo', {
    method: 'POST',
    body,
  });

  const payload = await readUploadPhotoResponse(response);

  if (!response.ok) {
    throw new Error(payload.error ?? 'Remove failed');
  }
}

export function ProjectImageUploader({
  accountId,
  projectId,
  displayName,
  pictureUrl,
  canEdit,
  onUpdated,
  size = 'md',
  className,
}: {
  accountId: string;
  projectId: string;
  displayName: string;
  pictureUrl: string | null;
  canEdit: boolean;
  onUpdated?: (nextUrl: string | null) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    normalizeProjectPhotoUrl(pictureUrl),
  );

  useEffect(() => {
    setPreviewUrl(normalizeProjectPhotoUrl(pictureUrl));
  }, [pictureUrl]);

  const dimension = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12 md:h-14 md:w-14';

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);

      try {
        const nextUrl = await uploadProjectPhotoViaApi(
          file,
          accountId,
          projectId,
        );
        setPreviewUrl(nextUrl);
        toast.success('Project logo updated');
        onUpdated?.(nextUrl);
      } catch (error) {
        console.error('[projects] photo upload', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to update logo',
        );
      } finally {
        setUploading(false);
      }
    },
    [accountId, onUpdated, projectId],
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
      await removeProjectPhotoViaApi(accountId, projectId);
      setPreviewUrl(null);
      toast.success('Project logo removed');
      onUpdated?.(null);
    } catch (error) {
      console.error('[projects] photo remove', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove logo',
      );
    } finally {
      setUploading(false);
    }
  }, [accountId, onUpdated, projectId]);

  if (!canEdit) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
          dimension,
          className,
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo URL
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--workspace-shell-text)]">
            {projectInitials(displayName)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative shrink-0 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition hover:opacity-90 disabled:opacity-60',
          dimension,
        )}
        aria-label="Upload project logo"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo URL
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--workspace-shell-text)]">
            {projectInitials(displayName)}
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/45 py-0.5 text-[10px] text-white">
          <Camera className="size-3" aria-hidden />
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
          size="sm"
          variant="ghost"
          disabled={uploading}
          onClick={() => void onRemovePhoto()}
          className="h-8 px-2 text-xs text-[var(--workspace-shell-text-muted)]"
        >
          <Trash2 className="mr-1 size-3.5" aria-hidden />
          Remove
        </Button>
      ) : null}
    </div>
  );
}
