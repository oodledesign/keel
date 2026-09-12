import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { WORKSPACE_FORM_UPLOAD_BUCKET, isAllowedFormUpload } from './form-file';

/**
 * Files are written immediately so drafts can keep a ref. Abandoned drafts
 * do not delete objects yet — account storage purge covers the bucket.
 */

function safeSegment(name: string) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_').trim().slice(0, 180);
}

export async function uploadWorkspaceFormFile(input: {
  admin: SupabaseClient;
  accountId: string;
  formId: string;
  file: File;
}): Promise<{
  name: string;
  url: string;
  path: string;
  mimeType: string;
  size: number;
}> {
  const allowed = isAllowedFormUpload({
    mimeType: input.file.type,
    fileName: input.file.name,
    size: input.file.size,
  });
  if (!allowed.ok) {
    throw new Error(allowed.error);
  }

  const rawExt = input.file.name.includes('.')
    ? (input.file.name.split('.').pop() ?? '').trim().toLowerCase()
    : '';
  const ext =
    rawExt || (allowed.mimeType === 'application/pdf' ? 'pdf' : 'bin');
  const fileName = `${crypto.randomUUID()}-${safeSegment(input.file.name) || 'file'}.${ext}`;
  const path = `${input.accountId}/${input.formId}/${fileName}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const { error } = await input.admin.storage
    .from(WORKSPACE_FORM_UPLOAD_BUCKET)
    .upload(path, bytes, {
      contentType: allowed.mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Upload failed');
  }

  const url = input.admin.storage
    .from(WORKSPACE_FORM_UPLOAD_BUCKET)
    .getPublicUrl(path).data.publicUrl;

  return {
    name: input.file.name.trim().slice(0, 240) || fileName,
    url,
    path,
    mimeType: allowed.mimeType,
    size: input.file.size,
  };
}
