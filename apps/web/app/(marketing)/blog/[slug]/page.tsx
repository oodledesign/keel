import Link from 'next/link';

import type { Metadata } from 'next';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { notFound } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';

import { getBlogPost } from '~/lib/blog';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = 'force-dynamic';

function formatPublishedDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function normalizePictureUrl(url: string | null | undefined) {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

function buildSchemaJson(post: NonNullable<Awaited<ReturnType<typeof getBlogPost>>>) {
  const author = {
    '@type': 'Person',
    name: post.author_name,
    ...(post.author_url ? { url: post.author_url } : {}),
    ...(post.author_avatar_url ? { image: post.author_avatar_url } : {}),
    ...(post.author_bio ? { description: post.author_bio } : {}),
  };

  const base = post.schema_json
    ? { ...post.schema_json }
    : {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.meta_description ?? post.excerpt ?? undefined,
      };

  return {
    ...base,
    author: {
      ...(typeof base.author === 'object' && base.author !== null ? base.author : {}),
      ...author,
    },
    ...(post.published_at ? { datePublished: post.published_at } : {}),
    dateModified: post.updated_at,
    ...(post.featured_image_url
      ? {
          image: {
            '@type': 'ImageObject',
            url: post.featured_image_url,
            ...(post.featured_image_alt ? { caption: post.featured_image_alt } : {}),
          },
        }
      : {}),
  };
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {};
  }

  const keywords = [
    post.primary_keyword,
    ...(post.secondary_keywords ?? []),
  ].filter(Boolean) as string[];

  return {
    title: post.title,
    description: post.meta_description ?? undefined,
    keywords,
    openGraph: {
      title: post.og_title ?? post.title,
      description: post.og_description ?? post.meta_description ?? undefined,
      url: post.canonical_url ?? undefined,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      authors: post.author_url ? [post.author_url] : undefined,
      ...(post.featured_image_url
        ? { images: [{ url: post.featured_image_url, alt: post.featured_image_alt ?? post.title }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.og_title ?? post.title,
      description: post.og_description ?? post.meta_description ?? undefined,
      ...(post.featured_image_url ? { images: [post.featured_image_url] } : {}),
    },
    alternates: {
      canonical: post.canonical_url ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const schemaJson = buildSchemaJson(post);
  const avatarUrl = normalizePictureUrl(post.author_avatar_url);

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10 xl:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }}
      />

      <header className="border-border/40 mb-10 border-b pb-8">
        {post.featured_image_url ? (
          <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-xl">
            <Image
              src={post.featured_image_url}
              alt={post.featured_image_alt ?? post.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        ) : null}

        <h1 className="font-heading text-3xl tracking-tighter xl:text-5xl">
          {post.title}
        </h1>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {post.published_at ? (
            <time dateTime={post.published_at}>
              {formatPublishedDate(post.published_at)}
            </time>
          ) : null}
          {post.reading_time_minutes ? (
            <>
              {post.published_at ? <span aria-hidden>·</span> : null}
              <span>{post.reading_time_minutes} min read</span>
            </>
          ) : null}
        </div>
      </header>

      {post.content ? (
        <div className="markdoc">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      ) : null}

      <aside className="border-border/40 bg-muted/20 mt-12 rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={post.author_name} /> : null}
            <AvatarFallback className="text-base uppercase">
              {post.author_name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Written by
            </p>
            {post.author_url ? (
              <a
                href={post.author_url}
                className="font-heading text-lg font-semibold tracking-tight hover:underline"
                rel="author"
              >
                {post.author_name}
              </a>
            ) : (
              <p className="font-heading text-lg font-semibold tracking-tight">
                {post.author_name}
              </p>
            )}
            {post.author_bio ? (
              <p className="text-muted-foreground pt-1 text-sm leading-relaxed">
                {post.author_bio}
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <footer className="border-border/40 mt-12 space-y-8 border-t pt-10">
        <Link
          href="/blog"
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          ← Back to Blog
        </Link>

        <div className="bg-muted/30 rounded-lg border border-border/40 p-6">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Ready to simplify your freelance business?
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Ozer connects client work, email, invoicing, and meeting notes in one
            system built for solo agencies and small studios.
          </p>
          <Button asChild className="mt-4">
            <Link href="/">Get early access</Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
