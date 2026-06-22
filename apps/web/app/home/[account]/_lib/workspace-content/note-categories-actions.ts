'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { NOTE_FILE_CATEGORY_OPTIONS } from './types';

function slugifyCategoryLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug || 'custom';
}

function revalidateCategoryPaths(
  accountSlug: string,
  personalScope?: boolean,
) {
  if (personalScope) {
    revalidatePath(pathsConfig.app.personalNotes);
    return;
  }

  revalidatePath(
    pathsConfig.app.accountNotes.replace('[account]', accountSlug),
  );
}

export const createNoteCategoryAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const label = data.label.trim();
    const slug = slugifyCategoryLabel(label);

    if ((NOTE_FILE_CATEGORY_OPTIONS as readonly string[]).includes(slug)) {
      return { slug, label: label, existed: true };
    }

    const { data: existing, error: existingError } = await client
      .from('note_categories')
      .select('slug, label')
      .eq('account_id', data.accountId)
      .eq('slug', slug)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      revalidateCategoryPaths(data.accountSlug, data.personalScope);
      return {
        slug: existing.slug as string,
        label: existing.label as string,
        existed: true,
      };
    }

    const { error } = await client.from('note_categories').insert({
      account_id: data.accountId,
      slug,
      label,
    });

    if (error) throw error;

    revalidateCategoryPaths(data.accountSlug, data.personalScope);
    return { slug, label, existed: false };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      label: z.string().trim().min(1).max(80),
      personalScope: z.boolean().optional(),
    }),
  },
);
