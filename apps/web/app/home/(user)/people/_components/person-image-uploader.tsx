'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Camera, Trash2 } from 'lucide-react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getInitials } from './person-avatar';
import { PersonPhotoCropDialog } from './person-photo-crop-dialog';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

const AVATARS_BUCKET = 'account_image';

type PersonImageUploaderProps = {
  accountId: string;
  personId: string;
  personName?: string;
  avatarUrl: string | null;
  onUpdated: () => void;
  size?: 'md' | 'lg';
  className?: string;
};

export function PersonImageUploader({
  accountId,
  personId,
  personName = '',
  avatarUrl,
  onUpdated,
  size = 'lg',
  className,
}: PersonImageUploaderProps) {
  const client = useSupabase();
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
        if (avatarUrl) {
          await deletePersonPhoto(client, avatarUrl);
        }

        const nextUrl = await uploadPersonPhoto(
          client,
          file,
          accountId,
          personId,
        );

        await client
          .from('personal_people')
          .update({ avatar_url: nextUrl })
          .eq('id', personId)
          .throwOnError();

        setPreviewUrl(nextUrl);
        toast.success('Photo updated');
        onUpdated();
      } catch (error) {
        console.error('[people] photo upload', error);
        toast.error('Failed to update photo');
      } finally {
        setUploading(false);
      }
    },
    [accountId, avatarUrl, client, onUpdated, personId],
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
      if (avatarUrl) {
        await deletePersonPhoto(client, avatarUrl);
      }

      await client
        .from('personal_people')
        .update({ avatar_url: null })
        .eq('id', personId)
        .throwOnError();

      setPreviewUrl(null);
      toast.success('Photo removed');
      onUpdated();
    } catch (error) {
      console.error('[people] photo remove', error);
      toast.error('Failed to remove photo');
    } finally {
      setUploading(false);
    }
  }, [avatarUrl, client, onUpdated, personId]);

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

function deletePersonPhoto(client: SupabaseClient, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  const path = url.includes('/account_image/')
    ? url.split('/account_image/')[1]?.split('?')[0]
    : url.split('/').pop()?.split('?')[0];

  if (!path) return Promise.resolve();

  return bucket.remove([path]);
}

async function uploadPersonPhoto(
  client: SupabaseClient,
  photoFile: File,
  accountId: string,
  personId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = getPersonPhotoPath(accountId, personId);
  const { nanoid } = await import('nanoid');
  const cacheBuster = nanoid(16);

  const result = await bucket.upload(fileName, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (!result.error) {
    const publicUrl = toSupabasePublicStorageUrl(
      bucket.getPublicUrl(fileName).data.publicUrl,
    );

    if (!publicUrl) {
      throw new Error('Upload succeeded but public URL could not be generated.');
    }

    return `${publicUrl}?v=${cacheBuster}`;
  }

  throw result.error;
}

function getPersonPhotoPath(accountId: string, personId: string) {
  return `${accountId}/person-${personId}`;
}

function normalizePersonPhotoUrl(url: string | null | undefined) {
  return toSupabasePublicStorageUrl(url) ?? url?.trim() ?? null;
}
