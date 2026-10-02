import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AdminWaitlistLead = {
  id: string;
  email: string;
  interests: string[];
  source: string;
  createdAt: string;
};

export type AdminWaitlistPageData = {
  leads: AdminWaitlistLead[];
  total: number;
  page: number;
  perPage: number;
};

export async function loadAdminWaitlistPage(
  pageInput: number | string | undefined,
  query?: string,
): Promise<AdminWaitlistPageData> {
  const page = Math.max(1, Number(pageInput) || 1);
  const perPage = 25;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const admin = getSupabaseServerAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder = (admin as any)
    .from('launch_interest')
    .select('id, email, interests, source, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (query?.trim()) {
    builder = builder.ilike('email', `%${query.trim()}%`);
  }

  const { data, count, error } = await builder.range(from, to);

  if (error) {
    console.error('[loadAdminWaitlistPage] Error loading leads:', error);
    return {
      leads: [],
      total: 0,
      page,
      perPage,
    };
  }

  const leads: AdminWaitlistLead[] = (data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id),
      email: String(row.email),
      interests: Array.isArray(row.interests)
        ? (row.interests as string[])
        : [],
      source: String(row.source ?? 'coming-soon'),
      createdAt: String(row.created_at),
    }),
  );

  return {
    leads,
    total: count ?? leads.length,
    page,
    perPage,
  };
}
