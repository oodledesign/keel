'use client';

import { useCallback } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';

const AVATARS_BUCKET = 'account_image';

export function ClientImageUploader(props: {
  accountId: string;
  clientId: string;
  pictureUrl: string | null;
  onUpdated: () => void;
}) {
  const client = useSupabase();

  const createToaster = useCallback(
    (promise: () => Promise<unknown>) => {
      return toast.promise(promise, {
        success: 'Client photo updated',
        error: 'Failed to update client photo',
        loading: 'Updating client photo…',
      });
    },
    [],
  );

  const onValueChange = useCallback(
    (file: File | null) => {
      const removeExistingStorageFile = () => {
        if (props.pictureUrl) {
          return (
            deleteProfilePhoto(client, props.pictureUrl) ?? Promise.resolve()
          );
        }

        return Promise.resolve();
      };

      if (file) {
        const promise = () =>
          removeExistingStorageFile().then(() =>
            uploadClientPhoto(client, file, props.accountId, props.clientId)
              .then((pictureUrl) =>
                client
                  .from('clients')
                  .update({ picture_url: pictureUrl })
                  .eq('id', props.clientId)
                  .throwOnError(),
              )
              .then(() => {
                props.onUpdated();
              }),
          );

        createToaster(promise);
      } else {
        const promise = () =>
          removeExistingStorageFile()
            .then(() =>
              client
                .from('clients')
                .update({ picture_url: null })
                .eq('id', props.clientId)
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
    <ImageUploader value={props.pictureUrl} onValueChange={onValueChange}>
      <span className="text-xs text-zinc-400">Change photo</span>
    </ImageUploader>
  );
}

function deleteProfilePhoto(client: SupabaseClient, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  // Full path for account-scoped client images (account_id/client-client_id), or filename for legacy
  const path = url.includes('/account_image/')
    ? url.split('/account_image/')[1]?.split('?')[0]
    : url.split('/').pop()?.split('?')[0];

  if (!path) return;

  return bucket.remove([path]);
}

async function uploadClientPhoto(
  client: SupabaseClient,
  photoFile: File,
  accountId: string,
  clientId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = getClientPhotoPath(accountId, clientId);
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

function getClientPhotoPath(accountId: string, clientId: string) {
  return `${accountId}/client-${clientId}`;
}

