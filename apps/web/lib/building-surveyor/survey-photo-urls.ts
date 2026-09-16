import type { SupabaseClient } from '@supabase/supabase-js';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';

export type SurveyPhotoUrlSource = {
  id: string;
  filePath?: string | null;
  storagePath?: string | null;
  storageBucket?: string | null;
};

export async function signSurveyPhotoUrls(
  admin: SupabaseClient,
  photos: SurveyPhotoUrlSource[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};

  await Promise.all(
    photos.map(async (photo) => {
      const path = photo.filePath ?? photo.storagePath;
      if (!path) return;
      const bucket = photo.storageBucket ?? ACCOUNT_DOCS_BUCKET;
      const { data } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);
      if (data?.signedUrl) {
        urls[photo.id] = data.signedUrl;
      }
    }),
  );

  return urls;
}
