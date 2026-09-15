import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';

export type PublicSurveyPhoto = {
  id: string;
  title: string;
  caption: string | null;
  sectionKey: string | null;
  photoRole: 'archive' | 'curated';
  url: string;
};

export type PublicSurveyPhotoShare = {
  title: string;
  propertyLabel: string;
  firmName: string;
  photos: PublicSurveyPhoto[];
};

export async function loadPublicSurveyPhotosByToken(
  token: string,
): Promise<PublicSurveyPhotoShare | null> {
  const normalized = token.trim();
  if (normalized.length < 16) return null;

  const admin = getSupabaseServerAdminClient();
  // photo_share_* / space_type join may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: survey, error } = await db
    .from('proposals')
    .select('id, account_id, title, recipient_name, kind, photo_share_enabled')
    .eq('photo_share_token', normalized)
    .eq('photo_share_enabled', true)
    .eq('kind', 'survey_report')
    .maybeSingle();

  if (error || !survey) return null;

  const { data: account } = await db
    .from('accounts')
    .select('name, space_type')
    .eq('id', survey.account_id)
    .maybeSingle();

  if (account?.space_type !== 'building-surveyor') return null;

  const { data: rows, error: docsError } = await db
    .from('docs')
    .select(
      'id, title, mime_type, file_path, storage_path, storage_bucket, caption, pinned_section_key, photo_role, curated_sort_order, created_at, kind',
    )
    .eq('account_id', survey.account_id)
    .eq('proposal_id', survey.id)
    .order('photo_role', { ascending: false })
    .order('curated_sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (docsError) return null;

  const photos: PublicSurveyPhoto[] = [];
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    const mime = (row.mime_type as string | null) ?? '';
    if (mime && !mime.startsWith('image/')) continue;
    if ((row.kind as string | null) && row.kind !== 'uploaded') continue;

    const path =
      (row.file_path as string | null) ?? (row.storage_path as string | null);
    if (!path) continue;

    const bucket = (row.storage_bucket as string | null) ?? ACCOUNT_DOCS_BUCKET;
    const { data: signed } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, 3600);
    if (!signed?.signedUrl) continue;

    photos.push({
      id: row.id as string,
      title: (row.title as string | null) ?? 'Survey photo',
      caption: (row.caption as string | null) ?? null,
      sectionKey: (row.pinned_section_key as string | null) ?? null,
      photoRole: (row.photo_role as 'archive' | 'curated' | null) ?? 'archive',
      url: signed.signedUrl,
    });
  }

  return {
    title: (survey.title as string | null)?.trim() || 'Building survey photos',
    propertyLabel:
      (survey.recipient_name as string | null)?.trim() || 'Site photographs',
    firmName: account?.name?.trim() || 'Chartered surveyor',
    photos,
  };
}
