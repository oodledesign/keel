import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type NoteCategoryOption = {
  slug: string;
  label: string;
  isCustom: boolean;
};

function isTableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('could not find') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

export async function loadAccountNoteCategories(
  accountId: string,
): Promise<{ categories: NoteCategoryOption[]; tableAvailable: boolean }> {
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('note_categories')
    .select('slug, label')
    .eq('account_id', accountId)
    .order('label', { ascending: true });

  if (error) {
    if (isTableMissing(error)) {
      return { categories: [], tableAvailable: false };
    }
    throw error;
  }

  return {
    categories: (data ?? []).map((row) => ({
      slug: row.slug as string,
      label: row.label as string,
      isCustom: true,
    })),
    tableAvailable: true,
  };
}
