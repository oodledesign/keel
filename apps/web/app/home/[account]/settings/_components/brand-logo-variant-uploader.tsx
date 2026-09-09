'use client';

import { useCallback } from 'react';

import { useRouter } from 'next/navigation';

import { ImageUploader } from '@kit/ui/image-uploader';
import { toast } from '@kit/ui/sonner';

import type { BrandLogoVariant } from '~/lib/brand/resolve-brand-logo';

async function uploadBrandLogoVariant(
  accountId: string,
  variant: BrandLogoVariant,
  file: File,
) {
  const formData = new FormData();
  formData.append('accountId', accountId);
  formData.append('variant', variant);
  formData.append('file', file);

  const response = await fetch('/api/brand/upload-logo', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    logoUrl?: string;
  } | null;

  if (!response.ok || !payload?.logoUrl) {
    throw new Error(payload?.error || 'Failed to upload logo');
  }

  return payload.logoUrl;
}

async function clearBrandLogoVariant(
  accountId: string,
  variant: BrandLogoVariant,
) {
  const response = await fetch('/api/brand/upload-logo', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, variant }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to remove logo');
  }
}

export function BrandLogoVariantUploader({
  accountId,
  variant,
  heading,
  description,
  value,
  canEdit,
}: {
  accountId: string;
  variant: BrandLogoVariant;
  heading: string;
  description: string;
  value: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();

  const onValueChange = useCallback(
    (file: File | null) => {
      const promise = file
        ? () =>
            uploadBrandLogoVariant(accountId, variant, file).then(() => {
              router.refresh();
            })
        : () =>
            clearBrandLogoVariant(accountId, variant).then(() => {
              router.refresh();
            });

      toast.promise(promise, {
        loading: file ? 'Uploading logo…' : 'Removing logo…',
        success: file ? 'Logo uploaded' : 'Logo removed',
        error: (error) =>
          error instanceof Error ? error.message : 'Could not update logo',
      });
    },
    [accountId, router, variant],
  );

  if (!canEdit) {
    return (
      <div className="space-y-2">
        <p className="text-sm">{heading}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-14 w-auto rounded-md" />
        ) : (
          <p className="text-muted-foreground text-sm">No logo uploaded.</p>
        )}
      </div>
    );
  }

  return (
    <ImageUploader value={value} onValueChange={onValueChange}>
      <div className="flex flex-col space-y-1">
        <span className="text-sm">{heading}</span>
        <span className="text-muted-foreground text-xs">{description}</span>
      </div>
    </ImageUploader>
  );
}
