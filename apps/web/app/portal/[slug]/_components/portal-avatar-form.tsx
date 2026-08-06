'use client';

import { useCallback, useState } from 'react';

import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export function PortalAvatarForm({
  clientOrgId,
  initialPictureUrl,
  hasContactRecord,
}: {
  clientOrgId: string;
  initialPictureUrl: string | null;
  hasContactRecord: boolean;
}) {
  const [pictureUrl, setPictureUrl] = useState(
    toSupabasePublicStorageUrl(initialPictureUrl),
  );

  const onValueChange = useCallback(
    (file: File | null) => {
      const promise = async () => {
        const formData = new FormData();
        formData.append('clientOrgId', clientOrgId);

        if (file) {
          if (!file.type.startsWith('image/')) {
            throw new Error('Only image uploads are allowed.');
          }
          formData.append('file', file);
        } else {
          formData.append('remove', '1');
        }

        const response = await fetch('/api/portal/contacts/upload-photo', {
          method: 'POST',
          body: formData,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          pictureUrl?: string | null;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Could not update your photo.');
        }

        setPictureUrl(toSupabasePublicStorageUrl(payload.pictureUrl ?? null));
      };

      toast.promise(promise, {
        loading: 'Updating photo…',
        success: 'Photo updated',
        error: (err) =>
          err instanceof Error ? err.message : 'Could not update your photo.',
      });
    },
    [clientOrgId],
  );

  if (!hasContactRecord) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="text-sm text-[var(--ozer-text-on-light)]">
          Profile photo
        </span>
        <span className="text-xs text-[var(--ozer-text-on-light-muted)]">
          Ask your account manager to add you as a contact before you can set
          a photo.
        </span>
      </div>
    );
  }

  return (
    <ImageUploader value={pictureUrl} onValueChange={onValueChange}>
      <div className="flex flex-col space-y-1">
        <span className="text-sm text-[var(--ozer-text-on-light)]">
          Profile photo
        </span>
        <span className="text-xs text-[var(--ozer-text-on-light-muted)]">
          JPG, PNG, WEBP or GIF. Max 5MB.
        </span>
      </div>
    </ImageUploader>
  );
}
