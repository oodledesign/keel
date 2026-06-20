'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

export type BlogPostFormData = {
  slug: string;
  title: string;
  meta_description?: string | null;
  excerpt?: string | null;
  content?: string | null;
  primary_keyword?: string | null;
  secondary_keywords?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  canonical_url?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  author_user_id?: string | null;
  author_bio?: string | null;
  reading_time_minutes?: number | null;
};

export type AdminBlogPostListItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  primary_keyword: string | null;
  reading_time_minutes: number | null;
  published_at: string | null;
  created_at: string;
};

type DbClient = {
  from: (table: string) => any;
};

function adminClient() {
  return getSupabaseServerAdminClient() as unknown as DbClient;
}

function revalidateBlogPaths(slug?: string) {
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  if (slug) {
    revalidatePath(`/blog/${slug}`);
  }
}

function parseSecondaryKeywords(value: string | null | undefined) {
  if (!value?.trim()) return null;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function resolveAuthorFields(data: BlogPostFormData) {
  const authorUserId = data.author_user_id?.trim() || null;
  let authorName = data.author_name?.trim() || 'Dan Potter';
  let authorAvatarUrl: string | null = null;

  if (authorUserId) {
    const { data: account, error } = await adminClient()
      .from('accounts')
      .select('picture_url')
      .eq('primary_owner_user_id', authorUserId)
      .eq('is_personal_account', true)
      .maybeSingle();

    if (error) {
      console.error('[blog] author account lookup failed:', error.message);
    } else if (account) {
      const pictureUrl = (account.picture_url as string | null | undefined)?.trim();
      authorAvatarUrl = pictureUrl || null;
    }
  }

  return {
    author_name: authorName,
    author_url: data.author_url?.trim() || 'https://ozer.so',
    author_user_id: authorUserId,
    author_bio: data.author_bio?.trim() || null,
    author_avatar_url: authorAvatarUrl,
  };
}

async function toDbPayload(data: BlogPostFormData) {
  const author = await resolveAuthorFields(data);

  return {
    slug: data.slug.trim(),
    title: data.title.trim(),
    meta_description: data.meta_description?.trim() || null,
    excerpt: data.excerpt?.trim() || null,
    content: data.content ?? null,
    primary_keyword: data.primary_keyword?.trim() || null,
    secondary_keywords: parseSecondaryKeywords(data.secondary_keywords),
    og_title: data.og_title?.trim() || null,
    og_description: data.og_description?.trim() || null,
    canonical_url: data.canonical_url?.trim() || null,
    featured_image_url: data.featured_image_url?.trim() || null,
    featured_image_alt: data.featured_image_alt?.trim() || null,
    ...author,
    reading_time_minutes: data.reading_time_minutes ?? null,
  };
}

export async function getAdminBlogPosts(): Promise<AdminBlogPostListItem[]> {
  await requireSuperAdmin();

  const { data, error } = await adminClient()
    .from('blog_posts')
    .select(
      'id, slug, title, status, primary_keyword, reading_time_minutes, published_at, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as AdminBlogPostListItem[];
}

export async function getAdminBlogPost(id: string) {
  await requireSuperAdmin();

  const { data, error } = await adminClient()
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data;
}

export async function createBlogPost(data: BlogPostFormData) {
  await requireSuperAdmin();

  const payload = await toDbPayload(data);

  if (!payload.slug || !payload.title) {
    throw new Error('Slug and title are required');
  }

  const { data: created, error } = await adminClient()
    .from('blog_posts')
    .insert(payload)
    .select('id, slug')
    .single();

  if (error) throw new Error(error.message);

  revalidateBlogPaths(created.slug);

  return created.id as string;
}

export async function updateBlogPost(id: string, data: BlogPostFormData) {
  await requireSuperAdmin();

  const payload = await toDbPayload(data);

  if (!payload.slug || !payload.title) {
    throw new Error('Slug and title are required');
  }

  const { data: updated, error } = await adminClient()
    .from('blog_posts')
    .update(payload)
    .eq('id', id)
    .select('slug')
    .single();

  if (error) throw new Error(error.message);

  revalidateBlogPaths(updated.slug);

  return updated.slug as string;
}

export async function publishBlogPost(id: string) {
  await requireSuperAdmin();

  const existing = await getAdminBlogPost(id);

  if (!existing) {
    throw new Error('Post not found');
  }

  const { data, error } = await adminClient()
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: existing.published_at ?? new Date().toISOString(),
    })
    .eq('id', id)
    .select('slug')
    .single();

  if (error) throw new Error(error.message);

  revalidateBlogPaths(data.slug);

  return data.slug as string;
}

export async function unpublishBlogPost(id: string) {
  await requireSuperAdmin();

  const { data, error } = await adminClient()
    .from('blog_posts')
    .update({ status: 'draft' })
    .eq('id', id)
    .select('slug')
    .single();

  if (error) throw new Error(error.message);

  revalidateBlogPaths(data.slug);

  return data.slug as string;
}

export async function deleteBlogPost(id: string) {
  await requireSuperAdmin();

  const existing = await getAdminBlogPost(id);

  const { error } = await adminClient().from('blog_posts').delete().eq('id', id);

  if (error) throw new Error(error.message);

  revalidateBlogPaths(existing?.slug);
}
