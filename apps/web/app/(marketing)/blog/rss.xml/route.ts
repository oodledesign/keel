import { getBlogPosts } from '~/lib/blog';
import { absoluteUrl } from '~/lib/seo/schema';

export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = await getBlogPosts();
  const site = absoluteUrl('/').replace(/\/$/, '');

  const items = posts
    .map((post) => {
      const link = `${site}/blog/${post.slug}`;
      const description = escapeXml(post.excerpt ?? post.title);
      const pubDate = post.published_at
        ? new Date(post.published_at).toUTCString()
        : new Date().toUTCString();

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <author>${escapeXml(post.author_name)}</author>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Ozer Blog</title>
    <link>${site}/blog</link>
    <description>Notes from the studio on running freelance work and the Workspace OS.</description>
    <language>en-GB</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=600, stale-while-revalidate=86400',
    },
  });
}
