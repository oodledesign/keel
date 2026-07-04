import Link from 'next/link';

import type { Metadata } from 'next';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { notFound } from 'next/navigation';

import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Button } from '@kit/ui/button';

import { getBlogPost } from '~/lib/blog';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  schemaGraph,
} from '~/lib/seo/schema';

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

function titleWithBrand(title: string): string {
  if (title.includes('— Ozer') || title.includes('| Ozer')) return title;
  const next = `${title} — Ozer`;
  return next.length <= 60 ? next : `${title.slice(0, 52).trimEnd()} — Ozer`;
}

function inBriefSentences(post: {
  excerpt: string | null;
  meta_description: string | null;
  title: string;
}): [string, string, string] {
  const primary =
    post.excerpt?.trim() ||
    post.meta_description?.trim() ||
    `${post.title} is a studio note on the Ozer blog.`;
  return [
    primary.replace(/\s+/g, ' ').slice(0, 200),
    'Written for freelancers and small agencies running delivery work.',
    'Published on the Ozer Workspace OS blog.',
  ];
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

  const title = titleWithBrand(post.og_title ?? post.title);
  const description =
    post.meta_description ??
    post.excerpt ??
    `${post.title} — notes from the Ozer studio.`;

  const path = post.canonical_url?.startsWith('http')
    ? new URL(post.canonical_url).pathname
    : `/blog/${slug}`;

  return buildMarketingMetadata({
    title,
    description,
    path,
    ogType: 'blog',
    keywords,
    openGraphType: 'article',
    publishedTime: post.published_at ?? undefined,
    authors: ['Dan Potter'],
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const avatarUrl = normalizePictureUrl(post.author_avatar_url);
  const path = `/blog/${slug}`;
  const [brief1, brief2, brief3] = inBriefSentences(post);

  const schema = schemaGraph([
    articleJsonLd({
      headline: post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
      path,
      datePublished: post.published_at,
      dateModified: post.updated_at,
      imageUrl: post.featured_image_url,
      authorName: 'Dan Potter',
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog' },
      { name: post.title, path },
    ]),
  ]);

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10 xl:py-14">
      <JsonLd data={schema} />

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

        <aside className="border-border/40 bg-muted/20 mt-6 rounded-lg border p-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            In brief
          </h2>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
            <li>{brief1}</li>
            <li>{brief2}</li>
            <li>{brief3}</li>
          </ol>
        </aside>
      </header>

      {post.content ? (
        <div className="markdoc">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </div>
      ) : null}

      <aside className="border-border/40 bg-muted/20 mt-12 rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={post.author_name} />
            ) : null}
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
          ← Back to blog
        </Link>

        <div className="bg-muted/30 rounded-lg border border-border/40 p-6">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Run the studio from one home
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Ozer is the Workspace OS for freelancers and small agencies — flat price
            for the whole team.
          </p>
          <Button asChild className="mt-4">
            <Link href="/auth/sign-up">Start free</Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
