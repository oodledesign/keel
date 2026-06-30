import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { PortalSharedItemView } from './portal-shared-item-view';

interface PortalSharedPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ embed?: string }>;
}

async function loadSharedItem(token: string) {
  const client = getSupabaseServerAdminClient();

  const { data: note } = await client
    .from('notes')
    .select(
      'id, title, content, category, is_public, public_token, updated_at, account_id',
    )
    .eq('public_token', token)
    .eq('is_public', true)
    .maybeSingle();

  if (note) {
    return {
      type: 'note' as const,
      title: (note.title as string) || 'Note',
      content: (note.content as string) ?? '',
      category: note.category as string,
      updatedAt: note.updated_at as string,
      mimeType: null as string | null,
      fileUrl: null as string | null,
      kind: null as string | null,
    };
  }

  const { data: doc } = await client
    .from('docs')
    .select(
      'id, title, content, kind, category, mime_type, file_url, file_path, storage_path, is_public, public_token, updated_at, account_id',
    )
    .eq('public_token', token)
    .eq('is_public', true)
    .maybeSingle();

  if (!doc) return null;

  let fileUrl = (doc.file_url as string | null) ?? null;
  if (!fileUrl && doc.kind === 'uploaded') {
    const path =
      (doc.file_path as string | null) ??
      (doc.storage_path as string | null);
    if (path) {
      const { data: signed } = await client.storage
        .from('account-documents')
        .createSignedUrl(path, 3600);
      fileUrl = signed?.signedUrl ?? null;
    }
  }

  return {
    type: 'file' as const,
    title: (doc.title as string) || 'File',
    content: (doc.content as string | null) ?? null,
    category: doc.category as string,
    updatedAt: doc.updated_at as string,
    mimeType: (doc.mime_type as string | null) ?? null,
    fileUrl,
    kind: doc.kind as string,
  };
}

export default async function PortalSharedPage({
  params,
  searchParams,
}: PortalSharedPageProps) {
  const { token } = await params;
  const { embed } = await searchParams;
  if (!token) notFound();

  const item = await loadSharedItem(token);
  if (!item) notFound();

  const isEmbed = embed === '1' || embed === 'true';

  return (
    <div
      className={
        isEmbed
          ? 'min-h-0 bg-[var(--ozer-plum-950)] p-4 text-[var(--workspace-shell-text)]'
          : 'mx-auto min-h-screen max-w-3xl bg-[var(--ozer-plum-950)] px-4 py-8 text-[var(--workspace-shell-text)] sm:px-6 lg:px-8'
      }
    >
      <PortalSharedItemView item={item} embed={isEmbed} token={token} />
    </div>
  );
}
