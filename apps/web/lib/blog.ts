import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type BlogPostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  primary_keyword: string | null;
  reading_time_minutes: number | null;
  published_at: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string;
  author_avatar_url: string | null;
};

export type BlogPost = BlogPostListItem & {
  meta_description: string | null;
  content: string | null;
  secondary_keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  canonical_url: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  author_name: string;
  author_url: string | null;
  author_bio: string | null;
  author_avatar_url: string | null;
  schema_json: Record<string, unknown> | null;
  status: string;
  updated_at: string;
};

const LIST_COLUMNS =
  'id, slug, title, excerpt, primary_keyword, reading_time_minutes, published_at, featured_image_url, featured_image_alt, author_name, author_avatar_url';

const ALL_COLUMNS = `${LIST_COLUMNS}, meta_description, content, secondary_keywords, og_title, og_description, canonical_url, author_url, author_bio, schema_json, status, updated_at`;

export const getBlogPosts = cache(async (): Promise<BlogPostListItem[]> => {
  const client = getSupabaseServerAdminClient();

  const { data, error } = await client
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Failed to load blog posts', error.message);
    return [];
  }

  return (data ?? []) as BlogPostListItem[];
});

export const getBlogPost = cache(
  async (slug: string): Promise<BlogPost | null> => {
    const client = getSupabaseServerAdminClient();

    const { data, error } = await client
      .from('blog_posts')
      .select(ALL_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('Failed to load blog post', error.message);
      return null;
    }

    return (data as BlogPost | null) ?? null;
  },
);

export const getBlogPostSlugs = cache(async (): Promise<string[]> => {
  const client = getSupabaseServerAdminClient();

  const { data, error } = await client
    .from('blog_posts')
    .select('slug')
    .eq('status', 'published');

  if (error) {
    console.error('Failed to load blog post slugs', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.slug as string);
});

export type BlogPostSitemapItem = {
  slug: string;
  updated_at: string;
};

export const getPublishedBlogPostsForSitemap = cache(
  async (): Promise<BlogPostSitemapItem[]> => {
    const client = getSupabaseServerAdminClient();

    const { data, error } = await client
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published');

    if (error) {
      console.error('Failed to load blog posts for sitemap', error.message);
      return [];
    }

    return (data ?? []) as BlogPostSitemapItem[];
  },
);
