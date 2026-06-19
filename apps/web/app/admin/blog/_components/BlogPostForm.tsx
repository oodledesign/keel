'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  createBlogPost,
  publishBlogPost,
  unpublishBlogPost,
  updateBlogPost,
  type BlogPostFormData,
} from '../_actions';

type BlogPostRecord = {
  id?: string;
  slug?: string | null;
  title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  content?: string | null;
  primary_keyword?: string | null;
  secondary_keywords?: string[] | null;
  og_title?: string | null;
  og_description?: string | null;
  canonical_url?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  reading_time_minutes?: number | null;
  status?: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function CharacterCounter({
  value,
  max,
}: {
  value: string;
  max: number;
}) {
  return (
    <p className="text-muted-foreground text-right text-xs">
      {value.length}/{max}
    </p>
  );
}

export function BlogPostForm({ post }: { post?: BlogPostRecord | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug));

  const initial = useMemo(
    () => ({
      slug: post?.slug ?? '',
      title: post?.title ?? '',
      meta_description: post?.meta_description ?? '',
      excerpt: post?.excerpt ?? '',
      content: post?.content ?? '',
      primary_keyword: post?.primary_keyword ?? '',
      secondary_keywords: (post?.secondary_keywords ?? []).join(', '),
      og_title: post?.og_title ?? '',
      og_description: post?.og_description ?? '',
      canonical_url: post?.canonical_url ?? '',
      featured_image_url: post?.featured_image_url ?? '',
      featured_image_alt: post?.featured_image_alt ?? '',
      author_name: post?.author_name ?? 'Dan Potter',
      author_url: post?.author_url ?? 'https://ozer.so',
      reading_time_minutes:
        post?.reading_time_minutes != null
          ? String(post.reading_time_minutes)
          : '',
    }),
    [post],
  );

  const [form, setForm] = useState(initial);

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'title' && !slugTouched) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  };

  const buildPayload = (): BlogPostFormData => ({
    slug: form.slug,
    title: form.title,
    meta_description: form.meta_description,
    excerpt: form.excerpt,
    content: form.content,
    primary_keyword: form.primary_keyword,
    secondary_keywords: form.secondary_keywords,
    og_title: form.og_title,
    og_description: form.og_description,
    canonical_url: form.canonical_url,
    featured_image_url: form.featured_image_url,
    featured_image_alt: form.featured_image_alt,
    author_name: form.author_name,
    author_url: form.author_url,
    reading_time_minutes: form.reading_time_minutes
      ? Number(form.reading_time_minutes)
      : null,
  });

  const handleSave = () => {
    startTransition(async () => {
      try {
        const payload = buildPayload();

        if (post?.id) {
          await updateBlogPost(post.id, payload);
          toast.success('Post saved');
          router.refresh();
          return;
        }

        const id = await createBlogPost(payload);
        toast.success('Post created');
        router.push(`/admin/blog/${id}/edit`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save post');
      }
    });
  };

  const handlePublishToggle = () => {
    if (!post?.id) return;

    startTransition(async () => {
      try {
        if (post.status === 'published') {
          await unpublishBlogPost(post.id!);
          toast.success('Post unpublished');
        } else {
          await publishBlogPost(post.id!);
          toast.success('Post published');
        }
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update publish status',
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="content">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="author">Author</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                updateField('slug', event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              rows={3}
              value={form.excerpt}
              onChange={(event) => updateField('excerpt', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              rows={20}
              className="font-mono text-sm"
              value={form.content}
              onChange={(event) => updateField('content', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reading_time_minutes">Reading time (minutes)</Label>
            <Input
              id="reading_time_minutes"
              type="number"
              min={1}
              value={form.reading_time_minutes}
              onChange={(event) =>
                updateField('reading_time_minutes', event.target.value)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="seo" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta_description">Meta description</Label>
            <Textarea
              id="meta_description"
              rows={2}
              value={form.meta_description}
              onChange={(event) =>
                updateField('meta_description', event.target.value)
              }
            />
            <CharacterCounter value={form.meta_description} max={160} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_keyword">Primary keyword</Label>
            <Input
              id="primary_keyword"
              value={form.primary_keyword}
              onChange={(event) =>
                updateField('primary_keyword', event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondary_keywords">Secondary keywords</Label>
            <Input
              id="secondary_keywords"
              value={form.secondary_keywords}
              onChange={(event) =>
                updateField('secondary_keywords', event.target.value)
              }
            />
            <p className="text-muted-foreground text-xs">Separate with commas</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_title">OG title</Label>
            <Input
              id="og_title"
              value={form.og_title}
              onChange={(event) => updateField('og_title', event.target.value)}
            />
            <CharacterCounter value={form.og_title} max={60} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="og_description">OG description</Label>
            <Textarea
              id="og_description"
              rows={2}
              value={form.og_description}
              onChange={(event) =>
                updateField('og_description', event.target.value)
              }
            />
            <CharacterCounter value={form.og_description} max={160} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="canonical_url">Canonical URL</Label>
            <Input
              id="canonical_url"
              value={form.canonical_url}
              onChange={(event) =>
                updateField('canonical_url', event.target.value)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="featured_image_url">Featured image URL</Label>
            <Input
              id="featured_image_url"
              value={form.featured_image_url}
              onChange={(event) =>
                updateField('featured_image_url', event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="featured_image_alt">Featured image alt text</Label>
            <Input
              id="featured_image_alt"
              value={form.featured_image_alt}
              onChange={(event) =>
                updateField('featured_image_alt', event.target.value)
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="author" className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="author_name">Author name</Label>
            <Input
              id="author_name"
              value={form.author_name}
              onChange={(event) => updateField('author_name', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author_url">Author URL</Label>
            <Input
              id="author_url"
              value={form.author_url}
              onChange={(event) => updateField('author_url', event.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button disabled={isPending} onClick={handleSave}>
          Save
        </Button>

        {form.slug ? (
          <Button asChild variant="outline">
            <Link href={`/blog/${form.slug}`} target="_blank" rel="noreferrer">
              Preview
            </Link>
          </Button>
        ) : null}

        {post?.id ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={handlePublishToggle}
          >
            {post.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
