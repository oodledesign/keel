'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';
import { mapSystemTemplate } from '~/lib/content-templates/map-rows';
import {
  DeleteSystemTemplateSchema,
  UpsertSystemTemplateSchema,
} from '~/lib/content-templates/schemas';
import type { ContentTemplateKind } from '~/lib/content-templates/types';

export async function listSystemTemplatesAction(kind?: ContentTemplateKind) {
  await requireSuperAdmin();
  const client = getSupabaseServerClient();
  let query = client.from('content_templates').select('*');
  if (kind) {
    query = query.eq('kind', kind);
  }
  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapSystemTemplate(row as Record<string, unknown>),
  );
}

export async function upsertSystemTemplateAction(input: unknown) {
  await requireSuperAdmin();
  const parsed = UpsertSystemTemplateSchema.parse(input);
  const client = getSupabaseServerClient();

  const payload = {
    kind: parsed.kind,
    name: parsed.name.trim(),
    slug: parsed.slug.trim(),
    description: parsed.description?.trim() || null,
    subject: parsed.subject?.trim() || null,
    body_html: parsed.bodyHtml ?? '',
    body_text: parsed.bodyText ?? '',
    signature: parsed.signature?.trim() || null,
    is_active: parsed.isActive,
    sort_order: parsed.sortOrder,
  };

  if (parsed.id) {
    const { error } = await client
      .from('content_templates')
      .update(payload)
      .eq('id', parsed.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('content_templates').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/templates');
  return { ok: true as const };
}

export async function deleteSystemTemplateAction(input: unknown) {
  await requireSuperAdmin();
  const parsed = DeleteSystemTemplateSchema.parse(input);
  const client = getSupabaseServerClient();
  const { error } = await client
    .from('content_templates')
    .delete()
    .eq('id', parsed.id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/templates');
  return { ok: true as const };
}
