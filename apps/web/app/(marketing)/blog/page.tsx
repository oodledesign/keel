import type { Metadata } from 'next';

import { getBlogPosts } from '~/lib/blog';

import { SitePageHeader } from '../_components/site-page-header';
import { BlogPostCard } from './_components/blog-post-card';

export const dynamic = 'force-dynamic';

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

      <div className="container py-8 xl:py-10">
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center">No posts yet.</p>
        ) : (
          <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => (
              <BlogPostCard key={post.id} post={post} preloadImage={index < 3} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
