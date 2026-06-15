'use client';

import { useCallback } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { useTranslation } from 'react-i18next';

import { Database } from '@kit/supabase/database';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { useRevalidatePersonalAccountDataQuery } from '../../hooks/use-personal-account-data';

const AVATARS_BUCKET = 'account_image';

function toSupabasePublicStorageUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

function isAccountImageStorageUrl(url: string) {
  return url.includes('/account_image/');
}

export function UpdateAccountImageContainer({
  user,
}: {
  user: {
    pictureUrl: string | null;
    id: string;
  };
}) {
  const revalidateUserDataQuery = useRevalidatePersonalAccountDataQuery();

  return (
    <UploadProfileAvatarForm
      pictureUrl={toSupabasePublicStorageUrl(user.pictureUrl ?? null)}
      userId={user.id}
      onAvatarUpdated={() => revalidateUserDataQuery(user.id)}
    />
  );
}

function UploadProfileAvatarForm(props: {
  pictureUrl: string | null;
  userId: string;
  onAvatarUpdated: () => void;
}) {
  const client = useSupabase();
  const { t } = useTranslation('account');

  const createToaster = useCallback(
    (promise: () => Promise<unknown>) => {
      return toast.promise(promise, {
        success: t(`updateProfileSuccess`),
        error: t(`updateProfileError`),
        loading: t(`updateProfileLoading`),
      });
    },
    [t],
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
        if (!file.type.startsWith('image/')) {
          toast.error(t('updateProfileError'));
          return;
        }

        const promise = () =>
          removeExistingStorageFile().then(() =>
            uploadUserProfilePhoto(client, file, props.userId)
              .then((pictureUrl) => {
                return client
                  .from('accounts')
                  .update({
                    picture_url: pictureUrl,
                  })
                  .eq('id', props.userId)
                  .throwOnError();
              })
              .then(() => {
                props.onAvatarUpdated();
              }),
          );

        createToaster(promise);
      } else {
        const promise = () =>
          removeExistingStorageFile()
            .then(() => {
              return client
                .from('accounts')
                .update({
                  picture_url: null,
                })
                .eq('id', props.userId)
                .throwOnError();
            })
            .then(() => {
              props.onAvatarUpdated();
            });

        createToaster(promise);
      }
    },
    [client, createToaster, props],
  );

  return (
    <ImageUploader value={props.pictureUrl} onValueChange={onValueChange}>
      <div className={'flex flex-col space-y-1'}>
        <span className={'text-sm'}>
          <Trans i18nKey={'account:profilePictureHeading'} />
        </span>

        <span className={'text-xs'}>
          <Trans i18nKey={'account:profilePictureSubheading'} />
        </span>
      </div>
    </ImageUploader>
  );
}

function deleteProfilePhoto(client: SupabaseClient<Database>, url: string) {
  if (!isAccountImageStorageUrl(url)) {
    return;
  }

  const bucket = client.storage.from(AVATARS_BUCKET);
  const path = url.split('/account_image/')[1]?.split('?')[0];

  if (!path) {
    return;
  }

  return bucket.remove([path]);
}

async function uploadUserProfilePhoto(
  client: SupabaseClient<Database>,
  photoFile: File,
  userId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = getAvatarFileName(userId);
  const { nanoid } = await import('nanoid');
  const cacheBuster = nanoid(16);

  const result = await bucket.upload(fileName, bytes, {
    contentType: photoFile.type,
    upsert: true,
  });

  if (!result.error) {
    const url = toSupabasePublicStorageUrl(
      bucket.getPublicUrl(fileName).data.publicUrl,
    );

    if (!url) {
      throw new Error('Failed to build public image URL');
    }

    return `${url}?v=${cacheBuster}`;
  }

  throw result.error;
}

function getAvatarFileName(userId: string) {
  return userId;
}
