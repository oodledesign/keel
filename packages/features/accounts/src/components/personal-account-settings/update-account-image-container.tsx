'use client';

import { useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { toSupabasePublicStorageUrl } from '../../lib/public-storage-url';

import { useRevalidatePersonalAccountDataQuery } from '../../hooks/use-personal-account-data';

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
      if (file) {
        if (!file.type.startsWith('image/')) {
          toast.error(t('updateProfileError'));
          return;
        }

        const promise = async () => {
          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch('/api/account/upload-profile-image', {
            method: 'POST',
            body: formData,
          });

          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error || t('updateProfileError'));
          }

          props.onAvatarUpdated();
        };

        createToaster(promise);
        return;
      }

      const promise = async () => {
        const formData = new FormData();
        formData.append('remove', '1');

        const response = await fetch('/api/account/upload-profile-image', {
          method: 'POST',
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || t('updateProfileError'));
        }

        props.onAvatarUpdated();
      };

      createToaster(promise);
    },
    [createToaster, props, t],
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
