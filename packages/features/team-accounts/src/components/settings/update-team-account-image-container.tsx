'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

async function uploadWorkspaceLogo(accountId: string, file: File) {
  const formData = new FormData();
  formData.append('accountId', accountId);
  formData.append('file', file);

  const response = await fetch('/api/brand/upload-logo', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    pictureUrl?: string;
    logoUrl?: string;
  } | null;

  const pictureUrl = payload?.pictureUrl ?? payload?.logoUrl;

  if (!response.ok || !pictureUrl) {
    throw new Error(payload?.error || 'Failed to upload workspace logo');
  }

  return pictureUrl;
}

async function clearWorkspaceLogo(accountId: string) {
  const response = await fetch('/api/brand/upload-logo', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to remove workspace logo');
  }
}

export function UpdateTeamAccountImage(props: {
  account: {
    id: string;
    name: string;
    pictureUrl: string | null;
  };
}) {
  const router = useRouter();
  const { t } = useTranslation('teams');

  const refreshAfterChange = useCallback(() => {
    router.refresh();
  }, [router]);

  const createToaster = useCallback(
    (promise: () => Promise<unknown>) => {
      return toast.promise(promise, {
        success: t(`updateTeamSuccessMessage`),
        error: t(`updateTeamErrorMessage`),
        loading: t(`updateTeamLoadingMessage`),
      });
    },
    [t],
  );

  const onValueChange = useCallback(
    (file: File | null) => {
      if (file) {
        const promise = () =>
          uploadWorkspaceLogo(props.account.id, file).then(() => {
            refreshAfterChange();
          });

        createToaster(promise);
        return;
      }

      const promise = () =>
        clearWorkspaceLogo(props.account.id).then(() => {
          refreshAfterChange();
        });

      createToaster(promise);
    },
    [createToaster, props.account.id, refreshAfterChange],
  );

  return (
    <ImageUploader
      value={props.account.pictureUrl}
      onValueChange={onValueChange}
    >
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
