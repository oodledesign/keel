'use client';

import { useCallback } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';

const AVATARS_BUCKET = 'account_image';

export function PersonImageUploader(props: {
  accountId: string;
  personId: string;
  avatarUrl: string | null;
  onUpdated: () => void;
}) {
  const client = useSupabase();

  const createToaster = useCallback(
    (promise: () => Promise<unknown>) => {
      return toast.promise(promise, {
        success: 'Photo updated',
        error: 'Failed to update photo',
        loading: 'Updating photo…',
      });
    },
    [],
  );

  const onValueChange = useCallback(
    (file: File | null) => {
      const removeExistingStorageFile = () => {
        if (props.avatarUrl) {
          return (
            deletePersonPhoto(client, props.avatarUrl) ?? Promise.resolve()
          );
        }

        return Promise.resolve();
      };

      if (file) {
        const promise = () =>
          removeExistingStorageFile().then(() =>
            uploadPersonPhoto(
              client,
              file,
              props.accountId,
              props.personId,
            ).then((avatarUrl) =>
              client
                .from('personal_people')
                .update({ avatar_url: avatarUrl })
                .eq('id', props.personId)
                .throwOnError(),
            ),
          ).then(() => {
            props.onUpdated();
          });

        createToaster(promise);
      } else {
        const promise = () =>
          removeExistingStorageFile()
            .then(() =>
              client
                .from('personal_people')
                .update({ avatar_url: null })
                .eq('id', props.personId)
                .throwOnError(),
            )
            .then(() => {
              props.onUpdated();
            });

        createToaster(promise);
      }
    },
    [client, createToaster, props],
  );

  return (
    <ImageUploader value={props.avatarUrl} onValueChange={onValueChange}>
      <span className="sr-only">Upload photo</span>
    </ImageUploader>
  );
}

function deletePersonPhoto(client: SupabaseClient, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  const path = url.includes('/account_image/')
    ? url.split('/account_image/')[1]?.split('?')[0]
    : url.split('/').pop()?.split('?')[0];

  if (!path) return;

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
    contentType: photoFile.type,
    upsert: true,
  });

  if (!result.error) {
    const url = bucket.getPublicUrl(fileName).data.publicUrl;
    return `${url}?v=${cacheBuster}`;
  }

  throw result.error;
}

function getPersonPhotoPath(accountId: string, personId: string) {
  return `${accountId}/person-${personId}`;
}
