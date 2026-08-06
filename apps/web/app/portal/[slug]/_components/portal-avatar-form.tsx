'use client';

import { useCallback, useState } from 'react';

import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';

import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export function PortalAvatarForm({
  initialPictureUrl,
}: {
  initialPictureUrl: string | null;
}) {
  const [pictureUrl, setPictureUrl] = useState(
    toSupabasePublicStorageUrl(initialPictureUrl),
  );

  const onValueChange = useCallback((file: File | null) => {
    const promise = async () => {
      const formData = new FormData();

      if (file) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Only image uploads are allowed.');
        }
        formData.append('file', file);
      } else {
        formData.append('remove', '1');
      }

      const response = await fetch('/api/account/upload-profile-image', {
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
  }, []);

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
