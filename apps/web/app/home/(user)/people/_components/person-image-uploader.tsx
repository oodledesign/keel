'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Camera, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getInitials } from './person-avatar';
import { PersonPhotoCropDialog } from './person-photo-crop-dialog';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

type PersonImageUploaderProps = {
  personId: string;
  personName?: string;
  avatarUrl: string | null;
  onUpdated: () => void;
  size?: 'md' | 'lg';
  className?: string;
};

export function PersonImageUploader({
  personId,
  personName = '',
  avatarUrl,
  onUpdated,
  size = 'lg',
  className,
}: PersonImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    normalizePersonPhotoUrl(avatarUrl),
  );

  useEffect(() => {
    setPreviewUrl(normalizePersonPhotoUrl(avatarUrl));
  }, [avatarUrl]);

  const dimension = size === 'lg' ? 'h-24 w-24' : 'h-20 w-20';

  const uploadProcessedFile = useCallback(
    async (file: File) => {
      setUploading(true);

      try {
        const nextUrl = await uploadPersonPhotoViaApi(file, personId);
        setPreviewUrl(nextUrl);
        toast.success('Photo updated');
        onUpdated();
      } catch (error) {
        console.error('[people] photo upload', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to update photo',
        );
      } finally {
        setUploading(false);
      }
    },
    [onUpdated, personId],
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

      setCropFile(file);
      setCropOpen(true);
    },
    [],
  );

  const onRemovePhoto = useCallback(async () => {
    setUploading(true);

    try {
      await removePersonPhotoViaApi(personId);
      setPreviewUrl(null);
      toast.success('Photo removed');
      onUpdated();
    } catch (error) {
      console.error('[people] photo remove', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove photo',
      );
    } finally {
      setUploading(false);
    }
  }, [onUpdated, personId]);

  const openPicker = () => {
    inputRef.current?.click();
  };

  return (
    <>
      <div className={cn('flex flex-col items-start gap-2', className)}>
        <button
          type="button"
          disabled={uploading}
          onClick={openPicker}
          className={cn(
            'group relative overflow-hidden rounded-xl border border-white/10',
            'bg-[var(--keel-teal)]/10 ring-2 ring-white/10 transition',
            'hover:border-[var(--keel-teal)]/40 hover:ring-[var(--keel-teal)]/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--keel-teal)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
            dimension,
          )}
          aria-label={previewUrl ? 'Change photo' : 'Add photo'}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#5eead4]">
              <span className="text-lg font-semibold">
                {getInitials(personName || '?')}
              </span>
              <Camera className="h-4 w-4 opacity-80" />
            </span>
          )}

          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white',
              'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            {previewUrl ? 'Change' : 'Add photo'}
          </span>
        </button>

        <input
          ref={inputRef}
          id={inputId}
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
            className="h-8 px-2 text-xs text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => void onRemovePhoto()}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      <PersonPhotoCropDialog
        open={cropOpen}
        file={cropFile}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setCropFile(null);
        }}
        onConfirm={(file) => void uploadProcessedFile(file)}
      />
    </>
  );
}

async function uploadPersonPhotoViaApi(file: File, personId: string) {
  const formData = new FormData();
  formData.append('personId', personId);
  formData.append('file', file);

  const response = await fetch('/api/people/upload-photo', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    avatarUrl?: string | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to upload photo');
  }

  const nextUrl = normalizePersonPhotoUrl(payload.avatarUrl);
  if (!nextUrl) {
    throw new Error('Upload succeeded but photo URL was missing.');
  }

  return nextUrl;
}

async function removePersonPhotoViaApi(personId: string) {
  const formData = new FormData();
  formData.append('personId', personId);
  formData.append('remove', '1');

  const response = await fetch('/api/people/upload-photo', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to remove photo');
  }
}

function normalizePersonPhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}
