import { getBlogPosts } from '~/lib/blog';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import { blogJsonLd, breadcrumbJsonLd, schemaGraph } from '~/lib/seo/schema';

import { SitePageHeader } from '../_components/site-page-header';
import { BlogPostCard } from './_components/blog-post-card';

export const dynamic = 'force-dynamic';

export const metadata = buildMarketingMetadata({
  title: 'Studio notes and updates — Ozer',
  description:
    'Notes from the studio on running freelance work, delivery, and the Workspace OS. Written by operators for operators.',
  path: '/blog',
  ogType: 'blog',
});

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <JsonLd
        data={schemaGraph([
          blogJsonLd(),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ]),
        ])}
      />

      <SitePageHeader
        title="Blog"
        subtitle="Notes from the studio on running freelance work and the Workspace OS."
      />

      <div className="container py-8 xl:py-10">
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-center text-sm">
          <a href="/blog/rss.xml" className="underline underline-offset-2">
            RSS feed
          </a>
        </p>
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
