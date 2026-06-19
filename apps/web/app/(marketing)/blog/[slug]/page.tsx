import Link from 'next/link';

import type { Metadata } from 'next';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { notFound } from 'next/navigation';

import { Button } from '@kit/ui/button';

import { getBlogPost, getBlogPostSlugs } from '~/lib/blog';

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

function formatPublishedDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export async function generateStaticParams() {
  const slugs = await getBlogPostSlugs();

  return slugs.map((slug) => ({ slug }));
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
    },
    twitter: {
      card: 'summary_large_image',
      title: post.og_title ?? post.title,
      description: post.og_description ?? post.meta_description ?? undefined,
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

  const schemaJson = post.schema_json
    ? {
        ...post.schema_json,
        ...(post.published_at
          ? { datePublished: post.published_at }
          : {}),
        dateModified: post.updated_at,
      }
    : null;

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10 xl:py-14">
      {schemaJson ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJson) }}
        />
      ) : null}

      <header className="border-border/40 mb-10 border-b pb-8">
        <h1 className="font-heading text-3xl tracking-tighter xl:text-5xl">
          {post.title}
        </h1>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{post.author_name}</span>
          {post.published_at ? (
            <>
              <span aria-hidden>·</span>
              <time dateTime={post.published_at}>
                {formatPublishedDate(post.published_at)}
              </time>
            </>
          ) : null}
          {post.reading_time_minutes ? (
            <>
              <span aria-hidden>·</span>
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
