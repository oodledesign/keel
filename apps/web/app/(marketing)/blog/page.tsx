import Link from 'next/link';

import type { Metadata } from 'next';

import { getBlogPosts } from '~/lib/blog';

import { SitePageHeader } from '../_components/site-page-header';

const BLOG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Ozer Blog',
  url: 'https://ozer.so/blog',
  description:
    'Thoughts on running a freelance agency, building in public, and the tools that help.',
  publisher: {
    '@type': 'Organization',
    name: 'Ozer',
    url: 'https://ozer.so',
  },
};

export const metadata: Metadata = {
  title: 'Blog | Ozer',
  description:
    'Thoughts on running a freelance agency, building in public, and the tools that help.',
  alternates: {
    canonical: 'https://ozer.so/blog',
  },
};

function formatPublishedDate(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BLOG_JSON_LD) }}
      />

      <SitePageHeader
        title="Blog"
        subtitle="Thoughts on running a freelance agency, building in public, and the tools that help."
      />

      <div className="container flex flex-col space-y-8 py-8">
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center">No posts yet.</p>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
            {posts.map((post) => (
              <article
                key={post.id}
                className="border-border/40 border-b pb-10 last:border-b-0 last:pb-0"
              >
                <h2 className="font-heading text-2xl font-semibold tracking-tight">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>

                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {post.published_at ? (
                    <time dateTime={post.published_at}>
                      {formatPublishedDate(post.published_at)}
                    </time>
                  ) : null}
                  {post.reading_time_minutes ? (
                    <span>{post.reading_time_minutes} min read</span>
                  ) : null}
                </div>

                {post.excerpt ? (
                  <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                    {post.excerpt}
                  </p>
                ) : null}

                <Link
                  href={`/blog/${post.slug}`}
                  className="text-primary mt-4 inline-block text-sm font-medium underline-offset-4 hover:underline"
                >
                  Read more
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
